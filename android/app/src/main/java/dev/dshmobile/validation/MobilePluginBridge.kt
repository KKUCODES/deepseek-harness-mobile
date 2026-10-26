package dev.dshmobile.validation

import android.app.Activity
import android.content.Intent
import android.webkit.WebView
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONObject
import java.util.UUID

/** 只向两个自有主框架开放；电脑/插件子框架不能修改手机插件偏好。 */
internal class MobilePluginBridge(private val activity: Activity, private val view: WebView, private val origin: String, private val page: String) {
    private val owner = UUID.randomUUID().toString()
    private val preferences get() = (activity.application as DshmApplication).mobilePlugins
    private val plugins get() = (activity.application as DshmApplication).phonePlugins
    private var stop: (() -> Unit)? = null
    private var closed = false
    private val importer = PhonePluginImport(activity, plugins)
    fun onActivityResult(request: Int, result: Int, data: Intent?) = importer.result(request, result, data)
    fun install() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return
        WebViewCompat.addWebMessageListener(view, "DSHMMobilePlugins", setOf(origin)) { _, message, source, main, reply ->
            if (closed || !main || source.toString() != origin || view.url != "$origin/assets/web/$page") return@addWebMessageListener
            var id = ""
            try {
                val text = message.data ?: throw IllegalArgumentException()
                require(text.length <= 65536)
                val request = JSONObject(text); id = request.getString("id")
                require(id.matches(Regex("[a-zA-Z0-9-]{1,80}")))
                require(request.keys().asSequence().toSet() == setOf("id", "op", "data"))
                val data = request.getJSONObject("data")
                val op = request.getString("op")
                if (op.startsWith("plugins.")) {
                    val host = if (page == "remote.html") "remote" else "ordinary"
                    if (op == "plugins.import") {
                        require(host == "ordinary" && data.length() == 0)
                        val requestId = id
                        importer.pick { error -> if (!closed && view.url == "$origin/assets/web/$page") {
                            reply.postMessage(JSONObject().put("id", requestId).apply { if (error == null) put("data", plugins.snapshot()) else put("error", error) }.toString())
                        } }
                        return@addWebMessageListener
                    }
                    when (op) {
                        "plugins.watch" -> {
                            require(data.length() == 0); stop?.invoke()
                            stop = plugins.observe { if (!closed && view.url == "$origin/assets/web/$page") runCatching { reply.postMessage(JSONObject().put("event", plugins.snapshot()).toString()) } }
                        }
                        "plugins.initialize" -> plugins.initialize(host, data)
                        "plugins.restore" -> { require(host == "ordinary"); plugins.restorePreinstalled(data) }
                        "plugins.change" -> plugins.change(data)
                        "plugins.claim" -> plugins.claim(owner, host, data)
                        "plugins.runtime" -> plugins.report(owner, host, data)
                        "plugins.release" -> {
                            require(data.keys().asSequence().toSet() == setOf("lease"))
                            plugins.release(owner, host, data.getString("lease"))
                        }
                        else -> throw IllegalArgumentException()
                    }
                    reply.postMessage(JSONObject().put("id", id).put("data", plugins.snapshot()).toString())
                    return@addWebMessageListener
                }
                when (request.getString("op")) {
                    "watch" -> {
                        require(data.length() == 0); stop?.invoke()
                        stop = preferences.observe {
                            if (!closed && view.url == "$origin/assets/web/$page") runCatching { reply.postMessage(JSONObject().put("event", preferences.snapshot()).toString()) }
                        }
                    }
                    "select" -> preferences.select(data)
                    "initialize" -> { require(page == "remote.html"); preferences.select(data, onlyIfMissing = true) }
                    "runtime" -> { require(page == "remote.html"); preferences.report(owner, data) }
                    else -> throw IllegalArgumentException()
                }
                reply.postMessage(JSONObject().put("id", id).put("data", preferences.snapshot()).toString())
            } catch (_: Exception) { reply.postMessage(JSONObject().put("id", id).put("error", "mobile_plugins_failed").toString()) }
        }
    }
    fun close() { closed = true; importer.close(); stop?.invoke(); stop = null; preferences.release(owner); plugins.release(owner) }
}
