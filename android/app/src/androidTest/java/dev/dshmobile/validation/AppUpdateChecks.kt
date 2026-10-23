package dev.dshmobile.validation

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

internal object AppUpdateChecks {
    fun run(context: Context) {
        fun rejected(code: String, action: () -> Unit) {
            val failure = runCatching(action).exceptionOrNull()
            check(failure?.message == code) { "Expected $code, got ${failure?.message ?: "success"}" }
        }
        for (url in listOf("http://github.com/a", "https://github.com.evil.example/a", "https://github.com:444/a", "https://user:pass@github.com/a", "file:///data/update.apk"))
            check(!AppUpdateRelease.allowedDownload(url))
        check(AppUpdateRelease.allowedDownload("https://release-assets.githubusercontent.com/test"))
        val link = "https://github.com/KKUCODES/deepseek-harness-mobile/releases"
        val navigation = AppUpdates.externalLinkIntent(link)
        check(navigation.action == android.content.Intent.ACTION_VIEW && navigation.dataString == link)
        for (invalid in listOf("javascript:alert(1)", "file:///data/a.apk", "intent://example", "https://user:password@example.com", "https://"))
            check(runCatching { AppUpdates.externalLinkIntent(invalid) }.isFailure)
        val version = "0.1.0-preview.8"
        val release = JSONObject().put("tag_name", "v$version").put("html_url", "${AppUpdateRelease.PAGE}/tag/v$version")
            .put("draft", false).put("prerelease", true).put("body", "Synthetic test notes")
        fun asset(name: String) = JSONObject().put("name", name).put("state", "uploaded").put("size", 100)
            .put("digest", "sha256:" + "a".repeat(64)).put("browser_download_url", "https://github.com/${AppUpdateRelease.REPO}/releases/download/v$version/$name")
        release.put("assets", JSONArray().put(asset("compatibility.json")).put(asset("DSHM-$version.apk")))
        val metadata = JSONObject().put("version", version).put("versionCode", 10).put("applicationId", context.packageName)
            .put("signed", true).put("directlyInstallable", true).put("requiredPluginVersion", "0.1.87-latest.0")
            .put("signingCertificateSha256", "a".repeat(64))
        check(AppUpdateRelease.select(JSONArray().put(release), false) == null)
        check(AppUpdateRelease.select(JSONArray().put(release), true)?.getString("tag_name") == "v$version")
        val newer = JSONObject(release.toString()).put("tag_name", "v0.1.0-preview.10")
        check(AppUpdateRelease.select(JSONArray().put(release).put(newer), true)?.getString("tag_name") == "v0.1.0-preview.10")
        val parsed = AppUpdateRelease.parse(release, metadata, context.packageName)
        check(parsed.plugin == "0.1.87-latest.0" && parsed.code == 10L)
        check(AppUpdateRelease.restore(parsed.json()) == parsed)
        metadata.remove("requiredPluginVersion"); check(AppUpdateRelease.parse(release, metadata, context.packageName).plugin == null)
        fun metadataFailure(field: String, value: Any?, code: String) {
            val changed = JSONObject(metadata.toString()).put(field, value)
            rejected(code) { AppUpdateRelease.parse(release, changed, context.packageName) }
        }
        metadataFailure("applicationId", "another.application", "update_package_mismatch")
        metadataFailure("applicationId", null, "update_release_package_missing")
        metadataFailure("version", null, "update_release_version_invalid")
        metadataFailure("version", "invalid", "update_release_version_invalid")
        metadataFailure("version", "0.1.0-preview.9", "update_release_tag_mismatch")
        metadataFailure("versionCode", 10.5, "update_release_version_code_invalid")
        metadataFailure("versionCode", null, "update_release_version_code_invalid")
        metadataFailure("signed", null, "update_release_signing_unknown")
        metadataFailure("signed", false, "update_release_unsigned")
        metadataFailure("directlyInstallable", null, "update_release_installability_unknown")
        metadataFailure("directlyInstallable", false, "update_release_not_installable")
        metadataFailure("signingCertificateSha256", null, "update_release_certificate_invalid")
        metadataFailure("signingCertificateSha256", "bad", "update_release_certificate_invalid")
        metadataFailure("requiredPluginVersion", "invalid", "update_plugin_version_invalid")
        val badPage = JSONObject(release.toString()).put("html_url", "https://github.com/other/project")
        rejected("update_release_url_mismatch") { AppUpdateRelease.parse(badPage, metadata, context.packageName) }
        fun assetFailure(field: String, value: Any?, code: String) {
            val changed = JSONObject(release.toString())
            changed.getJSONArray("assets").getJSONObject(1).put(field, value)
            rejected(code) { AppUpdateRelease.parse(changed, metadata, context.packageName) }
        }
        assetFailure("browser_download_url", "https://github.com/other/project/update.apk", "update_asset_url_mismatch")
        assetFailure("state", "new", "update_asset_not_ready")
        assetFailure("digest", null, "update_missing_digest")
        assetFailure("digest", "bad", "update_invalid_digest")
        assetFailure("size", AppUpdateRelease.MAX_APK + 1, "update_asset_size_invalid")
        assetFailure("size", 10.5, "update_asset_size_invalid")
        val missingApk = JSONObject(release.toString()).put("assets", JSONArray().put(asset("compatibility.json")))
        rejected("update_apk_missing") { AppUpdateRelease.parse(missingApk, metadata, context.packageName) }
        val noAssets = JSONObject(release.toString()).put("assets", JSONArray())
        check(AppUpdateRelease.select(JSONArray().put(noAssets), true) != null)
        rejected("update_metadata_missing") { AppUpdateRelease.asset(noAssets, "compatibility.json", 256 * 1024) }
        val duplicate = JSONObject(release.toString())
        duplicate.getJSONArray("assets").put(asset("DSHM-$version.apk"))
        rejected("update_asset_duplicate") { AppUpdateRelease.parse(duplicate, metadata, context.packageName) }
        rejected("update_release_list_invalid") { AppUpdateRelease.releaseList("not JSON".toByteArray()) }
        rejected("update_release_list_invalid") { AppUpdateRelease.releaseList("[null]".toByteArray()) }
        rejected("update_metadata_invalid_json") { AppUpdateRelease.metadata("not JSON".toByteArray()) }
        val self = File(context.applicationInfo.sourceDir)
        val current = AppUpdateVerifier.current(context)
        val digest = java.security.MessageDigest.getInstance("SHA-256")
        self.inputStream().use { input -> val bytes = ByteArray(65536); while (true) { val count = input.read(bytes); if (count < 0) break; digest.update(bytes, 0, count) } }
        val hash = digest.digest().joinToString("") { "%02x".format(it) }
        val same = AppUpdateRelease(current.versionName!!, current.longVersionCode, "", "", UpdateAsset("", self.length(), hash), null)
        check(AppUpdateVerifier.signers(current).isNotEmpty())
        // 当前版本即使签名正确也不能被当作升级；摘要不符必须在打开安装器之前失败。
        rejected("update_version_not_newer") { AppUpdateVerifier.verify(context, self, same) }
        rejected("update_version_mismatch") { AppUpdateVerifier.verify(context, self, same.copy(code = same.code + 1)) }
        rejected("update_digest_mismatch") { AppUpdateVerifier.verify(context, self, same.copy(apk = same.apk.copy(sha256 = "0".repeat(64)))) }
        rejected("update_size_mismatch") { AppUpdateVerifier.verify(context, self, same.copy(apk = same.apk.copy(bytes = self.length() + 1))) }
        val testCache = File(context.cacheDir, "update-recovery-check").apply { mkdirs() }
        val isolated = object : android.content.ContextWrapper(context) { override fun getCacheDir() = testCache }
        try {
            val directory = File(testCache, "app-updates").apply { mkdirs() }
            val packages = File(directory, "packages").apply { mkdirs() }
            File(packages, "update.part").writeText("interrupted bytes")
            File(directory, "download.json").writeText(parsed.copy(code = BuildConfig.VERSION_CODE.toLong() + 1).json().toString())
            val restored = AppUpdates(isolated).snapshot()
            check(restored.getString("phase") == "cancelled" && restored.getString("error") == "update_download_interrupted")
            check(restored.getJSONObject("release").getString("version") == parsed.version)
            check(!File(packages, "update.part").exists())
            File(directory, "download.json").writeText("invalid JSON")
            File(packages, "update.apk").writeText("orphaned bytes")
            check(AppUpdates(isolated).snapshot().getString("phase") == "idle")
            check(!File(packages, "update.apk").exists())
            val notesOnly = AppUpdates(isolated)
            // 同版说明可以留在快照中；直接调用下载入口也不能启动传输。
            AppUpdates::class.java.getDeclaredField("candidate").apply { isAccessible = true }
                .set(notesOnly, parsed.copy(version = BuildConfig.VERSION_NAME, code = BuildConfig.VERSION_CODE.toLong()))
            notesOnly.download()
            check(notesOnly.snapshot().getString("phase") == "idle")
            check(!File(packages, "update.part").exists())
        } finally { testCache.deleteRecursively() }
    }
}
