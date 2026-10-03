package dev.dshmobile.validation

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.webkit.ValueCallback
import android.webkit.WebChromeClient

/** 原文件输入插件仍接收 File；原生只交还系统选择器授予的 content URI，不接收网页路径。 */
class RemoteFileChooser(private val activity: Activity, private val generation: () -> Int?) {
    private var pending: ValueCallback<Array<Uri>>? = null
    private var owner: Int? = null

    fun open(callback: ValueCallback<Array<Uri>>, params: WebChromeClient.FileChooserParams): Boolean {
        cancel()
        val current = generation()
        if (current == null || params.mode !in setOf(WebChromeClient.FileChooserParams.MODE_OPEN,
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
        pending = callback
        owner = current
        try { activity.startActivityForResult(intent, REQUEST) }
        catch (_: Exception) { cancel() }
        return true
    }

    fun onResult(requestCode: Int, resultCode: Int, data: Intent?): Boolean {
        if (requestCode != REQUEST) return false
        val callback = pending ?: return true
        pending = null
        val stillConnected = owner != null && owner == generation()
        owner = null
        val selected = WebChromeClient.FileChooserParams.parseResult(resultCode, data)
        val safe = stillConnected && selected != null && selected.size in 1..10 && selected.all {
            it.scheme == "content" && !it.authority.orEmpty().startsWith(activity.packageName)
        }
        // 切页、断线或重新绑定后，旧选择结果不能进入另一代电脑连接。
        callback.onReceiveValue(if (safe) selected else null)
        return true
    }

    fun cancel() { val callback = pending; pending = null; owner = null; callback?.onReceiveValue(null) }

    companion object { const val REQUEST = 4103 }
}
