package dev.dshmobile.validation

import android.app.Activity
import android.os.Bundle
import android.system.Os
import android.system.OsConstants
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.DataInputStream
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/** 仅独立调试UID：让实际下载字节经私有FIFO进入原分享复制逻辑，停在首块之后。 */
class RemoteShareFeedProbeActivity : Activity() {
    override fun onCreate(state: Bundle?) {
        super.onCreate(state)
        val app = applicationContext
        if (app.packageName != "dev.dshmobile.validation.latestofficetest") { finish(); return }
        val directory = File(app.cacheDir, "share-death-probe")
        val control = File(directory, "control.json")
        if (!control.isFile || !started.compareAndSet(false, true)) { finish(); return }
        Thread({
            try {
                val config = JSONObject(control.readText())
                val sourceName = config.getString("source")
                val pipeName = config.getString("fifo")
                val name = config.getString("name")
                val expected = config.getLong("expectedBytes")
                check(sourceName.matches(Regex("source-[a-f0-9-]{36}\\.bin")))
                check(pipeName.matches(Regex("remote-[a-zA-Z0-9]+\\.part")))
                check(name == "dshm-latest-export-network.bin")
                check(expected in 65537L..(4L * 1024 * 1024))
                val source = File(directory, sourceName)
                val fifo = File(File(app.cacheDir, "remote-downloads"), pipeName)
                check(source.isFile && source.canonicalFile.parentFile == directory.canonicalFile && source.length() == expected)
                check(fifo.canonicalFile.parentFile == File(app.cacheDir, "remote-downloads").canonicalFile)
                check(OsConstants.S_ISFIFO(Os.lstat(fifo.path).st_mode))
                DataInputStream(source.inputStream()).use { input ->
                    val first = ByteArray(65536)
                    input.readFully(first)
                    FileOutputStream(fifo).use { output ->
                        output.write(first); output.flush()
                        // 原分享线程可能分多次读取FIFO；等其真实目标累计到首块再报告。
                        val preparing = File(app.cacheDir, "preparing-remote-shares")
                        val deadline = System.currentTimeMillis() + 10000
                        var partial: File? = null
                        while (partial == null && System.currentTimeMillis() < deadline) {
                            partial = preparing.listFiles().orEmpty().filter { folder ->
                                folder.isDirectory && folder.canonicalFile.parentFile == preparing.canonicalFile &&
                                    folder.name.matches(Regex("[a-f0-9-]{36}-[a-f0-9-]{36}"))
                            }.map { File(it, name) }.singleOrNull { it.isFile && it.length() == first.size.toLong() }
                            if (partial == null) Thread.sleep(20)
                        }
                        check(partial != null)
                        val ready = JSONObject().put("pid", android.os.Process.myPid()).put("bytes", partial.length())
                            .put("expectedBytes", expected).put("partial", partial.relativeTo(app.dataDir).invariantSeparatorsPath)
                            .put("source", source.relativeTo(app.dataDir).invariantSeparatorsPath)
                            .put("providerCanResolvePartial", runCatching {
                                FileProvider.getUriForFile(app, "${app.packageName}.remote.files", partial)
                            }.isSuccess)
                        File(directory, "ready.json").writeText(ready.toString())
                        check(CountDownLatch(1).await(120, TimeUnit.SECONDS)) { "External driver did not stop the test process" }
                    }
                }
            } catch (error: Exception) {
                File(directory, "error.json").writeText(JSONObject().put("failure", error.javaClass.simpleName).toString())
            }
        }, "dshm-share-feed-probe").start()
        // 不替换Remote页面或其Activity，也不改变原连接/下载代次。
        finish()
    }
    companion object { private val started = AtomicBoolean(false) }
}
