package dev.dshmobile.validation

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.widget.Toast

/** 原文件输入插件仍接收 File；原生只交还系统选择器授予的 content URI，不接收网页路径。 */
class RemoteFileChooser(
    private val activity: Activity,
    private val generation: () -> Int?,
    private val launch: (Intent, Int) -> Unit = activity::startActivityForResult,
    private val onSelectionExpired: () -> Unit = {
        Toast.makeText(activity, R.string.remote_file_selection_expired, Toast.LENGTH_LONG).show()
    },
) {
    private class Selection(val owner: Int, var callback: ValueCallback<Array<Uri>>?)
    private var pending: Selection? = null

    fun open(callback: ValueCallback<Array<Uri>>, params: WebChromeClient.FileChooserParams): Boolean {
        val current = generation()
        if (pending != null || current == null || params.mode !in setOf(WebChromeClient.FileChooserParams.MODE_OPEN,
                WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE)) {
            callback.onReceiveValue(null)
            return true
        }
        val accepted = params.acceptTypes.filter { it.matches(Regex("[a-zA-Z0-9.+-]+/[a-zA-Z0-9.+*-]+")) }
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = accepted.singleOrNull() ?: "*/*"
            if (accepted.size > 1) putExtra(Intent.EXTRA_MIME_TYPES, accepted.toTypedArray())
            putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.mode == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        pending = Selection(current, callback)
        try { launch(intent, REQUEST) }
        catch (_: Exception) { pending = null; callback.onReceiveValue(null) }
        return true
    }

    fun onResult(requestCode: Int, resultCode: Int, data: Intent?): Boolean {
        if (requestCode != REQUEST) return false
        val selection = pending
        pending = null
        val selected = WebChromeClient.FileChooserParams.parseResult(resultCode, data)
        val callback = selection?.callback
        val expired = callback == null || selection?.owner != generation()
        val safe = !expired && selected != null && selected.size in 1..10 && selected.all {
            it.scheme == "content" && !it.authority.orEmpty().startsWith(activity.packageName)
        }
        // 切页、断线或重新绑定后，旧选择结果不能进入另一代电脑连接。
        callback?.onReceiveValue(if (safe) selected else null)
        if (expired && !selected.isNullOrEmpty()) onSelectionExpired()
        return true
    }

    fun cancel() {
        // 保留这次系统请求的归属，直到结果返回，防止旧结果交给新的 WebView 回调。
        val selection = pending ?: return
        val callback = selection.callback
        selection.callback = null
        callback?.onReceiveValue(null)
    }

    companion object { const val REQUEST = 4103 }
}
