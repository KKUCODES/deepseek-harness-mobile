package dev.dshmobile.validation

import android.app.Activity
import android.webkit.WebView
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONObject

/** 两个自有页面共享更新桥；更新操作不接受URL/路径，说明链接仅交给外部浏览器。 */
internal class AppUpdateBridge(private val activity: Activity, private val view: WebView, private val origin: String, private val page: String) {
    private val updates get() = (activity.application as DshmApplication).updates
    private var stop: (() -> Unit)? = null
    private var closed = false
    fun install() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return
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
                        stop?.invoke()
                        stop = updates.observe {
                            if (!closed && view.url == "$origin/assets/web/$page") runCatching {
                                reply.postMessage(JSONObject().put("event", updates.snapshot()).toString())
                            }
                        }
                    }
                    "updates.read" -> Unit
                    "updates.check" -> updates.check()
                    "updates.download" -> updates.download()
                    "updates.cancel" -> updates.cancel()
                    "updates.install" -> updates.install(activity)
                    "updates.openRelease" -> updates.openRelease(activity)
                    "updates.openLink" -> updates.openLink(activity, data.getString("url"))
                    else -> throw IllegalArgumentException()
                }
                reply.postMessage(JSONObject().put("id", id).put("data", updates.snapshot()).toString())
            } catch (_: Exception) { reply.postMessage(JSONObject().put("id", id).put("error", "update_bridge_failed").toString()) }
        }
    }
    fun close() { closed = true; stop?.invoke(); stop = null }
}
