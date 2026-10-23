package dev.dshmobile.validation

import android.app.Instrumentation
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import okhttp3.MediaType.Companion.toMediaType
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.concurrent.TimeUnit

/** 下载入口保留真实HTTP校验/签名/解压；仅用本地响应回放代替尚未发布的GitHub资源。 */
object WebUpdateLiveChecks {
    fun run(instrumentation: Instrumentation, mode: String) {
        val context = instrumentation.targetContext
        check(context.packageName == "dev.dshmobile.validation.rc21test")
        val preferences = context.getSharedPreferences("web-retention-fixture", 0)
        if (mode == "retention") {
            check(OrdinaryCredentials(context).read() == "web-update-test-not-a-real-key")
            check(OrdinaryCredentials(context, "dshm.remote.token.v1").read() == "web-update-test-not-a-real-token")
            check(RemoteIdentity(context).fingerprint() == preferences.getString("fingerprint", ""))
            check(context.getSharedPreferences("dshm.remote.binding.v1", 0).getString("retentionFixture", "") == "retained")
            return
        }
        check(mode in setOf("pipeline1", "pipeline2"))
        val revision = if (mode == "pipeline1") 1 else 2
        if (revision == 1) {
            check(!OrdinaryCredentials(context).configured())
            OrdinaryCredentials(context).save("web-update-test-not-a-real-key")
            OrdinaryCredentials(context, "dshm.remote.token.v1").save("web-update-test-not-a-real-token")
            RemoteIdentity(context).prepare()
            check(preferences.edit().putString("fingerprint", RemoteIdentity(context).fingerprint()).commit())
            check(context.getSharedPreferences("dshm.remote.binding.v1", 0).edit().putString("retentionFixture", "retained").commit())
        }
        val folder = "web-live/r$revision"
        fun asset(name: String) = instrumentation.context.assets.open("$folder/$name").use { it.readBytes() }
        val envelope = asset("web-update.json")
        val payload = JSONObject(android.util.Base64.decode(JSONObject(envelope.toString(Charsets.UTF_8)).getString("payload"), android.util.Base64.NO_WRAP).toString(Charsets.UTF_8))
        val archiveName = payload.getJSONObject("archive").getString("name")
        val archive = asset(archiveName)
        val base = "https://github.com/${AppUpdateRelease.REPO}/releases/download/${WebResourceManifest.TAG}/"
        fun metadata(name: String, bytes: ByteArray) = JSONObject().put("name", name).put("browser_download_url", base + name)
            .put("state", "uploaded").put("size", bytes.size).put("digest", "sha256:" + WebResourceManifest.hash(bytes))
        val release = JSONObject().put("tag_name", WebResourceManifest.TAG).put("html_url", WebResourceManifest.PAGE).put("draft", false)
            .put("assets", JSONArray().put(metadata("web-update.json", envelope)).put(metadata(archiveName, archive))).toString().toByteArray()
        var failDownload = true
        val client = OkHttpClient.Builder().addInterceptor { chain ->
            val url = chain.request().url.toString()
            val bytes = when (url) { WebResourceManifest.API -> release; base + "web-update.json" -> envelope; base + archiveName -> if (failDownload) archive.copyOf(archive.size - 1) else archive; else -> error("Unexpected update URL") }
            Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(200).message("OK")
                .body(bytes.toResponseBody("application/octet-stream".toMediaType())).build()
        }.build()
        val updates = WebUpdates(context) { AppUpdateHttp(client) }
        val before = updates.snapshot().getLong("currentRevision")
        fun waitPhase(vararg phases: String) {
            val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(40)
            while (System.nanoTime() < deadline) {
                if (updates.snapshot().getString("phase") in phases) return
                Thread.sleep(30)
            }
            error("Resource pipeline timeout: ${updates.snapshot().optString("phase")}")
        }
        updates.check(); waitPhase("available", "error")
        check(updates.snapshot().getString("phase") == "available") { updates.snapshot().toString() }
        updates.download(); waitPhase("error")
        check(updates.snapshot().getString("error") == "update_size_mismatch")
        check(updates.snapshot().getLong("currentRevision") == before && updates.snapshot().getLong("pendingRevision") == 0L)
        failDownload = false
        updates.download(); updates.cancel(); check(updates.snapshot().getString("phase") == "cancelled")
        updates.download(); waitPhase("staged", "error")
        check(updates.snapshot().getString("phase") == "staged") { updates.snapshot().toString() }
        check(updates.snapshot().getLong("pendingRevision") == revision.toLong() && updates.snapshot().getLong("currentRevision") == before)
        val part = File(context.noBackupFilesDir, "web-updates/download.part")
        val cleanupDeadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5)
        while (part.exists() && System.nanoTime() < cleanupDeadline) Thread.sleep(20)
        check(!part.exists())
    }
}
