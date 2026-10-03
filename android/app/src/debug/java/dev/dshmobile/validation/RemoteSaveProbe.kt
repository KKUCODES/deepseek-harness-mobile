package dev.dshmobile.validation

import android.app.Activity
import android.content.Intent
import android.database.Cursor
import android.os.Bundle
import android.os.CancellationSignal
import android.os.ParcelFileDescriptor
import android.provider.DocumentsProvider
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
    class WriteProbe(val file: File, val failWrite: Boolean = false, val rejectDelete: Boolean = false, val waitSeconds: Long = 10) {
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
    override fun queryRoots(projection: Array<out String>?): Cursor = throw UnsupportedOperationException()
    override fun queryDocument(documentId: String, projection: Array<out String>?): Cursor = throw UnsupportedOperationException()
    override fun queryChildDocuments(parentDocumentId: String, projection: Array<out String>?, sortOrder: String?): Cursor = throw UnsupportedOperationException()
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
