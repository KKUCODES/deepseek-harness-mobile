package dev.dshmobile.validation

import android.app.Activity
import android.app.Instrumentation
import android.content.Intent
import android.provider.DocumentsContract
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** 使用实际下载控制器/暂存/ContentResolver，隔离的只有系统窗口和空文档提供方。 */
object RemoteSaveChecks {
    fun run(instrumentation: Instrumentation) {
        val activity = instrumentation.startActivitySync(Intent(instrumentation.targetContext, RemoteSaveProbeActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) as RemoteSaveProbeActivity
        var generation: Int? = 1
        lateinit var downloads: RemoteDownloads
        fun main(action: () -> Unit) { instrumentation.runOnMainSync(action) }
        fun call(op: String, data: JSONObject): Pair<JSONObject?, String?> {
            val done = CountDownLatch(1)
            var result: JSONObject? = null
            var failure: String? = null
            main { downloads.dispatch(op, data) { value, error -> result = value; failure = error; done.countDown() } }
            check(done.await(5, TimeUnit.SECONDS))
            return result to failure
        }
        fun completed(): String {
            val (value, error) = call("file.begin", JSONObject().put("name", "dshm-save-test.txt"))
            check(error == null)
            val id = value!!.getString("downloadId")
            check(call("file.chunk", JSONObject().put("downloadId", id).put("offset", 0).put("data", "b2s=" )).second == null)
            check(call("file.finish", JSONObject().put("downloadId", id).put("bytes", 2)).second == null)
            return id
        }
        main { downloads = RemoteDownloads(activity) { generation } }
        try {
            for (mode in listOf("disconnect", "abort", "close")) {
                generation = 1
                val id = completed()
                var replies = 0
                main {
                    downloads.dispatch("file.save", JSONObject().put("downloadId", id)) { value, error ->
                        check(value == null && error == "download_canceled"); replies++
                    }
                    when (mode) {
                        "abort" -> downloads.dispatch("file.abort", JSONObject().put("downloadId", id)) { _, error -> check(error == null) }
                        "close" -> downloads.close()
                        else -> { generation = null; downloads.cancel(); downloads.cancel() }
                    }
                    check(replies == 1 && activity.finishes == activity.launches)
                }
                if (mode != "close") check(call("file.save", JSONObject().put("downloadId", id)).second == "picker_busy")
                val document = "dshm-save-test-${UUID.randomUUID()}"
                val uri = DocumentsContract.buildDocumentUri("${activity.packageName}.saveprobe", document)
                main { check(downloads.onResult(RemoteDownloads.SAVE_REQUEST, Activity.RESULT_OK, Intent().setData(uri))) }
                val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5)
                while (!RemoteSaveProbeProvider.deleted.contains(document)) {
                    check(System.nanoTime() < deadline); Thread.sleep(10)
                }
                main {
                    check(replies == 1)
                    check(downloads.onResult(RemoteDownloads.SAVE_REQUEST, Activity.RESULT_CANCELED, null))
                    check(replies == 1)
                }
                RemoteSaveProbeProvider.deleted.remove(document)
            }
        } finally { main { downloads.close(); activity.finish() } }
    }
}
