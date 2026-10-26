package dev.dshmobile.validation

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.text.InputType
import android.util.Base64
import android.view.View
import android.view.WindowManager
import android.webkit.WebView
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONArray
import org.json.JSONObject
import java.io.InputStream
import java.net.URL
import java.net.SocketTimeoutException
import java.util.concurrent.Executors
import javax.net.ssl.HttpsURLConnection

/** 仅本地普通聊天主框架可调用；请求只引用原生供应商，不接受临时 URL、Authorization 或工具。 */
class OrdinaryBridge(private val activity: Activity, private val webView: WebView) {
    private val providers = OrdinaryProviders(activity)
    private val files = OrdinaryFiles(activity)
    private val worker = Executors.newSingleThreadExecutor()
    private val closer = Executors.newSingleThreadExecutor()
    @Volatile private var closed = false
    @Volatile private var active: Request? = null
    private var dialog: AlertDialog? = null
    private var pending = 0
    private class Failure(val code: String) : Exception()
    private class Request(val id: String, val provider: JSONObject) {
        @Volatile var canceled = false
        @Volatile var connection: HttpsURLConnection? = null
        var body: InputStream? = null
        val started = System.nanoTime()
        var readPending = false
    }

    fun install() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return
        WebViewCompat.addWebMessageListener(webView, "DSHMOrdinary", setOf(ORIGIN)) { _, message, source, main, reply ->
            if (closed || !main || source.toString() != ORIGIN) return@addWebMessageListener
            var id = ""
            try {
                val text = message.data ?: throw Failure("invalid_request")
                if (text.length > 34 * 1024 * 1024 || pending >= 16) throw Failure("request_limit")
                val request = JSONObject(text)
                id = request.getString("id")
                if (!id.matches(Regex("[a-zA-Z0-9-]{1,80}"))) throw Failure("invalid_request")
                val data = request.optJSONObject("data") ?: JSONObject()
                when (request.getString("op")) {
                    "app.info" -> {
                        if (data.length() != 0 || webView.url != ORIGIN + "/assets/web/mobile.html") throw Failure("unsupported_operation")
                        respond(reply, id, AppInfo.read())
                    }
                    "appearance.write" -> {
                        if (webView.url != ORIGIN + "/assets/web/mobile.html") throw Failure("unsupported_operation")
                        (activity.application as DshmApplication).appearance.write(data)
                        respond(reply, id, JSONObject())
                    }
                    "notifications.settings" -> {
                        if (data.length() != 0) throw Failure("invalid_request")
                        (activity.application as DshmApplication).notices.settings(activity)
                        respond(reply, id, JSONObject())
                    }
                    "clipboard.write" -> {
                        if (data.keys().asSequence().toSet() != setOf("text")) throw Failure("invalid_request")
                        val value = data.get("text")
                        if (value !is String || value.length !in 1..4 * 1024 * 1024) throw Failure("request_limit")
                        val clipboard = activity.getSystemService(android.content.ClipboardManager::class.java)
                        clipboard.setPrimaryClip(android.content.ClipData.newPlainText("DSHM", value))
                        respond(reply, id, JSONObject())
                    }
                    "share.text" -> {
                        if (data.keys().asSequence().toSet() != setOf("text")) throw Failure("invalid_request")
                        val value = data.getString("text")
                        if (value.length !in 1..100_000) throw Failure("request_limit")
                        activity.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply {
                            type = "text/plain"; putExtra(Intent.EXTRA_TEXT, value)
                        }, "分享回复"))
                        respond(reply, id, JSONObject())
                    }
                    "links.open" -> {
                        if (data.keys().asSequence().toSet() != setOf("url")) throw Failure("invalid_request")
                        ExternalLinks.open(activity, data.get("url"))
                        respond(reply, id, JSONObject())
                    }
                    "cache.clear" -> {
                        if (data.length() != 0) throw Failure("invalid_request")
                        webView.clearCache(true)
                        (activity.application as DshmApplication).clearRemoteCaches()
                        respond(reply, id, JSONObject())
                    }
                    "files.pick" -> {
                        if (data.keys().asSequence().toSet() != setOf("kind")) throw Failure("invalid_request")
                        val kind = data.getString("kind")
                        if (kind !in setOf("photo", "file", "backup")) throw Failure("invalid_request")
                        files.pick(kind) { result, failure -> respond(reply, id, result, failure) }
                    }
                    "backup.save" -> {
                        if (data.keys().asSequence().toSet() != setOf("content")) throw Failure("invalid_request")
                        files.pick("export", data.getString("content")) { result, failure -> respond(reply, id, result, failure) }
                    }
                    "remote.open" -> {
                        if (active != null) throw Failure("request_busy")
                        respond(reply, id, JSONObject())
                        ModeNavigation.remote(activity)
                    }
                    "providers.list" -> {
                        if (data.length() != 0) throw Failure("invalid_request")
                        respond(reply, id, providers.catalog())
                    }
                    "providers.save", "providers.remove", "providers.default" -> {
                        if (webView.url != ORIGIN + "/assets/web/mobile.html") throw Failure("unsupported_operation")
                        if (active != null || dialog != null) throw Failure("request_busy")
                        when (request.getString("op")) {
                            "providers.save" -> providers.save(data)
                            "providers.remove" -> {
                                if (data.keys().asSequence().toSet() != setOf("provider", "revision")) throw Failure("invalid_request")
                                providers.remove(data.getString("provider"), data.getString("revision"))
                            }
                            else -> {
                                if (data.keys().asSequence().toSet() != setOf("provider", "model")) throw Failure("invalid_request")
                                providers.defaultSelection(data.getString("provider"), data.getString("model"))
                            }
                        }
                        respond(reply, id, providers.catalog())
                    }
                    "key.status", "key.configure" -> {
                        if (!setOf("provider").containsAll(data.keys().asSequence().toSet())) throw Failure("invalid_request")
                        val provider = providers.get(data.optString("provider", "deepseek"))
                        if (request.getString("op") == "key.status") respond(reply, id, JSONObject().put("configured", providers.credentials(provider.getString("id")).configured()))
                        else configure(reply, id, provider)
                    }
                    "request.cancel" -> {
                        active?.takeIf { it.id == data.optString("requestId") }?.let { cancel(it) }
                        respond(reply, id, JSONObject())
                    }
                    "request.open" -> {
                        if (active != null) throw Failure("request_busy")
                        val provider = providers.get(data.optString("provider", "deepseek"))
                        if (data.has("providerRevision") && data.getString("providerRevision") != provider.getString("revision")) throw Failure("provider_stale")
                        if (provider.getString("id") != "deepseek" && !data.has("providerRevision")) throw Failure("provider_stale")
                        val body = payload(data, provider)
                        val owner = data.getString("requestId")
                        if (!owner.matches(Regex("[a-zA-Z0-9-]{1,80}"))) throw Failure("invalid_request")
                        val job = Request(owner, provider)
                        active = job
                        execute(reply, id) { open(job, body) }
                    }
                    "request.read" -> {
                        val job = active?.takeIf { it.id == data.optString("requestId") && !it.canceled }
                            ?: throw Failure("request_closed")
                        if (job.readPending) throw Failure("read_busy")
                        job.readPending = true
                        execute(reply, id) {
                            try { read(job) } finally { activity.runOnUiThread { job.readPending = false } }
                        }
                    }
                    else -> throw Failure("unsupported_operation")
                }
            } catch (error: Exception) { respond(reply, id, error = code(error)) }
        }
    }

    private fun code(error: Exception) = when (error) {
        is Failure -> error.code
        is OrdinaryProviders.Failure -> error.code
        is ExternalLinks.Failure -> error.code
        is SocketTimeoutException -> "request_timeout"
        else -> "native_operation_failed" // 不将异常、请求头或上游错误正文传给插件/日志。
    }

    private fun respond(reply: JavaScriptReplyProxy, id: String, data: JSONObject? = null, error: String? = null) {
        if (closed || !WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return
        val value = JSONObject().put("id", id)
        if (error == null) value.put("data", data ?: JSONObject()) else value.put("error", error)
        try { reply.postMessage(value.toString()) } catch (_: Exception) { /* 页面已经离开。 */ }
    }

    private fun execute(reply: JavaScriptReplyProxy, id: String, task: () -> JSONObject) {
        pending++
        worker.execute {
            var result: JSONObject? = null
            var failure: String? = null
            try { result = task() } catch (error: Exception) { failure = code(error) }
            activity.runOnUiThread { pending--; respond(reply, id, result, failure) }
        }
    }

    private fun payload(data: JSONObject, provider: JSONObject): String {
        val fields = data.keys().asSequence().toSet()
        val required = setOf("requestId", "model", "messages")
        if (!fields.containsAll(required) || !required.plus(setOf("provider", "providerRevision", "thinking", "requestOptions")).containsAll(fields)) throw Failure("invalid_request")
        if (data.has("thinking") && data.get("thinking") !is Boolean) throw Failure("invalid_request")
        val thinking = data.optBoolean("thinking", false)
        val model = data.getString("model")
        val modelConfig = OrdinaryProviders.model(provider, model)
        val thinkingProtocol = modelConfig.getString("thinking")
        if (thinking && thinkingProtocol == "none") throw Failure("model_no_thinking")
        val messages = data.getJSONArray("messages")
        if (data.toString().length > 12 * 1024 * 1024) throw Failure("context_limit")
        if (messages.length() !in 1..200) throw Failure("context_limit")
        val clean = JSONArray()
        for (index in 0 until messages.length()) {
            val message = messages.getJSONObject(index)
            if (message.keys().asSequence().toSet() != setOf("role", "content")) throw Failure("invalid_message")
            val role = message.getString("role")
            if (role !in setOf("user", "assistant")) throw Failure("invalid_message")
            val content = message.get("content")
            if (content is String) {
                if (content.isEmpty() || content.length > 100_000) throw Failure("invalid_message")
                clean.put(JSONObject().put("role", role).put("content", content))
            } else {
                if (role != "user" || content !is JSONArray || content.length() !in 1..9) throw Failure("invalid_message")
                val blocks = JSONArray()
                for (part in 0 until content.length()) {
                    val block = content.getJSONObject(part)
                    when (block.optString("type")) {
                        "text" -> {
                            if (block.keys().asSequence().toSet() != setOf("type", "text")) throw Failure("invalid_message")
                            val value = block.getString("text")
                            if (value.isEmpty() || value.length > 100_000) throw Failure("context_limit")
                            blocks.put(JSONObject().put("type", "text").put("text", value))
                        }
                        "image_url" -> {
                            if (!modelConfig.getBoolean("vision")) throw Failure("model_no_vision")
                            if (block.keys().asSequence().toSet() != setOf("type", "image_url")) throw Failure("invalid_message")
                            val image = block.getJSONObject("image_url")
                            if (image.keys().asSequence().toSet() != setOf("url")) throw Failure("invalid_message")
                            val url = image.getString("url")
                            val match = Regex("^data:(image/(?:jpeg|png|gif|webp));base64,([A-Za-z0-9+/]+={0,2})$").matchEntire(url)
                                ?: throw Failure("invalid_image")
                            val bytes = Base64.decode(match.groupValues[2], Base64.NO_WRAP)
                            if (OrdinaryFiles.imageType(bytes) != match.groupValues[1]) throw Failure("invalid_image")
                            try { OrdinaryFiles.validateImage(bytes) } catch (_: Exception) { throw Failure("invalid_image") }
                            blocks.put(JSONObject().put("type", "image_url").put("image_url", JSONObject().put("url", url)))
                        }
                        else -> throw Failure("invalid_message")
                    }
                }
                clean.put(JSONObject().put("role", role).put("content", blocks))
            }
        }
        val options = if (data.has("requestOptions")) data.getJSONObject("requestOptions") else JSONObject()
        if (!setOf("maxTokens", "reasoningEffort", "temperature", "topP").containsAll(options.keys().asSequence().toSet())) throw Failure("invalid_preferences")
        fun number(name: String, fallback: Double, min: Double, max: Double): Double {
            val raw = if (options.has(name)) options.get(name) else fallback
            if (raw !is Number) throw Failure("invalid_preferences")
            val value = raw.toDouble()
            if (!value.isFinite() || value < min || value > max) throw Failure("invalid_preferences")
            return value
        }
        val maxTokens = if (options.isNull("maxTokens")) (if (thinking) 16384 else 8192) else {
            val value = number("maxTokens", 8192.0, 1.0, 393216.0)
            if (value != value.toInt().toDouble()) throw Failure("invalid_preferences")
            value.toInt()
        }
        val effort = options.optString("reasoningEffort", "high")
        if (effort !in setOf("low", "high", "max")) throw Failure("invalid_preferences")
        val temperature = number("temperature", 1.0, 0.0, 2.0)
        val topP = number("topP", 1.0, 0.95, 1.0)
        val body = JSONObject().put("model", model).put("messages", clean).put("stream", true)
        if (thinkingProtocol == "deepseek") {
            body.put("thinking", JSONObject().put("type", if (thinking) "enabled" else "disabled")).put("max_tokens", maxTokens)
            if (thinking) body.put("reasoning_effort", effort).put("top_p", topP) else body.put("temperature", temperature)
        } else {
            if (thinkingProtocol == "thinking") body.put("thinking", JSONObject().put("type", if (thinking) "enabled" else "disabled"))
            if (thinkingProtocol == "reasoning_effort" && thinking) body.put("reasoning_effort", if (effort == "max") "high" else effort)
            // 自定义服务默认沿用服务端参数；仅显式设置的通用参数进入请求。
            if (!options.isNull("maxTokens")) body.put(modelConfig.getString("tokenField"), maxTokens)
            if (data.has("requestOptions") && modelConfig.getBoolean("sampling") && !thinking) body.put("temperature", temperature)
        }
        return body.toString()
    }

    private fun open(job: Request, body: String): JSONObject {
        try {
            if (job.canceled) throw Failure("request_closed")
            val credentials = providers.credentials(job.provider.getString("id"))
            if (!credentials.configured()) throw Failure("key_missing")
            val secret = try { credentials.read() } catch (_: Exception) { throw Failure("credential_unavailable") }
            val connection = URL(OrdinaryProviders.baseURL(job.provider.getString("baseURL")) + "/chat/completions").openConnection() as HttpsURLConnection
            job.connection = connection
            connection.requestMethod = "POST"
            connection.instanceFollowRedirects = false
            connection.connectTimeout = 20_000
            connection.readTimeout = 90_000
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty("Accept", "text/event-stream")
            connection.setRequestProperty("Authorization", "Bearer $secret")
            if (job.canceled) throw Failure("request_closed")
            connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            val status = connection.responseCode
            val type = connection.contentType.orEmpty()
            if (job.canceled) throw Failure("request_closed")
            val result = JSONObject().put("status", status).put("contentType", type)
            if (status in 200..299 && type.substringBefore(';').trim().equals("text/event-stream", true)) {
                job.body = connection.inputStream
            } else { release(job) }
            return result
        } catch (error: Exception) { release(job); throw error }
    }

    private fun read(job: Request): JSONObject {
        try {
            if (job.canceled) throw Failure("request_closed")
            if ((System.nanoTime() - job.started) / 1_000_000 > 600_000) throw Failure("request_timeout")
            val buffer = ByteArray(8192)
            val count = (job.body ?: throw Failure("request_closed")).read(buffer)
            if (job.canceled) throw Failure("request_closed")
            if (count < 0) { release(job); return JSONObject().put("done", true) }
            // pull 才读取下一片，避免原生持续推送挤满主线程消息队列。
            return JSONObject().put("done", false).put("bytes", Base64.encodeToString(buffer, 0, count, Base64.NO_WRAP))
        } catch (error: Exception) { release(job); throw error }
    }

    private fun release(job: Request) {
        try { job.body?.close() } catch (_: Exception) { }
        job.connection?.disconnect()
        activity.runOnUiThread { if (active === job) active = null }
    }

    private fun cancel(job: Request) {
        job.canceled = true
        if (active === job) active = null
        closer.execute { job.connection?.disconnect() }
    }

    private fun configure(reply: JavaScriptReplyProxy, id: String, provider: JSONObject) {
        if (dialog != null || active != null) throw Failure("request_busy")
        val credentials = providers.credentials(provider.getString("id"))
        val dialogContext = (activity.application as DshmApplication).appearance.dialogContext(activity)
        val input = EditText(dialogContext).apply {
            isSingleLine = true
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
            transformationMethod = android.text.method.PasswordTransformationMethod.getInstance()
            importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS
            setSaveEnabled(false)
            hint = dialogContext.getString(R.string.key_hint)
        }
        val note = TextView(dialogContext).apply { text = "${provider.getString("name")}\n${provider.getString("baseURL")}\n\n${dialogContext.getString(R.string.key_note)}" }
        val layout = LinearLayout(dialogContext).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 16, 32, 16)
            addView(note); addView(input)
        }
        var answered = false
        fun finish(error: String? = null) {
            if (!answered) { answered = true; respond(reply, id, JSONObject().put("configured", credentials.configured()), error) }
        }
        dialog = AlertDialog.Builder(dialogContext).setTitle("${provider.getString("name")} · API Key").setView(layout)
            .setPositiveButton(R.string.key_save, null).setNegativeButton(R.string.key_cancel) { _, _ -> finish() }
            .setNeutralButton(R.string.key_remove) { _, _ ->
                try { credentials.clear(); finish() } catch (_: Exception) { finish("credential_save_failed") }
            }.create().apply {
                window?.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
                setOnDismissListener { input.text.clear(); finish(); dialog = null }
                show()
                getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                    val value = input.text.toString().trim()
                    if (value.length !in 8..512 || !value.all { it.code in 33..126 }) {
                        input.error = dialogContext.getString(R.string.key_invalid)
                    } else {
                        try { credentials.save(value); finish(); dismiss() }
                        catch (_: Exception) { note.setText(R.string.key_save_failed) }
                    }
                }
            }
    }

    fun pageLeaving() { active?.let { cancel(it) } }
    fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) = files.onResult(requestCode, resultCode, data)
    fun close() {
        closed = true
        files.close()
        dialog?.dismiss()
        pageLeaving()
        worker.shutdown()
        closer.shutdown()
    }

    companion object { const val ORIGIN = "https://appassets.androidplatform.net" }
}
