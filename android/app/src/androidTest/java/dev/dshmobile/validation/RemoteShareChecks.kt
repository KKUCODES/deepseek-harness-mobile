package dev.dshmobile.validation

import android.content.Context
import android.content.Intent
import android.util.Base64
import androidx.core.content.FileProvider
import java.io.File
import java.util.UUID

object RemoteShareChecks {
    fun run(context: Context) {
        val source = File(context.cacheDir, "remote-share-test-source")
        val target = File(context.cacheDir, "remote-shares/checks-${UUID.randomUUID()}")
        var now = System.currentTimeMillis()
        val store = RemoteDownloadStore(source) { 1 }
        val shares = RemoteShareFiles(context, target, { now }, 64)
        try {
            val entry = store.begin("分享.txt")
            check(runCatching { shares.prepare(entry) { true } }.isFailure)
            val bytes = "independent share fixture".toByteArray()
            store.append(entry.id, 0, Base64.encodeToString(bytes, Base64.NO_WRAP)); store.finish(entry.id, bytes.size.toLong())
            check(runCatching { shares.prepare(entry) { false } }.isFailure)
            check(target.listFiles().orEmpty().isEmpty())
            var preparingChecked = false
            val snapshot = shares.prepare(entry) {
                if (!preparingChecked) {
                    val preparing = File(target.parentFile, "preparing-${target.name}")
                    val pending = preparing.walkTopDown().filter { it.isFile }.toList()
                    check(pending.size == 1)
                    // 同进程另一个窗口初始化，不能删除当前正在准备的文件。
                    RemoteShareFiles(context, target, { now }, 64)
                    check(pending.single().exists())
                    check(target.listFiles().orEmpty().isEmpty())
                    preparingChecked = true
                }
                true
            }
            check(preparingChecked)
            val intent = shares.intent(snapshot)
            check(intent.action == Intent.ACTION_SEND && intent.type == "text/plain")
            check(intent.flags == Intent.FLAG_GRANT_READ_URI_PERMISSION)
            check(intent.clipData!!.getItemAt(0).uri == snapshot.uri)
            check(snapshot.uri.scheme == "content")
            check(context.contentResolver.openInputStream(snapshot.uri)!!.use { it.readBytes().contentEquals(bytes) })
            check(runCatching { FileProvider.getUriForFile(context, "${context.packageName}.remote.files", entry.file) }.isFailure)
            val info = context.packageManager.resolveContentProvider("${context.packageName}.remote.files", 0)!!
            check(!info.exported && info.grantUriPermissions)
            val second = shares.prepare(entry) { true }
            check(runCatching { shares.prepare(entry) { true } }.isFailure)
            check(second.file.setLastModified(System.currentTimeMillis() - RemoteShareFiles.LIFETIME - 1000))
            check(runCatching { context.contentResolver.openInputStream(second.uri)!!.close() }.isFailure)
            shares.remove(second)
            store.abort(); check(snapshot.file.exists())
            now += RemoteShareFiles.LIFETIME
            shares.cleanExpired(); check(!snapshot.file.exists())
            check(target.listFiles().orEmpty().isEmpty())
        } finally { store.abort(); shares.cleanExpired(); source.delete(); target.delete(); File(target.parentFile, "preparing-${target.name}").delete() }
    }
}
