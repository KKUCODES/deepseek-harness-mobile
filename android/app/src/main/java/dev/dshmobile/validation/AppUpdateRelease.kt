package dev.dshmobile.validation

import okhttp3.HttpUrl.Companion.toHttpUrl
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest

internal data class UpdateAsset(val url: String, val bytes: Long, val sha256: String)
internal data class AppUpdateRelease(val version: String, val code: Long, val notes: String,
    val page: String, val apk: UpdateAsset, val plugin: String?) {
    fun json() = JSONObject().put("version", version).put("versionCode", code).put("notes", notes)
        .put("page", page).put("apkUrl", apk.url).put("bytes", apk.bytes).put("sha256", apk.sha256)
        .put("requiredPluginVersion", plugin ?: JSONObject.NULL)
    companion object {
        const val REPO = "KKUCODES/deepseek-harness-mobile"
        const val PAGE = "https://github.com/$REPO/releases"
        const val API = "https://api.github.com/repos/$REPO/releases?per_page=20"
        const val MAX_APK = 256L * 1024 * 1024
        private val versionPattern = Regex("[0-9]+\\.[0-9]+\\.[0-9]+(?:-[A-Za-z0-9-]+(?:\\.[A-Za-z0-9-]+)*)?")
        fun version(value: String): Boolean = value.length <= 120 && versionPattern.matches(value)
        private fun compareVersions(left: String, right: String): Int {
            val a = left.split('-', limit = 2); val b = right.split('-', limit = 2)
            val first = a[0].split('.').map { it.toBigInteger() }; val second = b[0].split('.').map { it.toBigInteger() }
            for (index in 0..2) { val compared = first[index].compareTo(second[index]); if (compared != 0) return compared }
            if (a.size != b.size) return if (a.size == 1) 1 else -1
            if (a.size == 1) return 0
            val x = a[1].split('.'); val y = b[1].split('.')
            for (index in 0 until minOf(x.size, y.size)) {
                val numericX = x[index].all { it.isDigit() }; val numericY = y[index].all { it.isDigit() }
                val compared = if (numericX && numericY) x[index].toBigInteger().compareTo(y[index].toBigInteger())
                    else if (numericX != numericY) if (numericX) -1 else 1 else x[index].compareTo(y[index])
                if (compared != 0) return compared
            }
            return x.size.compareTo(y.size)
        }
        fun hash(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
        fun integer(json: JSONObject, name: String, max: Long, error: String = "update_invalid_release"): Long {
            val raw = json.opt(name)
            require(raw is Number && raw.toLong() in 1..max && raw.toDouble() == raw.toLong().toDouble()) { error }
            return raw.toLong()
        }
        fun releaseList(bytes: ByteArray): JSONArray = try { JSONArray(bytes.toString(Charsets.UTF_8)).also { list ->
            require((0 until list.length()).all { list.optJSONObject(it) != null }) { "update_release_list_invalid" }
        } }
            catch (_: org.json.JSONException) { throw IllegalArgumentException("update_release_list_invalid") }
        fun metadata(bytes: ByteArray): JSONObject = try { JSONObject(bytes.toString(Charsets.UTF_8)) }
            catch (_: org.json.JSONException) { throw IllegalArgumentException("update_metadata_invalid_json") }
        /** 只跟随当前渠道；公开预览不能使用GitHub排除预览版的latest接口。 */
        fun select(list: JSONArray, previews: Boolean): JSONObject? = (0 until list.length()).asSequence()
            .map { list.getJSONObject(it) }.filter {
                !it.optBoolean("draft", true) && (previews || !it.optBoolean("prerelease", true)) &&
                    it.optString("tag_name").let { tag -> tag.startsWith("v") && version(tag.drop(1)) }
            }.maxWithOrNull { left, right -> compareVersions(left.getString("tag_name").drop(1), right.getString("tag_name").drop(1)) }
        fun asset(release: JSONObject, name: String, max: Long): UpdateAsset {
            val assets = release.optJSONArray("assets") ?: JSONArray()
            val found = (0 until assets.length()).mapNotNull { assets.optJSONObject(it) }.filter { it.optString("name") == name }
            require(found.isNotEmpty()) { if (name == "compatibility.json") "update_metadata_missing" else "update_apk_missing" }
            require(found.size == 1) { "update_asset_duplicate" }
            val asset = found.single()
            val tag = release.getString("tag_name")
            val url = "https://github.com/$REPO/releases/download/$tag/$name"
            require(asset.optString("browser_download_url") == url) { "update_asset_url_mismatch" }
            require(asset.optString("state") == "uploaded") { "update_asset_not_ready" }
            val digest = asset.optString("digest")
            require(digest.isNotBlank() && !asset.isNull("digest")) { "update_missing_digest" }
            require(digest.matches(Regex("sha256:[a-f0-9]{64}"))) { "update_invalid_digest" }
            return UpdateAsset(url, integer(asset, "size", max, "update_asset_size_invalid"), digest.removePrefix("sha256:"))
        }
        fun parse(release: JSONObject, metadata: JSONObject, packageName: String): AppUpdateRelease {
            val version = metadata.optString("version")
            require(version(version)) { "update_release_version_invalid" }
            require(release.optString("tag_name") == "v$version") { "update_release_tag_mismatch" }
            require(release.optString("html_url") == "$PAGE/tag/v$version") { "update_release_url_mismatch" }
            require(metadata.opt("applicationId") is String && metadata.optString("applicationId").isNotBlank()) { "update_release_package_missing" }
            require(metadata.getString("applicationId") == packageName) { "update_package_mismatch" }
            require(metadata.opt("signed") is Boolean) { "update_release_signing_unknown" }
            require(metadata.getBoolean("signed")) { "update_release_unsigned" }
            require(metadata.opt("directlyInstallable") is Boolean) { "update_release_installability_unknown" }
            require(metadata.getBoolean("directlyInstallable")) { "update_release_not_installable" }
            require(metadata.optString("signingCertificateSha256").matches(Regex("[a-f0-9]{64}"))) { "update_release_certificate_invalid" }
            val plugin = if (metadata.isNull("requiredPluginVersion")) null else metadata.optString("requiredPluginVersion").also {
                require(version(it)) { "update_plugin_version_invalid" }
            }
            return AppUpdateRelease(version, integer(metadata, "versionCode", 2100000000, "update_release_version_code_invalid"),
                release.optString("body").take(32000), "$PAGE/tag/v$version",
                asset(release, "DSHM-$version.apk", MAX_APK), plugin)
        }
        fun restore(value: JSONObject): AppUpdateRelease {
            val version = value.getString("version")
            require(version(version) && value.getString("page") == "$PAGE/tag/v$version" &&
                value.getString("apkUrl") == "https://github.com/$REPO/releases/download/v$version/DSHM-$version.apk" &&
                value.getString("sha256").matches(Regex("[a-f0-9]{64}"))) { "update_invalid_release" }
            val plugin = if (value.isNull("requiredPluginVersion")) null else value.getString("requiredPluginVersion").also { require(version(it)) }
            return AppUpdateRelease(version, integer(value, "versionCode", 2100000000), value.getString("notes").take(32000),
                value.getString("page"), UpdateAsset(value.getString("apkUrl"), integer(value, "bytes", MAX_APK), value.getString("sha256")), plugin)
        }
        fun allowedDownload(url: String): Boolean = runCatching {
            val parsed = url.toHttpUrl()
            parsed.scheme == "https" && parsed.port == 443 && parsed.username.isEmpty() && parsed.password.isEmpty() &&
                parsed.host in setOf("api.github.com", "github.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com")
        }.getOrDefault(false)
    }
}
