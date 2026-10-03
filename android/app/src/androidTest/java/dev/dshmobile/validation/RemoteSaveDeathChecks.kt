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

/** 外部脚本在实际目标收到首块后结束独立测试进程；不访问日常App的凭据或用户文件。 */
object RemoteSaveDeathChecks {
    fun run(instrumentation: Instrumentation) {
        check(instrumentation.targetContext.packageName.endsWith(".pairingtest"))
        val activity = instrumentation.startActivitySync(Intent(instrumentation.targetContext, RemoteSaveProbeActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) as RemoteSaveProbeActivity
        lateinit var downloads: RemoteDownloads
        instrumentation.runOnMainSync { downloads = RemoteDownloads(activity) { 1 } }
        fun call(op: String, data: JSONObject): JSONObject {
            val done = CountDownLatch(1)
            var result: JSONObject? = null; var failure: String? = null
            instrumentation.runOnMainSync { downloads.dispatch(op, data) { value, error -> result = value; failure = error; done.countDown() } }
            check(done.await(10, TimeUnit.SECONDS) && failure == null)
            return checkNotNull(result)
        }
        val directory = File(activity.cacheDir, "save-death-probe").apply { mkdirs() }
        val document = "dshm-save-test-${UUID.randomUUID()}"
        val probe = RemoteSaveProbeProvider.WriteProbe(File(directory, document), waitSeconds = 120)
        RemoteSaveProbeProvider.writes[document] = probe
        val id = call("file.begin", JSONObject().put("name", "process-death.bin")).getString("downloadId")
        val payload = ByteArray(65536) { (it % 251).toByte() }
        repeat(8) { part -> call("file.chunk", JSONObject().put("downloadId", id).put("offset", part * payload.size)
            .put("data", Base64.encodeToString(payload, Base64.NO_WRAP))) }
        call("file.finish", JSONObject().put("downloadId", id).put("bytes", 8 * payload.size))
        val uri = DocumentsContract.buildDocumentUri("${activity.packageName}.saveprobe", document)
        val replied = CountDownLatch(1)
        instrumentation.runOnMainSync {
            downloads.dispatch("file.save", JSONObject().put("downloadId", id)) { _, _ -> replied.countDown() }
            downloads.onResult(RemoteDownloads.SAVE_REQUEST, Activity.RESULT_OK, Intent().setData(uri))
        }
        check(probe.entered.await(10, TimeUnit.SECONDS) && replied.count == 1L)
        check(probe.file.length() in 1 until 8L * payload.size)
        File(directory, "ready.json").writeText(JSONObject().put("document", document)
            .put("bytes", probe.file.length()).put("expectedBytes", 8 * payload.size).put("pid", android.os.Process.myPid()).toString())
        // 正常返回不是成功；必须由外部脚本确认PID消失、新进程及保留的目标文件。
        check(!replied.await(90, TimeUnit.SECONDS)) { "Process was not stopped during the controlled write" }
        error("Process-death driver did not stop the test")
    }
}
