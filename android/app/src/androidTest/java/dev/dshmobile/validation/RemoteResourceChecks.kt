package dev.dshmobile.validation

import android.net.Uri
import android.util.Base64
import android.webkit.WebResourceRequest
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

/** 仅传送测试字节，不连接电脑、不读取绑定或普通聊天凭据。 */
object RemoteResourceChecks {
    private class Request(private val target: String, private val verb: String = "GET") : WebResourceRequest {
        override fun getUrl() = Uri.parse(target)
        override fun isForMainFrame() = false
        override fun isRedirect() = false
        override fun hasGesture() = false
        override fun getMethod() = verb
        override fun getRequestHeaders() = mutableMapOf<String, String>()
    }
    fun run(context: android.content.Context) {
        val root = java.io.File(context.cacheDir, "resource-check-${java.util.UUID.randomUUID()}")
        val sent = mutableListOf<JSONObject>()
        lateinit var carrier: RemoteResources
        var finishImmediately = true
        var omitHeaders = false
        var currentId = ""
        val chunk = ByteArray(65_536) { (it % 127).toByte() }
        fun frame(id: String, type: String, value: JSONObject? = null) = JSONObject()
            .put("id", id).put("type", type).apply { if (value != null) put("value", value) }
        carrier = RemoteResources(root, { "test" }) { message ->
            sent.add(message)
            val id = message.getString("id")
            if (message.getString("type") == "request") {
                currentId = id
                if (!omitHeaders) carrier.receive(frame(id, "event", JSONObject().put("type", "headers").put("status", 200)
                    .put("headers", JSONObject().put("content-type", "application/javascript"))))
                repeat(4) { carrier.receive(frame(id, "event", JSONObject().put("type", "chunk")
                    .put("data", Base64.encodeToString(chunk, Base64.NO_WRAP)))) }
                if (finishImmediately) carrier.receive(frame(id, "end"))
            }
            true
        }
        val url = "https://remote.dshm.invalid/plugins/fixture/client.js?rev=fixture"
        check(carrier.intercept(Request("https://unrelated.invalid/plugins/a")) == null)
        check(carrier.intercept(Request("https://remote.dshm.invalid/api/dsh-mobile")) == null)
        check(carrier.intercept(Request(url, "POST"))?.statusCode == 405 && sent.isEmpty())
        val complete = checkNotNull(carrier.intercept(Request(url)))
        check(complete.statusCode == 200 && complete.responseHeaders["Cache-Control"] == "no-store")
        val bytes = complete.data.readBytes()
        check(complete.data.read() == -1 && complete.data.read() == -1)
        check(complete.responseHeaders.keys.none { it.equals("content-type", ignoreCase = true) })
        check(bytes.size == chunk.size * 4)
        repeat(4) { check(bytes.copyOfRange(it * chunk.size, (it + 1) * chunk.size).contentEquals(chunk)) }

        // 已收到 end 但尚未消费的缓存也属于连接：撤销不能继续读取余下字节。
        val buffered = checkNotNull(carrier.intercept(Request(url))).data
        check(buffered.read() == 0)
        carrier.disconnect()
        check(runCatching { buffered.read() }.exceptionOrNull() is IOException)

        finishImmediately = false
        val windowed = checkNotNull(carrier.intercept(Request(url))).data
        val buffer = ByteArray(chunk.size)
        repeat(3) { check(windowed.read(buffer) == chunk.size) }
        check(sent.any { it.optString("type") == "ack" && it.getString("id") == currentId && it.getInt("count") == 2 })
        windowed.close()
        check(runCatching { windowed.read() }.exceptionOrNull() is IOException)
        check(sent.any { it.optString("type") == "cancel" && it.getString("id") == currentId })

        omitHeaders = true
        check(carrier.intercept(Request(url))?.statusCode == 502)
        carrier.disconnect()
        queuedConnectionChange(root)
        cachedResources(root)
        root.deleteRecursively()
    }

