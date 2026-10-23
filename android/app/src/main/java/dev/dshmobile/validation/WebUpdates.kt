package dev.dshmobile.validation

import android.app.Activity
import android.app.AlertDialog
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.webkit.WebResourceResponse
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.File
import java.util.concurrent.CopyOnWriteArraySet
import java.util.concurrent.Executors

/** 独立资源通道；下载和解压在工作线程，启用只发生在下一Application进程。 */
internal class WebUpdates(private val context: Context, private val httpFactory: () -> AppUpdateHttp = { AppUpdateHttp() }) {
    private val root = File(context.noBackupFilesDir, "web-updates")
    private val trust = JSONObject(context.assets.open("web-update-trust.json").use { it.readBytes().toString(Charsets.UTF_8) })
    internal val store = WebResourceStore(root, trust, context.packageName, BuildConfig.VERSION_CODE.toLong(), BuildConfig.DSH_SDK_VERSION)
    private val worker = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private val listeners = CopyOnWriteArraySet<() -> Unit>()
    private val preferences = context.getSharedPreferences("dshm.web-updates.v1", Context.MODE_PRIVATE)
    private var phase = "idle"
    private var error: String? = null
    private var candidate: WebResourceManifest? = null
    private var received = 0L
    @Volatile private var generation = 0L
    private var network: AppUpdateHttp? = null
    private val busy get() = phase in setOf("checking", "downloading", "verifying")
    init { store.beginProcess() }
    fun observe(listener: () -> Unit): () -> Unit { listeners.add(listener); return { listeners.remove(listener) } }
    private fun publish() { main.post { listeners.forEach { it() } } }
    @Synchronized private fun state(value: String, failure: String? = null) { phase = value; error = failure; publish() }
    @Synchronized private fun finish(owner: Long, action: () -> Unit) { if (owner == generation) action() }
    @Synchronized fun snapshot(): JSONObject = store.snapshot().put("phase", phase).put("error", error ?: JSONObject.NULL).put("received", received)
        .put("release", candidate?.let { JSONObject().put("revision", it.revision).put("notes", it.notes).put("bytes", it.archive.bytes) } ?: JSONObject.NULL)
    @Synchronized fun check(automatic: Boolean = false) {
        if (busy || store.snapshot().optLong("pendingRevision") > 0 || store.snapshot().optBoolean("recoveryPending")) return
        val now = System.currentTimeMillis()
        if (automatic && now - preferences.getLong("attempt", 0) in 0 until 24 * 60 * 60 * 1000L) return
        preferences.edit().putLong("attempt", now).apply()
        val owner = ++generation; val http = httpFactory(); network = http; state("checking")
        worker.execute {
            try {
                // 单独的固定tag，不向旧APK版本列表添加缺少安装包的v版本记录。
                val data = http.json(WebResourceManifest.API, 2 * 1024 * 1024, missingIsEmpty = true).first
                val found = data?.let {
                    val release = JSONObject(it.toString(Charsets.UTF_8))
                    require(release.getString("tag_name") == WebResourceManifest.TAG && release.getString("html_url") == WebResourceManifest.PAGE && !release.getBoolean("draft")) { "web_manifest_invalid" }
                    val asset = AppUpdateRelease.asset(release, "web-update.json", WebResourceManifest.MAX_MANIFEST.toLong())
                    val cache = File(root, "manifest-cache.json")
                    val cached = cache.takeIf { file -> file.length() == asset.bytes }?.readBytes()?.takeIf { bytes -> WebResourceManifest.hash(bytes) == asset.sha256 }
                    val envelope = cached ?: http.json(asset.url, WebResourceManifest.MAX_MANIFEST).first ?: throw IllegalArgumentException("web_manifest_invalid")
                    require(envelope.size.toLong() == asset.bytes && WebResourceManifest.hash(envelope) == asset.sha256) { "web_manifest_invalid" }
                    val manifest = store.parse(envelope)
                    val archiveAsset = AppUpdateRelease.asset(release, "dshm-web-r${manifest.revision}.zip", WebResourceManifest.MAX_ARCHIVE)
                    require(archiveAsset == manifest.archive) { "web_manifest_invalid" }
                    if (cached == null) cache.writeBytes(envelope)
                    manifest
                }
                finish(owner) {
                    candidate = found?.takeIf { manifest -> manifest.revision > store.snapshot().getLong("highestRevision") }
                    received = 0; state(if (candidate == null) "current" else "available")
                }
            } catch (failure: Exception) { finish(owner) { state("error", failureCode(failure)) } }
            finally { finish(owner) { network = null } }
        }
    }
    @Synchronized fun download() {
        if (busy || store.snapshot().optLong("pendingRevision") > 0) return
        val manifest = candidate ?: return
        val owner = ++generation; val http = httpFactory(); network = http; received = 0; state("downloading")
        worker.execute {
            val temporary = File(root, "download.part")
            try {
                require(root.usableSpace > manifest.archive.bytes + manifest.files.sumOf { it.bytes } + 16 * 1024 * 1024) { "update_no_space" }
                var last = 0L
                http.download(manifest.archive, temporary) { bytes ->
                    val now = System.currentTimeMillis()
                    if (now - last >= 200 || bytes == manifest.archive.bytes) { last = now; finish(owner) { received = bytes; publish() } }
                }
                finish(owner) { state("verifying") }
                store.stage(manifest, temporary) { generation != owner }
                finish(owner) { state("staged") }
            } catch (failure: Exception) { finish(owner) { state("error", failureCode(failure)) } }
            finally { temporary.delete(); finish(owner) { network = null } }
        }
    }
    @Synchronized fun cancel() { if (!busy) return; ++generation; network?.cancel(); network = null; received = 0; state("cancelled") }
    fun started(page: String) = store.started(page)
    fun ready(page: String) { store.ready(page); publish() }
    fun failed() { store.failed(); publish() }
    fun recovery(activity: Activity) {
        val english = (activity.application as DshmApplication).appearance.language() == "en"
        AlertDialog.Builder(activity).setTitle(if (english) "Restore bundled pages" else "恢复内置页面")
            .setMessage(if (english) "Keep chats, keys and pairing. DSHM will exit; open it again to use the bundled pages." else "保留聊天、Key和配对。恢复后将退出DSHM，请重新打开以使用内置页面。")
            .setNegativeButton(if (english) "Cancel" else "取消", null)
            .setPositiveButton(if (english) "Restore and exit" else "恢复并退出") { _, _ ->
                store.recoverBundled()
                activity.finishAffinity()
                main.postDelayed({ android.os.Process.killProcess(android.os.Process.myPid()) }, 150)
            }.show()
    }
    fun pathHandler(): WebViewAssetLoader.PathHandler {
        val bundled = WebViewAssetLoader.AssetsPathHandler(context)
        return WebViewAssetLoader.PathHandler { path ->
            if (!store.usesDownloadedResources() || !path.startsWith("web/")) bundled.handle(path)
            else {
                val name = path.removePrefix("web/"); val file = store.resource(name)
                if (file == null) WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", emptyMap(), ByteArrayInputStream(ByteArray(0)))
                else {
                    val mime = when (file.extension) { "js" -> "text/javascript"; "css" -> "text/css"; "html" -> "text/html"; "json" -> "application/json"; "wasm" -> "application/wasm"; "svg" -> "image/svg+xml"; else -> java.net.URLConnection.guessContentTypeFromName(name) ?: "application/octet-stream" }
                    WebResourceResponse(mime, null, 200, "OK", mapOf("Cache-Control" to "no-store", "X-Content-Type-Options" to "nosniff"), file.inputStream())
                }
            }
        }
    }
    private fun failureCode(failure: Exception): String {
        val code = failure.message.orEmpty()
        return if (code in failures) code else if (failure is java.io.IOException) "update_network" else "web_manifest_invalid"
    }
    companion object {
        val failures = setOf("web_manifest_invalid", "web_signature_invalid", "web_package_mismatch", "web_requires_apk", "web_sdk_mismatch", "web_plugin_mismatch",
            "web_path_invalid", "web_storage_failed", "web_version_not_newer", "web_archive_invalid", "web_file_invalid", "web_recovery_pending", "web_rolled_back",
            "update_network", "update_no_space", "update_cancelled", "update_rate_limited", "update_invalid_url", "update_redirect_limit", "update_size_mismatch", "update_digest_mismatch")
    }
}
