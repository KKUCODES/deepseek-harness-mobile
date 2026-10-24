package dev.dshmobile.validation

import android.app.Activity
import android.webkit.WebView
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONObject

/** 两个自有页面共享更新桥；更新操作不接受URL/路径，说明链接仅交给外部浏览器。 */
internal class AppUpdateBridge(private val activity: Activity, private val view: WebView, private val origin: String, private val page: String) {
    companion object {
        private val pages = mutableSetOf<AppUpdateBridge>()
        private var preparing = false
        fun prepareAll(complete: (String?) -> Unit) {
            if (preparing) return
            preparing = true
            val participants = pages.filter { !it.closed }
            var remaining = participants.size
            var finished = false
            val handler = android.os.Handler(android.os.Looper.getMainLooper())
            fun finish(failure: String?) {
                if (finished) return
                finished = true; preparing = false
                participants.forEach { it.prepared = null; it.preparationId = null }
                complete(failure)
            }
            handler.postDelayed({ finish("web_restart_save_failed") }, 10000)
            if (participants.isEmpty()) { finish("web_restart_save_failed"); return }
            for (bridge in participants) {
                val token = java.util.UUID.randomUUID().toString()
                bridge.preparationId = token
                bridge.prepared = { failure -> if (failure != null) finish(failure) else { remaining--; if (remaining == 0) finish(null) } }
                bridge.view.evaluateJavascript("""(async()=>{let op='updates.restartReady';try{if(typeof window.__dshmPrepareUpdate!=='function')throw Error();await window.__dshmPrepareUpdate()}catch(e){op=e.message==='web_restart_busy'?'updates.restartBusy':'updates.restartFailed'}window.DSHMUpdates.postMessage(JSON.stringify({id:'$token',op,data:{}}))})()""", null)
            }
        }
    }
    private var prepared: ((String?) -> Unit)? = null
    private var preparationId: String? = null
    private val updates get() = (activity.application as DshmApplication).updates
    private val resources get() = (activity.application as DshmApplication).webUpdates
    private var stop: (() -> Unit)? = null
    private var stopResources: (() -> Unit)? = null
    private var revision = 0L
    private fun snapshot() = updates.snapshot().put("resources", resources.snapshot()).put("revision", ++revision)
    private var closed = false
    fun install() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return
        pages.add(this)
        WebViewCompat.addWebMessageListener(view, "DSHMUpdates", setOf(origin)) { _, message, source, main, reply ->
            if (closed || !main || source.toString() != origin || view.url != "$origin/assets/web/$page") return@addWebMessageListener
            var id = ""
            try {
                val text = message.data ?: throw IllegalArgumentException()
                require(text.length <= 10000)
                val request = JSONObject(text); id = request.getString("id")
                require(id.matches(Regex("[a-zA-Z0-9-]{1,80}")))
                require(request.keys().asSequence().toSet() == setOf("id", "op", "data"))
                val data = request.getJSONObject("data")
                val operation = request.getString("op")
                require(if (operation == "updates.openLink") data.keys().asSequence().toSet() == setOf("url") else data.length() == 0)
                when (operation) {
                    "updates.watch" -> {
                        stop?.invoke(); stopResources?.invoke()
                        val notify = {
                            if (!closed && view.url == "$origin/assets/web/$page") runCatching {
                                reply.postMessage(JSONObject().put("event", snapshot()).toString())
                            }
                            Unit
                        }
                        stop = updates.observe(notify); stopResources = resources.observe(notify)
                    }
                    "updates.read" -> Unit
                    "updates.check" -> { updates.check(); resources.check() }
                    "updates.download" -> updates.download()
                    "updates.cancel" -> updates.cancel()
                    "updates.install" -> updates.install(activity)
                    "updates.openRelease" -> updates.openRelease(activity)
                    "updates.openLink" -> updates.openLink(activity, data.getString("url"))
                    "updates.resources.check" -> resources.check()
                    "updates.resources.download" -> resources.download()
                    "updates.resources.cancel" -> resources.cancel()
                    "updates.resources.recover" -> resources.recovery(activity)
                    "updates.resources.restart" -> resources.restart(activity)
                    "updates.restartReady", "updates.restartBusy", "updates.restartFailed" -> {
                        require(id == preparationId)
                        val callback = prepared ?: throw IllegalArgumentException()
                        prepared = null; preparationId = null
                        callback(if (operation == "updates.restartReady") null else if (operation == "updates.restartBusy") "web_restart_busy" else "web_restart_save_failed")
                    }
                    else -> throw IllegalArgumentException()
                }
                reply.postMessage(JSONObject().put("id", id).put("data", snapshot()).toString())
            } catch (_: Exception) { reply.postMessage(JSONObject().put("id", id).put("error", "update_bridge_failed").toString()) }
        }
    }
    fun close() { closed = true; pages.remove(this); prepared?.invoke("web_restart_save_failed"); prepared = null; stop?.invoke(); stopResources?.invoke(); stop = null; stopResources = null }
}
