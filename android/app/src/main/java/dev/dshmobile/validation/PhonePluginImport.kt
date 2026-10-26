package dev.dshmobile.validation

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import org.json.JSONObject
import java.util.concurrent.Executors

/** 文件路径始终由系统选择器产生；网页不能指定URI，也不能跳过原生信任确认。 */
internal class PhonePluginImport(private val activity: Activity, private val store: PhonePluginStore) {
    companion object { const val REQUEST = 4812 }
    private val worker = Executors.newSingleThreadExecutor()
    private var reply: ((String?) -> Unit)? = null
    private var dialog: AlertDialog? = null
    private var closed = false
    fun pick(callback: (String?) -> Unit) {
        check(reply == null) { "picker_busy" }; reply = callback
        try { activity.startActivityForResult(Intent(Intent.ACTION_OPEN_DOCUMENT).apply { type = "*/*"; addCategory(Intent.CATEGORY_OPENABLE) }, REQUEST) }
        catch (_: Exception) { finish("picker_unavailable") }
    }
    private fun finish(error: String?) { val callback = reply; reply = null; callback?.invoke(error) }
    fun result(request: Int, result: Int, intent: Intent?): Boolean {
        if (request != REQUEST) return false
        if (reply == null || closed) return true
        val uri = intent?.data
        if (result != Activity.RESULT_OK || uri?.scheme != "content") { finish("picker_canceled"); return true }
        worker.execute {
            var data: JSONObject? = null; var error: String? = null
            try { data = activity.contentResolver.openInputStream(uri)?.use { PhonePluginPackages.parse(it) } ?: error("plugin_package_invalid") }
            catch (failure: Exception) { error = failure.message?.takeIf { it.startsWith("plugin_") } ?: "plugin_package_invalid" }
            activity.runOnUiThread {
                if (closed || reply == null) return@runOnUiThread
                if (error != null) { finish(error); return@runOnUiThread }
                val parsed = data!!
                dialog = AlertDialog.Builder(activity).setTitle("安装外部插件")
                    .setMessage("${parsed.getString("name")}  ${parsed.getString("version")}\n${parsed.getString("id")}\n\n${parsed.getString("description")}\n\n插件代码会在 DSHM 页面中运行，可能访问页面数据。仅安装你信任的来源。摘要校验不代表作者认证。")
                    .setNegativeButton("取消") { _, _ -> finish("picker_canceled") }
                    .setPositiveButton("信任并安装") { _, _ ->
                        try { store.installExternal(parsed); finish(null) }
                        catch (failure: Exception) { finish(failure.message?.takeIf { it.startsWith("plugin_") } ?: "plugin_operation_failed") }
                    }.setOnCancelListener { finish("picker_canceled") }.show()
            }
        }
        return true
    }
    fun close() { closed = true; dialog?.dismiss(); dialog = null; reply = null; worker.shutdown() }
}
