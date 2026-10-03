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
import java.util.UUID

/** 密钥只经过原生输入框和已绑定中继；页面只收到配置状态，不收到输入值。 */
internal class RemoteComputerKey(
    private val activity: Activity,
    private val generation: () -> Int?,
    private val send: (JSONObject) -> Boolean,
    private val insecure: () -> Boolean,
    private val appearance: PhoneAppearance = (activity.application as DshmApplication).appearance,
) {
    private val strings get() = appearance.localizedResources(activity)
    private val handler = Handler(Looper.getMainLooper())
    private var dialog: AlertDialog? = null
    private var input: EditText? = null
    private var complete: ((JSONObject?, String?) -> Unit)? = null
    private var requestId: String? = null
    private var owner: Int? = null
    private var uncertainOwner: Int? = null
    private var timeout: Runnable? = null
    private var searchTarget = false
    private var providerTarget: String? = null
    private val ownedIds = LinkedHashSet<String>()

    fun open(data: JSONObject, reply: (JSONObject?, String?) -> Unit) {
        if (dialog != null || complete != null) { reply(null, "remote_key_busy"); return }
        val fields = data.keys().asSequence().toSet()
        if (fields != setOf("snapshot") && fields != setOf("snapshot", "target")) { reply(null, "remote_key_invalid"); return }
        val target = data.opt("target")
        val route = (target as? JSONObject)?.opt("provider") as? String
        if (data.has("target") && target != "web-search-deepseek" && (target !is JSONObject
            || target.keys().asSequence().toSet() != setOf("provider") || route.isNullOrEmpty() || route.length > 256
            || route in setOf("__proto__", "prototype", "constructor") || route.any { it.code < 32 || it.code == 127 })) {
            reply(null, "remote_key_invalid"); return
        }
        val snapshot = data.optString("snapshot")
        try { UUID.fromString(snapshot) } catch (_: Exception) { reply(null, "remote_key_invalid"); return }
        val current = generation()
        if (current == null) { reply(null, "remote_not_connected"); return }
        if (uncertainOwner == current) { reply(null, "remote_key_write_unconfirmed"); return }
        owner = current; complete = reply; searchTarget = target == "web-search-deepseek"; providerTarget = route
        fun titleText() = if (providerTarget != null) strings.getString(R.string.remote_provider_key_title, providerTarget)
            else strings.getString(if (searchTarget) R.string.remote_search_key_title else R.string.remote_key_title)
        val dialogContext = appearance.dialogContext(activity)
        val editor = EditText(dialogContext).apply {
            isSingleLine = true
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
            transformationMethod = android.text.method.PasswordTransformationMethod.getInstance()
            importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS
            isSaveEnabled = false
            filters = arrayOf(InputFilter.LengthFilter(8192))
            hint = strings.getString(R.string.remote_key_hint)
        }
        input = editor
        var removing = false
        var stopLanguage: (() -> Unit)? = null
        fun noteText(): String = strings.let {
            when {
                requestId != null -> it.getString(R.string.remote_key_saving)
                removing -> it.getString(if (providerTarget != null) R.string.remote_provider_key_remove_note else if (searchTarget) R.string.remote_search_key_remove_note else R.string.remote_key_remove_note)
                else -> it.getString(if (providerTarget != null) R.string.remote_provider_key_note else if (searchTarget) R.string.remote_search_key_note else R.string.remote_key_note) + if (insecure()) "\n" + it.getString(R.string.remote_key_http) else ""
            }
        }
        val note = TextView(dialogContext).apply { text = noteText() }
        val layout = LinearLayout(dialogContext).apply {
            orientation = LinearLayout.VERTICAL; setPadding(32, 16, 32, 16); addView(note); addView(editor)
        }
        dialog = AlertDialog.Builder(dialogContext).setTitle(titleText()).setView(layout)
            .setPositiveButton(strings.getString(R.string.remote_key_save), null).setNegativeButton(strings.getString(R.string.key_cancel)) { _, _ -> finish(JSONObject().put("cancelled", true), null) }
            .setNeutralButton(strings.getString(R.string.remote_key_remove), null).create().apply {
                window?.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
                setOnDismissListener {
                    stopLanguage?.invoke(); stopLanguage = null
                    editor.text.clear()
                    if (complete != null) cancel()
                    dialog = null; input = null
                }
                show()
                getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                    val value = editor.text.toString()
                    if (value.isEmpty() || value.length > 8192 || !value.all { it.code in 33..126 }) editor.error = strings.getString(R.string.remote_key_invalid)
                    else submit(snapshot, JSONObject().put("op", "set").put("value", value), note)
                }
                // 移除需要再次明确确认，不能把空输入解释为删除。
                getButton(AlertDialog.BUTTON_NEUTRAL).setOnClickListener {
                    editor.text.clear(); editor.isEnabled = false
                    removing = true; note.text = noteText()
                    getButton(AlertDialog.BUTTON_POSITIVE).isEnabled = false
                    getButton(AlertDialog.BUTTON_NEUTRAL).text = strings.getString(R.string.remote_key_confirm_remove)
                    getButton(AlertDialog.BUTTON_NEUTRAL).setOnClickListener { submit(snapshot, JSONObject().put("op", "unset"), note) }
                }
                stopLanguage = appearance.subscribe { handler.post {
                    if (isShowing) {
                        setTitle(titleText())
                        editor.hint = strings.getString(R.string.remote_key_hint)
                        if (editor.error != null) editor.error = strings.getString(R.string.remote_key_invalid)
                        note.text = noteText()
                        // 只更新标签，不重建密码框、改变确认状态或解除在途提交锁。
                        getButton(AlertDialog.BUTTON_POSITIVE).text = strings.getString(R.string.remote_key_save)
                        getButton(AlertDialog.BUTTON_NEGATIVE).text = strings.getString(R.string.key_cancel)
                        getButton(AlertDialog.BUTTON_NEUTRAL).text = strings.getString(if (removing) R.string.remote_key_confirm_remove else R.string.remote_key_remove)
                    }
                } }
            }
    }

    private fun submit(snapshot: String, change: JSONObject, note: TextView) {
        if (requestId != null) return
        if (generation() != owner) { finish(null, "remote_not_connected"); return }
        val id = UUID.randomUUID().toString()
        requestId = id
        synchronized(ownedIds) {
            ownedIds.add(id)
            while (ownedIds.size > 128) ownedIds.remove(ownedIds.first())
        }
        input?.text?.clear()
        listOf(AlertDialog.BUTTON_POSITIVE, AlertDialog.BUTTON_NEGATIVE, AlertDialog.BUTTON_NEUTRAL).forEach { dialog?.getButton(it)?.isEnabled = false }
        dialog?.setCancelable(false); note.text = strings.getString(R.string.remote_key_saving)
        val operation = JSONObject().put("method", "remote.keyWrite").put("snapshot", snapshot).put("change", change)
        if (searchTarget) operation.put("target", "web-search-deepseek")
        providerTarget?.let { operation.put("target", JSONObject().put("provider", it)) }
        val frame = JSONObject().put("type", "request").put("id", id).put("operation", operation)
        if (!send(frame)) { uncertainOwner = owner; finish(null, "remote_key_write_unconfirmed"); return }
        timeout = Runnable {
            uncertainOwner = owner
            send(JSONObject().put("type", "cancel").put("id", id))
            finish(null, "remote_key_write_unconfirmed")
        }.also { handler.postDelayed(it, 35000) }
    }

    /** 在 WebView 收到 socket 消息之前消费；只投影固定字段和错误码。 */
    fun owns(frame: JSONObject): Boolean = synchronized(ownedIds) { ownedIds.contains(frame.optString("id")) }
    fun receive(frame: JSONObject): Boolean {
        val id = frame.optString("id")
        if (!owns(frame)) return false
        if (id != requestId || complete == null) return true
        if (generation() != owner) { uncertainOwner = owner; finish(null, "remote_key_write_unconfirmed"); return true }
        val error = frame.optString("code")
        if (frame.optString("type") == "error" && error in setOf("management_required", "remote_key_stale", "remote_key_read_only", "remote_key_busy", "remote_key_invalid")) {
            finish(null, error); return true
        }
        val view = frame.optJSONObject("value")
        val expectedProvider = providerTarget ?: if (searchTarget) "deepseek-search" else "deepseek-official"
        val targetMatches = if (providerTarget == null) view?.has("target") == false
            else view?.optJSONObject("target")?.let { it.keys().asSequence().toSet() == setOf("provider") && it.optString("provider") == providerTarget } == true
        if (frame.optString("type") == "result" && targetMatches && view?.optString("provider") == expectedProvider && view.opt("configured") is Boolean && view.opt("writable") is Boolean) {
            finish(JSONObject().put("configured", view.getBoolean("configured")).put("writable", view.getBoolean("writable")), null)
        } else { uncertainOwner = owner; finish(null, "remote_key_write_unconfirmed") }
        return true
    }
    fun cancel() {
        if (requestId != null) {
            uncertainOwner = owner
            send(JSONObject().put("type", "cancel").put("id", requestId))
            finish(null, "remote_key_write_unconfirmed")
        } else finish(JSONObject().put("cancelled", true), null)
    }
    private fun finish(value: JSONObject?, error: String?) {
        timeout?.let(handler::removeCallbacks); timeout = null
        val reply = complete; complete = null; requestId = null
        input?.text?.clear(); dialog?.dismiss(); dialog = null; input = null
        reply?.invoke(value, error)
    }
}
