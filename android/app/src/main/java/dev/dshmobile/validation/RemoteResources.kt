package dev.dshmobile.validation

import android.util.Base64
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.IOException
import java.io.InputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.UUID
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Semaphore
import java.util.concurrent.TimeUnit

/** WebView 子资源与页面 RPC 共用已认证 socket；页面和 Worker 都拿不到设备凭据。 */
class RemoteResources(root: File, private val scope: () -> String?, private val send: (JSONObject) -> Boolean) {
    private val cache = RemoteResourceCache(root)
    private val streams = ConcurrentHashMap<String, Resource>()
    private val slots = Semaphore(4)
    private val lifecycle = Any()
    @Volatile private var generation = 0L

    fun intercept(request: WebResourceRequest): WebResourceResponse? {
        val url = request.url
        if (url.scheme != "https" || url.authority != "remote.dshm.invalid" || !url.path.orEmpty().startsWith("/plugins/")) return null
        if (request.method !in setOf("GET", "HEAD")) return blocked(405)
        // 在排队前记住连接；空位可能由断开释放，不能把旧页面的等待下载带到新连接。
        val owner = generation
        val binding = scope() ?: return blocked(403)
        val path = url.encodedPath + (url.encodedQuery?.let { "?$it" } ?: "")
        return try {
            val cached = if (request.method == "GET") cache.read(binding, path) else null
            if (cached != null) {
                val (metadata, stream) = open(path, "HEAD", owner)
                val status = metadata.getInt("status")
                val etag = metadata.getJSONObject("headers").optString("etag")
                if (status == 200 && etag == cached.etag && owner == generation) {
                    stream.use { it.readBytes() }
                    val input = ByteArrayInputStream(cached.bytes)
                    return response(metadata, object : InputStream() {
                        var closed = false
                        override fun read(): Int { checkCurrent(); return input.read() }
                        override fun read(bytes: ByteArray, offset: Int, length: Int): Int { checkCurrent(); return input.read(bytes, offset, length) }
                        private fun checkCurrent() { if (closed || owner != generation || scope() != binding) throw IOException("remote_resource_closed") }
                        override fun close() { closed = true; input.close() }
                    })
                }
                cache.remove(binding, path)
                // 删除、拒绝和版本错误不允许用旧内容掩盖。
                if (status != 200) return response(metadata, stream)
                stream.use { it.readBytes() }
            }
            val stamp = cache.stamp()
            val (metadata, stream) = open(path, request.method, owner)
            val etag = metadata.getJSONObject("headers").optString("etag")
            val body = if (request.method == "GET" && metadata.getInt("status") == 200 &&
                etag.matches(Regex("\"sha256-[a-f0-9]{64}\""))) storing(stream, binding, path, etag, stamp, owner) else stream
            response(metadata, body)
        } catch (_: Exception) { blocked(502) }
    }

    private fun response(metadata: JSONObject, stream: InputStream): WebResourceResponse {
        val headers = metadata.getJSONObject("headers")
        val values = mutableMapOf("Cache-Control" to "no-store", "X-Content-Type-Options" to "nosniff")
        // WebResourceResponse 根据 mime/encoding 生成 Content-Type，重复添加会被合并为非法 MIME。
        for (key in headers.keys()) if (!key.equals("content-type", ignoreCase = true)) values[key] = headers.getString(key)
        val mime = headers.optString("content-type", "application/octet-stream").substringBefore(';')
        val status = metadata.getInt("status")
        if (status !in 200..599 || status in 300..399) { stream.close(); throw IOException("invalid_resource_status") }
        return WebResourceResponse(mime, if (mime.startsWith("text/") || mime == "application/json") "UTF-8" else null,
            status, if (status < 400) "OK" else "Unavailable", values, stream)
    }

    private fun storing(input: InputStream, binding: String, path: String, etag: String, stamp: Long, owner: Long) = object : InputStream() {
        var buffer: ByteArrayOutputStream? = ByteArrayOutputStream()
        var finished = false
        override fun read(): Int { val byte = ByteArray(1); return if (read(byte, 0, 1) == -1) -1 else byte[0].toInt() and 255 }
        override fun read(bytes: ByteArray, offset: Int, length: Int): Int {
            val count = input.read(bytes, offset, length)
            if (count > 0) {
                val pending = buffer
                if (pending != null && pending.size() + count <= RemoteResourceCache.MAX_ENTRY) pending.write(bytes, offset, count)
                else buffer = null
            } else if (count == -1 && !finished) {
                finished = true
                val pending = buffer; buffer = null
                if (pending != null && owner == generation && scope() == binding)
                    cache.write(binding, path, RemoteResourceCache.Entry(etag, pending.toByteArray()), stamp)
            }
            return count
        }
        override fun close() { buffer = null; input.close() }
    }

