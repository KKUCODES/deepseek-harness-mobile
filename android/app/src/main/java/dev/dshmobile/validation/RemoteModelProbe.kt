package dev.dshmobile.validation

import android.app.Activity
import android.app.AlertDialog
import android.os.Handler
import android.os.Looper
import android.text.InputFilter
import android.text.InputType
import android.view.View
import android.view.WindowManager
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import org.json.JSONObject
import java.net.URI
import java.util.UUID

/** 临时Key仅进入原生请求；先由Host确认目标，再展示密码窗口，不复用保存Key的写入流程。 */
internal class RemoteModelProbe(
    private val activity: Activity,
    private val generation: () -> Int?,
    private val send: (JSONObject) -> Boolean,
    private val insecure: () -> Boolean,
) {
    private val appearance = (activity.application as DshmApplication).appearance
    private val strings get() = appearance.localizedResources(activity)
    private val handler = Handler(Looper.getMainLooper())
    private var complete: ((JSONObject?, String?) -> Unit)? = null
    private var owner: Int? = null
    private var requestId: String? = null
    private var preparing = false
    private var target = ""
    private var api = ""
    private var dialog: AlertDialog? = null
    private var input: EditText? = null
    private var timeout: Runnable? = null
    private var stopLanguage: (() -> Unit)? = null
    private val ownedIds = LinkedHashSet<String>()

    fun open(data: JSONObject, reply: (JSONObject?, String?) -> Unit) {
        if (complete != null) { reply(null, "remote_settings_busy"); return }
        val url = data.opt("baseURL") as? String
        val protocol = data.opt("api") as? String
        val valid = try {
            val parsed = URI(url ?: "")
            url != null && url.length in 1..2048 && !url.any { it.isWhitespace() || it.code < 32 || it.code == 127 || it == '\\' }
                && parsed.scheme in setOf("http", "https") && parsed.host != null && parsed.userInfo == null && parsed.query == null && parsed.fragment == null
        } catch (_: Exception) { false }
        if (data.keys().asSequence().toSet() != setOf("baseURL", "api") || !valid || protocol !in setOf("openai-completions", "openai-responses", "anthropic-messages")) {
            reply(null, "remote_model_probe_invalid"); return
        }
        owner = generation()
        if (owner == null) { reply(null, "remote_not_connected"); return }
        complete = reply; target = url!!; api = protocol!!; preparing = true
        request(JSONObject().put("method", "remote.modelProbePrepare").put("baseURL", target).put("api", api)
            .put("authentication", JSONObject().put("mode", "temporary")))
    }
    private fun request(operation: JSONObject) {
        if (generation() != owner) { finish(null, "remote_not_connected"); return }
        val id = UUID.randomUUID().toString(); requestId = id
        synchronized(ownedIds) { ownedIds.add(id); while (ownedIds.size > 128) ownedIds.remove(ownedIds.first()) }
        if (!send(JSONObject().put("type", "request").put("id", id).put("operation", operation))) {
            finish(null, "remote_not_connected"); return
        }
        timeout = Runnable {
            send(JSONObject().put("type", "cancel").put("id", id)); finish(null, "remote_model_discovery_failed")
        }.also { handler.postDelayed(it, 35000) }
    }
    fun owns(frame: JSONObject) = synchronized(ownedIds) { ownedIds.contains(frame.optString("id")) }
    fun receive(frame: JSONObject) {
        if (frame.optString("id") != requestId || complete == null) return
        timeout?.let(handler::removeCallbacks); timeout = null; requestId = null
        if (generation() != owner) { finish(null, "remote_not_connected"); return }
        if (frame.optString("type") != "result") { finish(null, "remote_model_discovery_failed"); return }
        try {
            val value = frame.getJSONObject("value")
            if (preparing) {
                check(value.keys().asSequence().toSet() == setOf("snapshot", "expiresAt", "baseURL", "api", "authentication"))
                check(value.getString("baseURL") == target && value.getString("api") == api)
                val authentication = value.getJSONObject("authentication")
                check(authentication.keys().asSequence().toSet() == setOf("mode") && authentication.getString("mode") == "temporary")
                val snapshot = value.getString("snapshot"); UUID.fromString(snapshot)
                check(value.getLong("expiresAt") > System.currentTimeMillis())
                preparing = false; show(snapshot)
            } else {
                // 只接收固定公开结果；错误正文和额外字段不会进入WebView。
                check(value.keys().asSequence().toSet() == setOf("rows"))
                val rows = value.getJSONArray("rows"); check(rows.length() <= 1000)
                val ids = mutableSetOf<String>()
                for (i in 0 until rows.length()) {
                    val row = rows.getJSONObject(i)
                    check(row.keys().asSequence().all { it in setOf("id", "name", "contextWindow", "maxTokens", "inputModalities") })
                    val id = row.get("id"); check(id is String && id.length in 1..1024 && ids.add(id))
                    if (row.has("name")) check(row.get("name") is String && row.getString("name").length <= 1024)
                    for (field in listOf("contextWindow", "maxTokens")) if (row.has(field)) {
                        val number = row.get(field); check(number is Number && number.toDouble() > 0 && number.toDouble() <= 9007199254740991.0 && number.toDouble() == number.toLong().toDouble())
                    }
                    if (row.has("inputModalities")) {
                        val modes = row.getJSONArray("inputModalities"); check(modes.length() <= 2)
                        for (j in 0 until modes.length()) check(modes.get(j) in setOf("text", "image"))
                    }
                }
                finish(JSONObject().put("rows", rows), null)
            }
        } catch (_: Exception) { finish(null, "remote_model_discovery_failed") }
    }
    private fun show(snapshot: String) {
        val context = appearance.dialogContext(activity)
        val editor = EditText(context).apply {
            isSingleLine = true; inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
            importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS; isSaveEnabled = false
            filters = arrayOf(InputFilter.LengthFilter(8192)); hint = strings.getString(R.string.remote_key_hint)
        }
        input = editor
        val note = TextView(context)
        fun refresh() {
            dialog?.setTitle(strings.getString(R.string.remote_probe_title))
            note.text = if (requestId != null) strings.getString(R.string.remote_probe_loading) else
                strings.getString(R.string.remote_probe_note) + "\n" + target + "\n" + api + if (insecure() || target.startsWith("http:")) "\n" + strings.getString(R.string.remote_key_http) else ""
            dialog?.getButton(AlertDialog.BUTTON_POSITIVE)?.text = strings.getString(R.string.remote_probe_start)
            dialog?.getButton(AlertDialog.BUTTON_NEGATIVE)?.text = strings.getString(R.string.key_cancel)
            editor.hint = strings.getString(R.string.remote_key_hint)
        }
        val layout = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL; setPadding(32, 16, 32, 16); addView(note); addView(editor) }
        dialog = AlertDialog.Builder(context).setTitle(strings.getString(R.string.remote_probe_title)).setView(layout)
            .setPositiveButton(strings.getString(R.string.remote_probe_start), null)
            .setNegativeButton(strings.getString(R.string.key_cancel)) { _, _ -> cancel() }.create()
        dialog?.setOnDismissListener { if (complete != null) cancel() }
        dialog?.show(); dialog?.window?.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        refresh()
        dialog?.getButton(AlertDialog.BUTTON_POSITIVE)?.setOnClickListener {
            val key = editor.text.toString()
            if (key.isEmpty() || !key.all { it.code in 33..126 }) { editor.error = strings.getString(R.string.remote_key_invalid); return@setOnClickListener }
            editor.text.clear(); editor.isEnabled = false
            dialog?.getButton(AlertDialog.BUTTON_POSITIVE)?.isEnabled = false
            request(JSONObject().put("method", "remote.modelProbeExecute").put("snapshot", snapshot).put("confirmed", true).put("mode", "temporary").put("apiKey", key))
            refresh()
        }
        stopLanguage = appearance.subscribe { handler.post { if (dialog?.isShowing == true) refresh() } }
    }
    fun cancel() {
        requestId?.let { send(JSONObject().put("type", "cancel").put("id", it)) }
        finish(JSONObject().put("cancelled", true), null)
    }
    private fun finish(value: JSONObject?, error: String?) {
        timeout?.let(handler::removeCallbacks); timeout = null
        stopLanguage?.invoke(); stopLanguage = null
        val reply = complete; complete = null; requestId = null
        input?.text?.clear(); input = null; dialog?.dismiss(); dialog = null
        target = ""; api = ""; owner = null
        reply?.invoke(value, error)
    }
}
