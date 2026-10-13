package dev.dshmobile.validation

import android.app.Activity
import android.content.Intent
import android.database.Cursor
import android.database.MatrixCursor
import android.os.Bundle
import android.os.CancellationSignal
import android.os.ParcelFileDescriptor
import android.provider.DocumentsProvider
import android.provider.DocumentsContract
import org.json.JSONObject
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit

/** 只截住系统窗口调度，让原生测试确定性地交付取消后的旧结果。 */
class RemoteSaveProbeActivity : Activity() {
    var launches = 0
    var finishes = 0
    override fun startActivityForResult(intent: Intent, requestCode: Int, options: Bundle?) {
        check(intent.action == Intent.ACTION_CREATE_DOCUMENT && requestCode == RemoteDownloads.SAVE_REQUEST)
        launches++
    }
    override fun finishActivity(requestCode: Int) {
        check(requestCode == RemoteDownloads.SAVE_REQUEST)
        finishes++
    }
}

/** 仅调试入口：取消回调不创建文件；写入竞态只使用明确登记的私有临时文件。 */
class RemoteSaveProbeProvider : DocumentsProvider() {
    class WriteProbe(val file: File, val failWrite: Boolean = false, val rejectDelete: Boolean = false, val waitSeconds: Long = 10,
        val onFirstWrite: ((Long) -> Unit)? = null) {
        val entered = CountDownLatch(1)
        val release = CountDownLatch(1)
        val finished = CountDownLatch(1)
        @Volatile var bytes = 0L
        @Volatile var failure: Throwable? = null
        val deleteAttempts = java.util.concurrent.atomic.AtomicInteger()
    }
    companion object {
        val deleted = ConcurrentHashMap.newKeySet<String>()
        val writes = ConcurrentHashMap<String, WriteProbe>()
    }
    override fun onCreate() = true
    override fun deleteDocument(documentId: String) {
        check(documentId.matches(Regex("dshm-save-test-[a-f0-9-]+")))
        writes[documentId]?.let { probe ->
            probe.deleteAttempts.incrementAndGet()
            if (probe.rejectDelete) throw UnsupportedOperationException("Test provider refuses deletion")
            probe.file.delete()
        }
        deleted.add(documentId)
    }
    // 系统选择器专项只在独立UID、显式私有配置同时存在时开放一个固定根目录。
    // 原生竞态单测仍使用上面的内存登记，不接入产品文件目录。
    private fun pickerConfig(): JSONObject? {
        if (context?.packageName != "dev.dshmobile.validation.latestofficetest") return null
        val config = File(context!!.cacheDir, "save-death-probe/control.json")
        if (!config.isFile) return null
        return JSONObject(config.readText()).also {
            check(it.getString("document").matches(Regex("dshm-save-test-[a-f0-9-]{36}")))
            check(it.getString("name").matches(Regex("dshm-latest-export-[a-z0-9.-]+")))
            check(it.getLong("expectedBytes") in 4097L..(4L * 1024 * 1024))
        }
    }
    override fun queryRoots(projection: Array<out String>?): Cursor {
        val columns = projection ?: arrayOf(DocumentsContract.Root.COLUMN_ROOT_ID, DocumentsContract.Root.COLUMN_DOCUMENT_ID,
            DocumentsContract.Root.COLUMN_TITLE, DocumentsContract.Root.COLUMN_FLAGS)
        return MatrixCursor(columns).also { cursor ->
            if (pickerConfig() != null) cursor.addRow(columns.map { column -> when (column) {
                DocumentsContract.Root.COLUMN_ROOT_ID, DocumentsContract.Root.COLUMN_DOCUMENT_ID -> "save-death-root"
                DocumentsContract.Root.COLUMN_TITLE -> "DSHM 写入验收"
                DocumentsContract.Root.COLUMN_FLAGS -> DocumentsContract.Root.FLAG_SUPPORTS_CREATE or DocumentsContract.Root.FLAG_LOCAL_ONLY
                else -> null
            } }.toTypedArray())
        }
    }
    override fun queryDocument(documentId: String, projection: Array<out String>?): Cursor {
        val config = pickerConfig() ?: throw UnsupportedOperationException()
        check(documentId == "save-death-root" || documentId == config.getString("document"))
        val columns = projection ?: arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME,
            DocumentsContract.Document.COLUMN_MIME_TYPE, DocumentsContract.Document.COLUMN_FLAGS, DocumentsContract.Document.COLUMN_SIZE)
        return MatrixCursor(columns).also { cursor -> cursor.addRow(columns.map { column -> when (column) {
            DocumentsContract.Document.COLUMN_DOCUMENT_ID -> documentId
            DocumentsContract.Document.COLUMN_DISPLAY_NAME -> if (documentId == "save-death-root") "DSHM 写入验收" else config.getString("name")
            DocumentsContract.Document.COLUMN_MIME_TYPE -> if (documentId == "save-death-root") DocumentsContract.Document.MIME_TYPE_DIR else "application/octet-stream"
            DocumentsContract.Document.COLUMN_FLAGS -> if (documentId == "save-death-root") DocumentsContract.Document.FLAG_DIR_SUPPORTS_CREATE
                else DocumentsContract.Document.FLAG_SUPPORTS_WRITE or DocumentsContract.Document.FLAG_SUPPORTS_DELETE
            DocumentsContract.Document.COLUMN_SIZE -> writes[documentId]?.file?.length() ?: 0L
            else -> null
        } }.toTypedArray()) }
    }
    override fun queryChildDocuments(parentDocumentId: String, projection: Array<out String>?, sortOrder: String?): Cursor {
        check(pickerConfig() != null && parentDocumentId == "save-death-root")
        return MatrixCursor(projection ?: arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME,
            DocumentsContract.Document.COLUMN_MIME_TYPE, DocumentsContract.Document.COLUMN_FLAGS))
    }
    override fun createDocument(parentDocumentId: String, mimeType: String, displayName: String): String {
        val config = pickerConfig() ?: throw UnsupportedOperationException()
        check(parentDocumentId == "save-death-root" && displayName == config.getString("name"))
        val id = config.getString("document")
        val directory = File(context!!.cacheDir, "save-death-probe")
        val target = File(directory, id)
        check(!target.exists() && !writes.containsKey(id))
        val probe = WriteProbe(target, waitSeconds = 120, onFirstWrite = { bytes ->
            File(directory, "ready.json").writeText(JSONObject().put("document", id).put("bytes", bytes)
                .put("expectedBytes", config.getLong("expectedBytes")).put("pid", android.os.Process.myPid()).toString())
        })
        check(writes.putIfAbsent(id, probe) == null)
        return id
    }
    override fun openDocument(documentId: String, mode: String, signal: CancellationSignal?): ParcelFileDescriptor {
        val probe = writes[documentId] ?: throw UnsupportedOperationException()
        check(mode == "w")
        val pipe = ParcelFileDescriptor.createReliablePipe()
        Thread({
            try {
                ParcelFileDescriptor.AutoCloseInputStream(pipe[0]).use { input ->
                    probe.file.outputStream().use { output ->
                        val buffer = ByteArray(4096)
                        val first = input.read(buffer)
                        check(first > 0)
                        output.write(buffer, 0, first); output.flush(); probe.bytes += first
                        probe.onFirstWrite?.invoke(probe.bytes)
                        probe.entered.countDown()
                        check(probe.release.await(probe.waitSeconds, TimeUnit.SECONDS))
                        if (probe.failWrite) {
                            pipe[0].closeWithError("Test destination write failure")
                            return@Thread
                        }
                        while (true) {
                            val count = input.read(buffer); if (count < 0) break
                            output.write(buffer, 0, count); probe.bytes += count
                        }
                    }
                }
            } catch (error: Throwable) { probe.failure = error }
            finally { probe.finished.countDown() }
        }, "dshm-save-write-probe").start()
        return pipe[1]
    }
}