    private fun open(path: String, verb: String, owner: Long): Pair<JSONObject, Resource> {
        try {
            if (!slots.tryAcquire(30, TimeUnit.SECONDS)) throw IOException("remote_resource_busy")
        } catch (_: InterruptedException) { Thread.currentThread().interrupt(); throw IOException("remote_resource_interrupted") }
        val id = UUID.randomUUID().toString()
        val stream = Resource(id, owner)
        try {
            synchronized(lifecycle) {
                if (owner != generation) { slots.release(); throw IOException("remote_resource_closed") }
                // 登记、发送与断开必须互斥，否则清理快照可能漏掉刚加入的下载。
                streams[id] = stream
                if (!send(JSONObject().put("type", "request").put("id", id).put("operation", JSONObject()
                        .put("method", "remote.resource").put("verb", verb).put("path", path)))) throw IOException("remote_not_connected")
            }
            val metadata = stream.headers.get(30, TimeUnit.SECONDS)
            if (owner != generation) throw IOException("remote_resource_closed")
            return metadata to stream
        } catch (error: Exception) { stream.close(); throw error }
    }

    /** true 表示内部资源帧，不再把它广播进 JavaScript 的 RPC 队列。 */
    fun receive(frame: JSONObject): Boolean {
        val stream = streams[frame.optString("id")] ?: return false
        try {
            when (frame.getString("type")) {
                "event" -> {
                    val value = frame.getJSONObject("value")
                    when (value.getString("type")) {
                        "headers" -> if (!stream.headers.complete(value)) throw IOException("duplicate_headers")
                        "chunk" -> {
                            if (!stream.headers.isDone) throw IOException("missing_headers")
                            val encoded = value.getString("data")
                            if (encoded.length > 87_384) throw IOException("resource_chunk_limit")
                            val bytes = Base64.decode(encoded, Base64.NO_WRAP)
                            if (bytes.size > 65_536 || !stream.queue.offer(bytes)) throw IOException("resource_queue_limit")
                        }
                        else -> throw IOException("invalid_resource_frame")
                    }
                }
                "end" -> { stream.ended = true; stream.queue.offer(ByteArray(0)) }
                "error" -> stream.fail()
                else -> throw IOException("invalid_resource_frame")
            }
        } catch (_: Exception) { stream.fail() }
        return true
    }

    fun disconnect() = synchronized(lifecycle) {
        generation++
        for (stream in streams.values) stream.close()
    }
    private fun blocked(status: Int) = WebResourceResponse("text/plain", "UTF-8", status, "Unavailable",
        mapOf("Cache-Control" to "no-store"), ByteArrayInputStream(ByteArray(0)))

    private inner class Resource(private val id: String, private val owner: Long) : InputStream() {
        val headers = CompletableFuture<JSONObject>()
        val queue = ArrayBlockingQueue<ByteArray>(5)
        @Volatile var ended = false
        @Volatile private var failed = false
        private var exhausted = false
        private var buffer = ByteArray(0)
        private var offset = 0
        private var consumed = 0
        private fun sendCurrent(frame: JSONObject): Boolean = synchronized(lifecycle) {
            owner == generation && send(frame)
        }
        override fun read(): Int {
            val one = ByteArray(1)
            return if (read(one, 0, 1) == -1) -1 else one[0].toInt() and 255
        }
        override fun read(target: ByteArray, start: Int, length: Int): Int {
            if (length == 0) return 0
            if (failed) throw IOException("remote_resource_closed")
            if (exhausted) return -1
            if (offset == buffer.size) {
                if (buffer.isNotEmpty()) {
                    consumed++
                    // 每消费两块确认一次，减少消息速率；上游窗口仍严格限制为四块。
                    if (consumed == 2 && !ended) {
                        if (!sendCurrent(JSONObject().put("type", "ack").put("id", id).put("count", consumed))) { fail(); throw IOException("remote_resource_closed") }
                        consumed = 0
                    }
                }
                if (ended && queue.isEmpty()) { finish(); return -1 }
                buffer = queue.poll(35, TimeUnit.SECONDS) ?: run { fail(); throw IOException("resource_read_timeout") }
                offset = 0
                if (failed) throw IOException("remote_resource_closed")
                if (buffer.isEmpty()) { finish(); return -1 }
            }
            val count = minOf(length, buffer.size - offset)
            buffer.copyInto(target, start, offset, offset + count); offset += count
            return count
        }
        fun fail() {
            failed = true; headers.completeExceptionally(IOException("remote_resource_closed"))
            queue.clear(); queue.offer(ByteArray(0))
        }
        private fun finish() {
            // Chromium 可再次读取 EOF；正常耗尽不能等同于被撤销或主动关闭。
            exhausted = true
            if (streams.remove(id, this)) slots.release()
        }
        override fun close() {
            fail()
            if (streams.remove(id, this)) {
                sendCurrent(JSONObject().put("type", "cancel").put("id", id))
                slots.release()
            }
        }
    }
}
