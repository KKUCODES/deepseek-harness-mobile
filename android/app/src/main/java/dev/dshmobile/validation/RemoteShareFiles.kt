package dev.dshmobile.validation

import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.webkit.MimeTypeMap
import androidx.core.content.FileProvider
import java.io.File
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/** 分享只暴露已经读完的独立快照；目录不包含下载中的文件或两种模式的凭据。 */
class RemoteShareFiles(
    private val context: Context,
    private val directory: File = File(context.cacheDir, "remote-shares"),
    private val clock: () -> Long = System::currentTimeMillis,
    private val byteLimit: Long = 512L * 1024 * 1024,
) {
    data class Snapshot(val file: File, val uri: Uri)
    private val preparing = File(directory.parentFile, "preparing-${directory.name}")
    init {
        directory.mkdirs(); preparing.mkdirs()
        // 只清理旧进程未发布的副本；同进程的其他窗口可能仍在复制。
        preparing.listFiles().orEmpty().filter { folder ->
            folder.isDirectory && folder.canonicalFile.parentFile == preparing.canonicalFile &&
                PENDING_FOLDER.matches(folder.name) && !folder.name.startsWith("$PROCESS_OWNER-")
        }.forEach { it.deleteRecursively() }
        cleanExpired()
    }

    @Synchronized fun prepare(entry: RemoteDownloadStore.Entry, valid: () -> Boolean): Snapshot {
        if (!entry.complete) throw RemoteDownloadStore.Failure("download_incomplete")
        cleanExpired()
        val existing = snapshots()
        if (existing.size >= 8 || existing.sumOf { it.length() } + entry.bytes > byteLimit) {
            throw RemoteDownloadStore.Failure("share_cache_full")
        }
        val id = UUID.randomUUID().toString()
        val folder = File(preparing, "$PROCESS_OWNER-$id")
        val published = File(directory, id)
        check(folder.mkdir())
        val file = File(folder, entry.name)
        try {
            var bytes = 0L
            file.outputStream().use { output ->
                entry.file.inputStream().use { input ->
                    val buffer = ByteArray(65536)
                    while (true) {
                        if (!valid()) throw RemoteDownloadStore.Failure("download_expired")
                        val size = input.read(buffer); if (size < 0) break
                        output.write(buffer, 0, size); bytes += size
                    }
                }
                output.fd.sync()
            }
            if (!valid() || bytes != entry.bytes) throw RemoteDownloadStore.Failure("download_expired")
            check(file.setLastModified(clock()))
            // 完整校验和同步落盘后才进入FileProvider目录，已交付快照仍保留原生命周期。
            check(folder.renameTo(published))
            val complete = File(published, entry.name)
            return Snapshot(complete, uri(complete))
        } catch (error: Exception) {
            file.delete(); folder.delete()
            File(published, entry.name).delete(); published.delete()
            throw error
        }
    }

    fun intent(snapshot: Snapshot) = Intent(Intent.ACTION_SEND).apply {
        type = MimeTypeMap.getSingleton().getMimeTypeFromExtension(snapshot.file.extension.lowercase()) ?: "application/octet-stream"
        putExtra(Intent.EXTRA_STREAM, snapshot.uri)
        clipData = ClipData.newRawUri(snapshot.file.name, snapshot.uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }

    // 接收 App 可在返回 DSHM 后再读文件，不能随下载 finally 立即删除已交付快照。
    fun handedOff(snapshot: Snapshot) {
        cleaner.schedule({ remove(snapshot) }, LIFETIME, TimeUnit.MILLISECONDS)
    }
    @Synchronized fun remove(snapshot: Snapshot) {
        context.revokeUriPermission(snapshot.uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        snapshot.file.delete(); snapshot.file.parentFile?.delete()
    }
    @Synchronized fun cleanExpired() {
        for (file in snapshots()) if (clock() - file.lastModified() >= LIFETIME || file.lastModified() > clock()) remove(Snapshot(file, uri(file)))
    }
    private fun snapshots(): List<File> = directory.listFiles().orEmpty().filter { folder ->
        folder.isDirectory && folder.canonicalFile.parentFile == directory.canonicalFile &&
            runCatching { UUID.fromString(folder.name) }.isSuccess
    }.flatMap { folder -> folder.listFiles().orEmpty().filter { it.isFile && it.canonicalFile.parentFile == folder.canonicalFile }.toList() }
    private fun uri(file: File) = FileProvider.getUriForFile(context, "${context.packageName}.remote.files", file)
    companion object {
        const val LIFETIME = 60L * 60 * 1000
        private val PROCESS_OWNER = UUID.randomUUID().toString()
        private val PENDING_FOLDER = Regex("[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}")
        private val cleaner = Executors.newSingleThreadScheduledExecutor()
    }
}
