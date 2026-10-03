package dev.dshmobile.validation

import android.app.Activity
import android.app.AlertDialog
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

/** 只记录保存结果尚未落定，不保存文件名、目标URI或读取目标文件的权限。 */
internal class RemoteSaveJournal(private val directory: File) {
    private val recovered = directory.listFiles().orEmpty()
        .filter { it.isFile && it.name.matches(Regex("[a-f0-9-]{36}\\.pending")) }.toMutableList()

    fun begin(): File {
        check(directory.isDirectory || directory.mkdirs())
        val marker = File(directory, "${UUID.randomUUID()}.pending")
        // 必须先同步记录再打开外部目标；进程被结束不会经过catch/finally。
        FileOutputStream(marker).use { it.write(1); it.fd.sync() }
        return marker
    }

    fun settled(marker: File) { marker.delete() }
    fun hasRecovered(): Boolean = recovered.isNotEmpty()
    fun acknowledge() { recovered.removeAll { it.delete() || !it.exists() } }
}

/** 普通首页、Remote/通知入口共用恢复提示；关闭页面不代表用户已经确认。 */
internal class RemoteSaveRecovery(private val journal: RemoteSaveJournal, private val appearance: PhoneAppearance) {
    private var owner: Activity? = null
    private var dialog: AlertDialog? = null
    fun resumed(activity: Activity) {
        if (activity !is ValidationActivity && activity !is RemoteActivity) return
        if (!journal.hasRecovered() || dialog != null || activity.isFinishing || activity.isDestroyed) return
        val context = appearance.dialogContext(activity)
        owner = activity
        dialog = AlertDialog.Builder(context)
            .setTitle(R.string.remote_save_recovery_title)
            .setMessage(R.string.remote_save_recovery_note)
            .setPositiveButton(R.string.remote_pair_notice_close) { _, _ -> journal.acknowledge() }
            .create().also { notice ->
                notice.setOnDismissListener { if (dialog === notice) { dialog = null; owner = null } }
                notice.show()
            }
    }
    fun paused(activity: Activity) { if (owner === activity) dialog?.dismiss() }
}
