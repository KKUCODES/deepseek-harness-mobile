package dev.dshmobile.validation

import android.app.Instrumentation
import android.util.Base64
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** 通过现有有效性回调停在真实复制的第二块前；外部驱动结束独立测试进程。 */
object RemoteShareDeathChecks {
    fun run(instrumentation: Instrumentation) {
        val context = instrumentation.targetContext
        check(context.packageName.endsWith(".pairingtest"))
        val directory = File(context.cacheDir, "remote-shares")
        val store = RemoteDownloadStore(File(context.cacheDir, "remote-downloads")) { 1 }
        val shares = RemoteShareFiles(context)
        check(directory.listFiles().orEmpty().isEmpty())
        val entry = store.begin("share-death.bin")
        val chunk = ByteArray(65536) { (it % 251).toByte() }
        repeat(8) { store.append(entry.id, it * chunk.size.toLong(), Base64.encodeToString(chunk, Base64.NO_WRAP)) }
        store.finish(entry.id, 8L * chunk.size)
        val complete = shares.prepare(entry) { true }
        shares.handedOff(complete)
        var checks = 0
        shares.prepare(entry) {
            checks++
            if (checks == 2) {
                val partial = listOf(directory, File(context.cacheDir, "preparing-remote-shares"))
                    .flatMap { it.walkTopDown().filter { file -> file.isFile && file != complete.file }.toList() }.single()
                check(partial.length() == chunk.size.toLong())
                val report = JSONObject().put("pid", android.os.Process.myPid())
                    .put("partial", partial.relativeTo(context.dataDir).path)
                    .put("complete", complete.file.relativeTo(context.dataDir).path)
                    .put("bytes", partial.length()).put("expectedBytes", entry.bytes)
                    .put("providerCanResolvePartial", runCatching {
                        FileProvider.getUriForFile(context, "${context.packageName}.remote.files", partial)
                    }.isSuccess)
                File(context.cacheDir, "share-death-ready.json").writeText(report.toString())
                check(CountDownLatch(1).await(90, TimeUnit.SECONDS)) { "External driver did not stop this process" }
            }
            true
        }
        error("Share copy unexpectedly completed")
    }
}
