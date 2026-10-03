package dev.dshmobile.validation

import android.app.Activity
import android.app.Instrumentation
import android.content.Intent
import android.provider.DocumentsContract
import android.util.Base64
import org.json.JSONObject
import java.io.File
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference

/** 实际控制器、ContentResolver和管道写入；受控提供方只负责卡住写入时序。 */
object RemoteSaveWriteChecks {
    var stage = "start"
    fun run(instrumentation: Instrumentation) {
        RemoteSaveJournalChecks.run(instrumentation.targetContext)
        val activity = instrumentation.startActivitySync(Intent(instrumentation.targetContext, RemoteSaveProbeActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) as RemoteSaveProbeActivity
        val owner = AtomicReference<Int?>(1)
        lateinit var downloads: RemoteDownloads
        fun main(action: () -> Unit) = instrumentation.runOnMainSync(action)
        fun call(op: String, data: JSONObject): Pair<JSONObject?, String?> {
            val done = CountDownLatch(1)
            var result: JSONObject? = null; var failure: String? = null
            main { downloads.dispatch(op, data) { value, error -> result = value; failure = error; done.countDown() } }
            check(done.await(10, TimeUnit.SECONDS))
            return result to failure
        }
        val payload = ByteArray(65536) { (it % 251).toByte() }
        val encoded = Base64.encodeToString(payload, Base64.NO_WRAP)
        val directory = File(activity.cacheDir, "save-write-probe").apply { mkdirs() }
        try {
            for (mode in listOf("complete", "disconnect", "abort", "close", "write-failure", "delete-failure")) {
                stage = "$mode:prepare"
                owner.set(1)
                main { downloads = RemoteDownloads(activity) { owner.get() } }
                val id = checkNotNull(call("file.begin", JSONObject().put("name", "write-test.bin")).first).getString("downloadId")
                repeat(8) { part -> check(call("file.chunk", JSONObject().put("downloadId", id).put("offset", part * payload.size).put("data", encoded)).second == null) }
                check(call("file.finish", JSONObject().put("downloadId", id).put("bytes", 8 * payload.size)).second == null)
                val document = "dshm-save-test-${UUID.randomUUID()}"
                val probe = RemoteSaveProbeProvider.WriteProbe(File(directory, document),
                    failWrite = mode in setOf("write-failure", "delete-failure"), rejectDelete = mode == "delete-failure")
                RemoteSaveProbeProvider.writes[document] = probe
                val uri = DocumentsContract.buildDocumentUri("${activity.packageName}.saveprobe", document)
                val replies = AtomicInteger(); val done = CountDownLatch(1)
                var saved = false; var failure: String? = null
                try {
                    main {
                        downloads.dispatch("file.save", JSONObject().put("downloadId", id)) { value, error ->
                            saved = value?.optBoolean("saved") == true; failure = error; replies.incrementAndGet(); done.countDown()
                        }
                        check(downloads.onResult(RemoteDownloads.SAVE_REQUEST, Activity.RESULT_OK, Intent().setData(uri)))
                    }
                    stage = "$mode:writing"
                    check(probe.entered.await(10, TimeUnit.SECONDS))
                    check(probe.file.exists() && probe.file.length() in 1 until 8L * payload.size)
                    check(replies.get() == 0)
                    main {
                        when (mode) {
                            "disconnect" -> { owner.set(null); downloads.cancel() }
                            "abort" -> downloads.dispatch("file.abort", JSONObject().put("downloadId", id)) { _, error -> check(error == null) }
                            "close" -> downloads.close()
                        }
                    }
                    probe.release.countDown()
                    stage = "$mode:cleanup"
                    check(probe.finished.await(10, TimeUnit.SECONDS)); check(probe.failure == null)
                    if (mode == "complete") {
                        check(done.await(10, TimeUnit.SECONDS) && replies.get() == 1 && saved && failure == null)
                        check(probe.file.readBytes().contentEquals(ByteArray(8 * payload.size) { payload[it % payload.size] }))
                        check(!RemoteSaveProbeProvider.deleted.contains(document))
                    } else if (mode == "delete-failure") {
                        check(done.await(10, TimeUnit.SECONDS) && replies.get() == 1 && !saved)
                        check(failure == "download_cleanup_failed")
                        check(probe.deleteAttempts.get() == 1 && !RemoteSaveProbeProvider.deleted.contains(document))
                        check(probe.file.exists() && probe.file.length() in 1 until 8L * payload.size)
                    } else {
                        val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10)
                        while (!RemoteSaveProbeProvider.deleted.contains(document)) { check(System.nanoTime() < deadline); Thread.sleep(10) }
                        check(!probe.file.exists())
                        if (mode != "close") check(done.await(10, TimeUnit.SECONDS) && replies.get() == 1 && !saved
                            && failure == if (mode == "write-failure") "download_failed" else "download_expired")
                        else { main { }; check(replies.get() == 0) }
                    }
                    check(File(activity.cacheDir, "remote-downloads").listFiles().orEmpty().isEmpty())
                    check(File(activity.noBackupFilesDir, "remote-save-writes").listFiles().orEmpty().isEmpty())
                    if (mode != "close") {
                        // 旧保存释放暂存后，新连接能正常开始并完成空文件。
                        owner.set(2)
                        val next = checkNotNull(call("file.begin", JSONObject().put("name", "next.bin")).first).getString("downloadId")
                        check(call("file.finish", JSONObject().put("downloadId", next).put("bytes", 0)).second == null)
                        check(call("file.abort", JSONObject().put("downloadId", next)).second == null)
                    }
                } finally {
                    probe.release.countDown(); main { downloads.close() }
                    probe.finished.await(10, TimeUnit.SECONDS)
                    RemoteSaveProbeProvider.writes.remove(document)
                    RemoteSaveProbeProvider.deleted.remove(document)
                    probe.file.delete()
                }
            }
            stage = "complete"
        } finally { directory.delete(); main { activity.finish() } }
    }
}
