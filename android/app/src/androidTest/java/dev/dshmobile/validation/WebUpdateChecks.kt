package dev.dshmobile.validation

import android.app.Instrumentation
import org.json.JSONObject
import java.io.File
import java.util.UUID
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/** 使用Node生成的真实ECDSA签名验证Android互通；不借用生产签名私钥或模型凭据。 */
object WebUpdateChecks {
    fun run(instrumentation: Instrumentation) {
        val context = instrumentation.targetContext
        check(context.packageName.endsWith(".rc21test"))
        fun fixture(name: String) = instrumentation.context.assets.open("web-fixtures/$name").use { it.readBytes() }
        val trust = JSONObject(fixture("trust.json").toString(Charsets.UTF_8))
        fun parse(name: String) = WebResourceManifest.parse(fixture(name), trust, context.packageName, 2, "0.2.1-rc.2")
        fun rejected(code: String, action: () -> Unit) {
            val failure = runCatching(action).exceptionOrNull() ?: error("Expected $code")
            check(failure.message == code) { "Expected $code, got ${failure.message}" }
        }
        val first = parse("r1.json"); val second = parse("r2.json"); val third = parse("r3.json")
        check(first.revision == 1L)
        for ((file, code) in mapOf("bridge" to "web_requires_apk", "data" to "web_requires_apk", "sdk" to "web_sdk_mismatch",
            "package" to "web_package_mismatch", "apk" to "web_requires_apk", "plugin" to "web_plugin_mismatch", "path" to "web_path_invalid")) {
            rejected(code) { parse("$file.json") }
        }
        val tampered = JSONObject(fixture("r1.json").toString(Charsets.UTF_8)).put("payload", android.util.Base64.encodeToString("{}".toByteArray(), android.util.Base64.NO_WRAP))
        rejected("web_signature_invalid") { WebResourceManifest.parse(tampered.toString().toByteArray(), trust, context.packageName, 2, "0.2.1-rc.2") }
        rejected("web_signature_invalid") { WebResourceManifest.parse(first.envelope, JSONObject().put("keys", org.json.JSONArray()), context.packageName, 2, "0.2.1-rc.2") }
        val root = File(context.cacheDir, "web-check-${UUID.randomUUID()}").apply { mkdirs() }
        val outside = File(root, "do-not-touch.txt").apply { writeText("retained") }
        val updatesRoot = File(root, "updates")
        val archive = File(root, "valid.zip").apply { writeBytes(fixture("valid.zip")) }
        fun next() = WebResourceStore(updatesRoot, trust, context.packageName, 2, "0.2.1-rc.2").apply { beginProcess() }
        fun healthy(store: WebResourceStore) { for (page in listOf("mobile.html", "remote.html")) { store.started(page); store.ready(page) } }
        try {
            val baseline = next(); check(baseline.snapshot().getLong("currentRevision") == 0L)
            baseline.stage(first, archive)
            check(baseline.snapshot().getLong("currentRevision") == 0L && baseline.snapshot().getLong("pendingRevision") == 1L)
            check(!baseline.usesDownloadedResources())
            val one = next(); check(one.snapshot().getLong("currentRevision") == 1L)
            check(one.resource("mobile.html")!!.readText() == "fixture:mobile.html")
            check(one.resource("../do-not-touch.txt") == null && one.resource("missing.js") == null)
            healthy(one)
            rejected("web_version_not_newer") { one.stage(first, archive) }
            val badArchive = File(root, "bad.zip").apply { writeText("corrupt") }
            rejected("web_archive_invalid") { one.stage(second, badArchive) }
            check(one.snapshot().getLong("currentRevision") == 1L)
            rejected("update_cancelled") { one.stage(second, archive) { true } }
            check(one.snapshot().getLong("pendingRevision") == 0L)
            one.stage(second, archive); check(one.snapshot().getLong("currentRevision") == 1L)
            val two = next(); check(two.snapshot().getLong("currentRevision") == 2L)
            two.started("mobile.html"); two.failed()
            check(two.snapshot().getLong("currentRevision") == 2L && two.snapshot().getBoolean("recoveryPending"))
            val restored = next(); check(restored.snapshot().getLong("currentRevision") == 1L)
            healthy(restored); restored.stage(third, archive)
            val three = next(); check(three.snapshot().getLong("currentRevision") == 3L)
            three.started("remote.html")
            // 没有ready即结束，模拟Renderer/进程在首次页面启动期间崩溃。
            val afterDeath = next(); check(afterDeath.snapshot().getLong("currentRevision") == 1L)
            rejected("web_version_not_newer") { afterDeath.stage(third, archive) }
            afterDeath.recoverBundled(); check(afterDeath.snapshot().getLong("currentRevision") == 1L)
            check(next().snapshot().getLong("currentRevision") == 0L)
            check(outside.readText() == "retained")
            val zipSlip = File(root, "slip.zip")
            ZipOutputStream(zipSlip.outputStream()).use { zip -> zip.putNextEntry(ZipEntry("../do-not-touch.txt")); zip.write("bad".toByteArray()); zip.closeEntry() }
            val slipFailure = runCatching { first.unpack(zipSlip, File(root, "slip")) }.exceptionOrNull()
            check(slipFailure?.message in setOf("web_path_invalid", "web_archive_invalid"))
            val duplicates = File(root, "duplicates.zip")
            ZipOutputStream(duplicates.outputStream()).use { zip -> zip.putNextEntry(ZipEntry("unlisted.js")); zip.write("bad".toByteArray()); zip.closeEntry() }
            rejected("web_path_invalid") { first.unpack(duplicates, File(root, "duplicates")) }
            check(outside.readText() == "retained")
            // 存储损坏或APK底座更新后不执行不兼容的旧下载包。
            val incompatibleRoot = File(root, "incompatible")
            val previous = WebResourceStore(incompatibleRoot, trust, context.packageName, 2, "0.2.1-rc.2").apply { beginProcess(); stage(first, archive) }
            check(previous.snapshot().getLong("pendingRevision") == 1L)
            val upgraded = WebResourceStore(incompatibleRoot, trust, context.packageName, 3, "0.2.1-rc.2").apply { beginProcess() }
            check(upgraded.snapshot().getLong("currentRevision") == 0L)
        } finally { root.deleteRecursively() }
    }
}
