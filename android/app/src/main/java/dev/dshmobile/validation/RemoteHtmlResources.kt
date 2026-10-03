package dev.dshmobile.validation

import android.content.Context
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.File
import java.io.FilterInputStream
import java.io.IOException
import java.util.concurrent.Executors

/** 仅承接主页面已打包的 HTML。独立来源没有凭据桥，也不按 iframe 消息读取电脑文件。 */
class RemoteHtmlResources(context: Context, private val generation: () -> Int?) {
    private val store = RemoteDownloadStore(File(context.cacheDir, "remote-html"), 64L * 1024 * 1024, generation)
    private val main = Handler(Looper.getMainLooper())
    private val worker = Executors.newSingleThreadExecutor()
    private val streams = mutableMapOf<FilterInputStream, String>()
    @Volatile private var active: String? = null
    @Volatile private var closed = false
    private var pending = 0
    val isActive: Boolean get() = active != null

    fun dispatch(op: String, data: JSONObject, reply: (JSONObject?, String?) -> Unit) {
        if (closed) { reply(null, "html_expired"); return }
        if (op == "html.close") {
            release(data.optString("previewId")); reply(JSONObject(), null); return
        }
        if (pending >= 4) { reply(null, "html_busy"); return }
        pending++
        val owner = generation()
        worker.execute {
            var value: JSONObject? = null; var failure: String? = null
            try {
                if (owner == null || owner != generation()) throw RemoteDownloadStore.Failure("html_expired")
                value = when (op) {
                    "html.begin" -> JSONObject().put("previewId", store.begin("preview.html", owner).id)
                    "html.chunk" -> JSONObject().put("bytes", store.append(data.getString("previewId"), data.getLong("offset"), data.getString("data")))
                    "html.finish" -> {
                        val id = data.getString("previewId")
                        store.finish(id, data.getLong("bytes"))
                        JSONObject().put("url", "$ORIGIN/document/$id.html")
                    }
                    else -> throw RemoteDownloadStore.Failure("unsupported_operation")
                }
            } catch (error: Exception) { failure = if (error is RemoteDownloadStore.Failure) error.code else "html_failed" }
            main.post {
                pending--
                if (closed || owner != generation()) {
                    value?.optString("previewId")?.takeIf { it.isNotEmpty() }?.let(::release)
                    if (!closed) reply(null, "html_expired")
                } else if (op == "html.finish" && failure == null) {
                    try { val id = data.getString("previewId"); store.entry(id); active = id; reply(value, null) }
                    catch (_: Exception) { reply(null, "html_expired") }
                } else reply(value, failure)
            }
        }
    }

    fun owns(uri: Uri): Boolean = uri.scheme == "https" && uri.encodedAuthority == "preview.dshm.invalid" &&
        uri.query == null && uri.fragment == null && active != null && uri.path == "/document/$active.html"

    fun intercept(request: WebResourceRequest): WebResourceResponse? {
        if (request.url.host != "preview.dshm.invalid") return null
        if (request.isForMainFrame || request.method != "GET" || !owns(request.url)) return denied()
        return try {
            val entry = store.entry(active ?: return denied())
            if (!entry.complete) return denied()
            val stream = object : FilterInputStream(entry.file.inputStream()) {
                @Volatile private var ended = false
                private fun valid() { if (ended || closed || entry.canceled || generation() != entry.owner) throw IOException("HTML preview expired") }
                override fun read(): Int { valid(); return super.read() }
                override fun read(bytes: ByteArray, offset: Int, length: Int): Int { valid(); return super.read(bytes, offset, length) }
                override fun close() { ended = true; super.close(); synchronized(streams) { streams.remove(this) } }
            }
            synchronized(streams) {
                if (streams.size >= 4 || closed || entry.canceled || generation() != entry.owner) { stream.close(); return denied() }
                streams[stream] = entry.id
            }
            WebResourceResponse("text/html", "UTF-8", 200, "OK", mapOf(
                "Content-Security-Policy" to CSP, "Cache-Control" to "no-store", "X-Content-Type-Options" to "nosniff",
                "Permissions-Policy" to "camera=(), microphone=(), geolocation=(), clipboard-read=(), clipboard-write=()",
            ), stream)
        } catch (_: Exception) { denied() }
    }
    private fun denied() = WebResourceResponse("text/plain", "UTF-8", 403, "Blocked", mapOf("Cache-Control" to "no-store"), ByteArrayInputStream(ByteArray(0)))
    private fun release(id: String? = null) {
        store.abort(id)
        if (id == null || active == id) active = null
        val closing = synchronized(streams) { streams.filterValues { id == null || it == id }.keys.toList() }
        closing.forEach { runCatching { it.close() } }
    }
    fun cancel() = release()
    fun close() { closed = true; cancel(); worker.shutdown() }
    companion object {
        const val ORIGIN = "https://preview.dshm.invalid"
        const val CSP = "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob:; style-src 'unsafe-inline' blob:; img-src data: blob:; font-src data: blob:; connect-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'"
    }
}