    /** 四个真实资源槽占满，第五个已经阻塞时断开；即使新连接立刻可用也不能重发旧下载。 */
    private fun queuedConnectionChange(root: java.io.File) {
        val requests = AtomicInteger()
        lateinit var resources: RemoteResources
        resources = RemoteResources(root, { "queued" }) { message ->
            if (message.getString("type") == "request") {
                requests.incrementAndGet()
                resources.receive(JSONObject().put("id", message.getString("id")).put("type", "event")
                    .put("value", JSONObject().put("type", "headers").put("status", 200)
                        .put("headers", JSONObject().put("content-type", "application/javascript"))))
            }
            true // 原连接断开后，新连接立即可用；不能只依赖 send 返回 false。
        }
        val request = Request("https://remote.dshm.invalid/plugins/fixture/queued-worker.js")
        val open = List(4) { checkNotNull(resources.intercept(request)) }
        val queued = CompletableFuture<Int>()
        val waiter = Thread {
            try { queued.complete(checkNotNull(resources.intercept(request)).statusCode) }
            catch (error: Throwable) { queued.completeExceptionally(error) }
        }
        try {
            waiter.start()
            val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5)
            while (waiter.state != Thread.State.TIMED_WAITING && System.nanoTime() < deadline) Thread.yield()
            check(waiter.state == Thread.State.TIMED_WAITING && requests.get() == 4)
            resources.disconnect()
            check(queued.get(5, TimeUnit.SECONDS) == 502) { "queued resource crossed connection boundary" }
            check(requests.get() == 4) { "old queued download sent through new connection" }
            for (response in open) check(runCatching { response.data.read() }.exceptionOrNull() is IOException)
            // 旧等待者归还容量，新连接仍可占满全部四个槽。
            val fresh = List(4) { checkNotNull(resources.intercept(request)) }
            check(fresh.all { it.statusCode == 200 } && requests.get() == 8)
            fresh.forEach { it.data.close() }
        } finally {
            resources.disconnect()
            open.forEach { it.data.close() }
            waiter.interrupt(); waiter.join(5000)
        }
    }

    private fun cachedResources(root: java.io.File) {
        var content = "window.test = 'version one';".toByteArray()
        var allowed = true
        var binding = "one"
        val verbs = mutableListOf<String>()
        lateinit var resources: RemoteResources
        fun create(): RemoteResources = RemoteResources(root, { binding }) { message ->
            if (message.getString("type") == "request") {
                val id = message.getString("id")
                val verb = message.getJSONObject("operation").getString("verb")
                verbs.add(verb)
                val hash = java.security.MessageDigest.getInstance("SHA-256").digest(content).joinToString("") { "%02x".format(it) }
                val headers = JSONObject().put("content-type", "application/javascript").put("etag", "\"sha256-$hash\"")
                resources.receive(JSONObject().put("id", id).put("type", "event").put("value", JSONObject()
                    .put("type", "headers").put("status", if (allowed) 200 else 404).put("headers", headers)))
                if (verb == "GET" && allowed) resources.receive(JSONObject().put("id", id).put("type", "event").put("value", JSONObject()
                    .put("type", "chunk").put("data", Base64.encodeToString(content, Base64.NO_WRAP))))
                resources.receive(JSONObject().put("id", id).put("type", "end"))
            }
            true
        }
        val request = Request("https://remote.dshm.invalid/plugins/cache/client.js")
        fun read() = checkNotNull(resources.intercept(request)).data.use { it.readBytes() }
        resources = create()
        check(read().contentEquals(content) && verbs == listOf("GET"))
        resources.disconnect(); resources = create() // 新对象复用同一私有目录，模拟页面/进程重建。
        check(read().contentEquals(content) && verbs.takeLast(1) == listOf("HEAD"))
        val closed = checkNotNull(resources.intercept(request)).data
        closed.close()
        check(runCatching { closed.read() }.exceptionOrNull() is IOException)
        content = "window.test = 'updated on computer';".toByteArray()
        check(read().contentEquals(content) && verbs.takeLast(2) == listOf("HEAD", "GET"))
        val cached = checkNotNull(resources.intercept(request)).data
        resources.disconnect()
        check(runCatching { cached.read() }.exceptionOrNull() is IOException)
        binding = "another"
        check(read().contentEquals(content) && verbs.last() == "GET")
        allowed = false
        check(resources.intercept(request)?.statusCode == 404 && verbs.last() == "HEAD")
        allowed = true
        check(read().contentEquals(content) && verbs.last() == "GET")
        RemoteResourceCache.clear(root)
        check(read().contentEquals(content) && verbs.last() == "GET")
        // 撕裂/损坏的条目不复用，也不会作为完整资源发布。
        root.listFiles()?.forEach { it.writeBytes(byteArrayOf(1)) }
        check(read().contentEquals(content) && verbs.last() == "GET")
    }
}
