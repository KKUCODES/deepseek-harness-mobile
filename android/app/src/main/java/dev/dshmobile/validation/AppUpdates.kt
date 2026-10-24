package dev.dshmobile.validation

import android.app.Activity
import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.AtomicFile
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File
import java.util.concurrent.CopyOnWriteArraySet
import java.util.concurrent.Executors

/** 应用级单次更新任务；页面切换不重下，进程结束不启动后台服务或自行安装。 */
internal class AppUpdates(private val context: Context, private val httpFactory: () -> AppUpdateHttp = { AppUpdateHttp() }) {
    private val worker = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private val listeners = CopyOnWriteArraySet<() -> Unit>()
    private val preferences = context.getSharedPreferences("dshm.updates.v1", Context.MODE_PRIVATE)
    private val directory = File(context.cacheDir, "app-updates").apply { mkdirs() }
    private val packages = File(directory, "packages").apply { mkdirs() }
    private val apk = File(packages, "update.apk")
    private val record = AtomicFile(File(directory, "download.json"))
    private val listCache = AtomicFile(File(directory, "releases.json"))
    private var phase = "idle"
    private var error: String? = null
    private var candidate: AppUpdateRelease? = null
    private var received = 0L
    private var generation = 0L
    private var revision = 0L
    private var network: AppUpdateHttp? = null
    private val busy = setOf("checking", "downloading", "verifying", "permission", "installing")
    init {
        File(packages, "update.part").delete()
        val saved = runCatching { AppUpdateRelease.restore(JSONObject(record.openRead().use { it.readBytes().toString(Charsets.UTF_8) })) }.getOrNull()
        if (saved != null && saved.code > BuildConfig.VERSION_CODE) {
            candidate = saved
            if (apk.isFile && apk.length() == saved.apk.bytes) { phase = "ready"; received = saved.apk.bytes }
            else { apk.delete(); phase = "cancelled"; error = "update_download_interrupted" }
        } else { apk.delete(); record.delete() }
    }
    @Synchronized fun snapshot(): JSONObject = JSONObject().put("phase", phase).put("error", error ?: JSONObject.NULL)
        .put("currentVersion", BuildConfig.VERSION_NAME).put("currentVersionCode", BuildConfig.VERSION_CODE)
        .put("requiredPluginVersion", BuildConfig.REQUIRED_PLUGIN_VERSION).put("received", received)
        .put("lastChecked", preferences.getLong("lastChecked", 0))
        .put("revision", revision)
        .put("release", candidate?.json() ?: JSONObject.NULL)
    fun observe(listener: () -> Unit): () -> Unit { listeners.add(listener); return { listeners.remove(listener) } }
    private fun publish() { revision++; main.post { for (listener in listeners) listener() } }
    @Synchronized private fun state(value: String, failure: String? = null) { phase = value; error = failure; publish() }
    @Synchronized private fun finish(owner: Long, action: () -> Unit) { if (owner == generation) action() }
    private fun save(file: AtomicFile, bytes: ByteArray) {
        val stream = file.startWrite()
        try { stream.write(bytes); file.finishWrite(stream) } catch (error: Exception) { file.failWrite(stream); throw error }
    }
    @Synchronized fun check(automatic: Boolean = false) {
        if (phase in busy || phase == "ready") return
        val now = System.currentTimeMillis()
        if (automatic && now - preferences.getLong("lastAttempt", 0) in 0 until 24 * 60 * 60 * 1000L) return
        preferences.edit().putLong("lastAttempt", now).apply()
        val owner = ++generation
        val http = httpFactory(); network = http; state("checking")
        worker.execute {
            try {
                val cached = runCatching { listCache.openRead().use { it.readBytes() } }.getOrNull()
                val (downloaded, etag) = http.json(AppUpdateRelease.API, 2 * 1024 * 1024, if (cached != null) preferences.getString("etag", null) else null)
                val list = downloaded ?: cached ?: throw IllegalArgumentException("update_release_list_invalid")
                val release = AppUpdateRelease.select(AppUpdateRelease.releaseList(list), BuildConfig.VERSION_NAME.contains('-'))
                val found = release?.let {
                    val asset = AppUpdateRelease.asset(it, "compatibility.json", 256 * 1024)
                    val bytes = http.json(asset.url, 256 * 1024).first ?: throw IllegalArgumentException("update_metadata_invalid_json")
                    require(bytes.size.toLong() == asset.bytes) { "update_metadata_size_mismatch" }
                    require(AppUpdateRelease.hash(bytes) == asset.sha256) { "update_metadata_digest_mismatch" }
                    val metadata = AppUpdateRelease.metadata(bytes)
                    val value = AppUpdateRelease.parse(it, metadata, context.packageName)
                    if (value.code < BuildConfig.VERSION_CODE ||
                        (value.code == BuildConfig.VERSION_CODE.toLong() && value.version != BuildConfig.VERSION_NAME)) null else {
                        require(AppUpdateVerifier.signers(AppUpdateVerifier.current(context)) == setOf(metadata.getString("signingCertificateSha256"))) { "update_signature_mismatch" }
                        value
                    }
                }
                finish(owner) {
                    if (downloaded != null) save(listCache, downloaded)
                    preferences.edit().putString("etag", etag).putLong("lastChecked", now).apply()
                    candidate = found; received = 0
                    state(if (found == null || found.code <= BuildConfig.VERSION_CODE) "current" else "available")
                }
            } catch (failure: Exception) { finish(owner) { state("error", failureCode(failure)) } }
            finally { finish(owner) { network = null } }
        }
    }
    @Synchronized fun download() {
        if (phase in busy || phase == "ready") return
        val release = candidate ?: return
        // 同版发行可供阅读更新说明，但不是下载/覆盖安装候选。
        if (release.code <= BuildConfig.VERSION_CODE) return
        val owner = ++generation
        val http = AppUpdateHttp(); network = http; received = 0; state("downloading")
        worker.execute {
            val temporary = File(packages, "update.part")
            try {
                finish(owner) { save(record, release.json().toString().toByteArray()) }
                require(packages.usableSpace > release.apk.bytes * 2 + 8 * 1024 * 1024) { "update_no_space" }
                var last = 0L
                http.download(release.apk, temporary) { bytes ->
                    val time = System.currentTimeMillis()
                    if (time - last >= 200 || bytes == release.apk.bytes) { last = time; finish(owner) { received = bytes; publish() } }
                }
                finish(owner) { state("verifying") }
                AppUpdateVerifier.verify(context, temporary, release)
                finish(owner) {
                    if (apk.exists()) kotlin.check(apk.delete())
                    kotlin.check(temporary.renameTo(apk))
                    save(record, release.json().toString().toByteArray())
                    state("ready")
                }
            } catch (failure: Exception) { finish(owner) { state("error", failureCode(failure)) } }
            finally { temporary.delete(); finish(owner) { network = null } }
        }
    }
    @Synchronized fun cancel() {
        if (phase == "installing" || phase == "permission") return
        ++generation; network?.cancel(); network = null
        // 不在UI线程删除仍被工作线程写入的part；任务finally负责清理，下一任务同队列等待。
        apk.delete(); record.delete(); received = 0
        state(if (candidate == null) "idle" else "cancelled")
    }
    @Synchronized fun install(activity: Activity) {
        if (phase != "ready") return
        val release = candidate ?: return
        if (!context.packageManager.canRequestPackageInstalls()) {
            try {
                state("permission")
                activity.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}")))
            } catch (_: Exception) { state("ready", "update_installer_unavailable") }
            return
        }
        val owner = ++generation; state("verifying")
        worker.execute {
            try {
                // 从权限页返回或进程恢复后，安装前仍重新验证私有文件，不能只信任旧ready状态。
                AppUpdateVerifier.verify(context, apk, release)
                main.post { finish(owner) {
                    if (activity.isFinishing || activity.isDestroyed) { state("ready"); return@finish }
                    try {
                        val uri = FileProvider.getUriForFile(context, context.packageName + ".updates.files", apk)
                        val intent = Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
                            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION).apply { clipData = ClipData.newRawUri("DSHM update", uri) }
                        state("installing"); activity.startActivity(intent)
                    } catch (_: Exception) { state("ready", "update_installer_unavailable") }
                } }
            } catch (failure: Exception) { finish(owner) { apk.delete(); record.delete(); state("error", failureCode(failure)) } }
        }
    }
    @Synchronized fun resumed() {
        if (phase == "permission") state("ready", if (context.packageManager.canRequestPackageInstalls()) null else "update_permission_required")
        else if (phase == "installing") state("ready", "update_install_not_completed")
        check(automatic = true)
    }
    fun openRelease(activity: Activity) {
        val page = synchronized(this) { candidate?.page ?: AppUpdateRelease.PAGE }
        activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(page)))
    }
    fun openLink(activity: Activity, value: String) {
        // 与普通聊天links.open一致：只在浏览器打开HTTP(S)，不进入更新下载器或自有WebView。
        activity.startActivity(externalLinkIntent(value))
    }
    companion object {
        internal fun externalLinkIntent(value: String): Intent {
            val uri = Uri.parse(value)
            require(value.length <= 8192 && uri.scheme in setOf("http", "https") && !uri.host.isNullOrEmpty() && uri.userInfo == null)
            return Intent(Intent.ACTION_VIEW, uri)
        }
    }
    private fun failureCode(failure: Exception): String {
        if (failure is org.json.JSONException) return "update_metadata_invalid_json"
        val code = failure.message.orEmpty()
        return if (code in setOf("update_network", "update_rate_limited", "update_invalid_release", "update_missing_digest", "update_digest_mismatch",
            "update_size_mismatch", "update_signature_mismatch", "update_package_mismatch", "update_version_mismatch", "update_android_version",
            "update_invalid_apk", "update_no_space", "update_cancelled", "update_invalid_url", "update_redirect_limit",
            "update_release_list_invalid", "update_metadata_invalid_json", "update_metadata_missing", "update_apk_missing",
            "update_asset_duplicate", "update_asset_not_ready", "update_asset_url_mismatch", "update_invalid_digest", "update_asset_size_invalid",
            "update_release_version_invalid", "update_release_tag_mismatch", "update_release_url_mismatch", "update_release_package_missing",
            "update_release_signing_unknown", "update_release_unsigned", "update_release_installability_unknown", "update_release_not_installable",
            "update_release_certificate_invalid", "update_plugin_version_invalid", "update_release_version_code_invalid",
            "update_metadata_size_mismatch", "update_metadata_digest_mismatch", "update_metadata_too_large",
            "update_version_not_newer", "update_debug_apk")) code else if (failure is java.io.IOException) "update_network" else "update_failed"
    }
}
