package dev.dshmobile.validation

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.os.Bundle

/** 系统链接/分享的窄入口；外部 URI 从不交给 WebView 导航。 */
class PairingEntryActivity : Activity() {
    private var stopLanguage: (() -> Unit)? = null
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val raw = when (intent.action) {
            Intent.ACTION_VIEW -> intent.dataString
            Intent.ACTION_SEND -> if (intent.type == "text/plain") intent.getStringExtra(Intent.EXTRA_TEXT) else null
            else -> null
        }
        // 不把一次性 key 留在 Activity 状态和后续 Intent 中。
        intent.data = null
        intent.removeExtra(Intent.EXTRA_TEXT)
        val link = raw?.let(RemotePairLink::parse)
        if (link == null) return notice(R.string.remote_pair_invalid_title, R.string.remote_pair_invalid_note)
        if (RemoteIdentity(this).paired()) return notice(R.string.remote_pair_bound_title, R.string.remote_pair_bound_note)
        // 入口自己的任务栈随 finish 消失，避免 Android 将下一次分享直接交给栈顶 Remote。
        ModeNavigation.remote(this, RemotePairHandoff.offer(link))
        finish()
    }

    private fun notice(title: Int, message: Int) {
        val appearance = (application as DshmApplication).appearance
        val strings = appearance.localizedResources(this)
        val dialog = AlertDialog.Builder(appearance.dialogContext(this)).setTitle(strings.getString(title)).setMessage(strings.getString(message))
            .setPositiveButton(strings.getString(R.string.remote_pair_notice_close)) { _, _ -> finish() }
            .setOnCancelListener { finish() }.create()
        dialog.setOnDismissListener { stopLanguage?.invoke(); stopLanguage = null }
        dialog.show()
        stopLanguage = appearance.subscribe {
            val updated = appearance.localizedResources(this)
            dialog.setTitle(updated.getString(title)); dialog.setMessage(updated.getString(message))
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).text = updated.getString(R.string.remote_pair_notice_close)
        }
    }

    override fun onDestroy() {
        stopLanguage?.invoke(); stopLanguage = null
        super.onDestroy()
    }
}
