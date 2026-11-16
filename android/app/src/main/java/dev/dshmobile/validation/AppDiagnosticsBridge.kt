package dev.dshmobile.validation

import android.webkit.WebView
import android.app.Activity
import android.os.SystemClock
import androidx.webkit.ScriptHandler
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONObject

internal class AppDiagnosticsBridge(private val activity: Activity, private val log: AppDiagnostics, private val view: WebView, private val page: StartupScreen.Page) {
    private val mode = if (page == StartupScreen.Page.REMOTE) "remote" else "ordinary"
    private var stop: (() -> Unit)? = null
    private var stopCapture: (() -> Unit)? = null
    private var startScript: ScriptHandler? = null
    private var second = -1L
    private var messages = 0
    private var closed = false
    fun install() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return
        prepareStartScript()
        WebViewCompat.addWebMessageListener(view, "DSHMDiagnostics", setOf(page.origin)) { _, message, source, main, reply ->
            if (closed || !main || source.toString() != page.origin || view.url != page.url) return@addWebMessageListener
            val text = message.data ?: return@addWebMessageListener
            if (text.length > 48_000) return@addWebMessageListener
            runCatching {
                val request = JSONObject(text)
                when (request.getString("op")) {
                    "record" -> if (log.enabled && allowRecord()) log.web(mode, request.getJSONObject("entry"))
                    "read" -> log.read(request.optLong("after").coerceAtLeast(0)) {
                        if (!closed && view.url == page.url) runCatching { reply.postMessage(it.toString()) }
                    }
                    "copy" -> {
                        val id = request.getLong("id")
                        log.copy(activity, id) { copied ->
                            if (!closed && view.url == page.url) runCatching { reply.postMessage(JSONObject().put("copied", id).put("ok", copied).toString()) }
                        }
                    }
                    "watch" -> {
                        stop?.invoke()
                        stop = log.observe {
                            if (!closed && view.url == page.url) reply.postMessage("{\"changed\":true}")
                        }
                    }
                    "unwatch" -> { stop?.invoke(); stop = null }
                    "watchCapture" -> {
                        stopCapture?.invoke()
                        fun publish() {
                            if (!closed && view.url == page.url) reply.postMessage(captureState().toString())
                        }
                        stopCapture = log.observeCapture { prepareStartScript(); publish() }
                        publish()
                    }
                    "setCapture" -> {
                        val enabled = request.get("enabled") as? Boolean ?: return@addWebMessageListener
                        log.setEnabled(enabled)
                        reply.postMessage(captureState().put("updated", true).toString())
                    }
                }
            }
        }
    }
    private fun captureState() = JSONObject().put("captureEnabled", log.enabled)

    private fun prepareStartScript() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) return
        startScript?.remove()
        startScript = WebViewCompat.addDocumentStartJavaScript(view,
            "if (location.pathname === '/assets/web/${page.entry}') window.__dshmCaptureEnabled = ${log.enabled};", setOf(page.origin))
    }

    private fun allowRecord(): Boolean {
        val now = SystemClock.elapsedRealtime() / 1000
        if (second != now) { second = now; messages = 0 }
        return ++messages <= 96
    }

    fun close() {
        closed = true
        stop?.invoke(); stop = null
        stopCapture?.invoke(); stopCapture = null
        startScript?.remove(); startScript = null
    }
}
