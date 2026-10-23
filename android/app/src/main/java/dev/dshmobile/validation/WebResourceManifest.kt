package dev.dshmobile.validation

import android.util.Base64
import org.json.JSONObject
import java.io.File
import java.security.KeyFactory
import java.security.MessageDigest
import java.security.Signature
import java.security.spec.X509EncodedKeySpec
import java.util.zip.ZipInputStream

internal data class WebResourceFile(val path: String, val bytes: Long, val sha256: String)
internal data class WebResourceManifest(val envelope: ByteArray, val revision: Long, val notes: String,
    val archive: UpdateAsset, val files: List<WebResourceFile>, val requiredPluginVersion: String) {
    val directoryName get() = "r$revision-${hash(envelope).take(16)}"
    companion object {
        const val TAG = "web-preview"
        const val PAGE = "https://github.com/${AppUpdateRelease.REPO}/releases/tag/$TAG"
        const val API = "https://api.github.com/repos/${AppUpdateRelease.REPO}/releases/tags/$TAG"
        const val MAX_MANIFEST = 2 * 1024 * 1024
        const val MAX_ARCHIVE = 64 * 1024 * 1024L
        const val MAX_CONTENT = 128 * 1024 * 1024L
        val entries = setOf("mobile.html", "remote.html", "startup.js", "startup.css", "mobile-main.js", "remote-main.js")
        fun hash(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
        fun hashFile(file: File): String {
            val digest = MessageDigest.getInstance("SHA-256")
            file.inputStream().use { input -> val buffer = ByteArray(64 * 1024); while (true) { val count = input.read(buffer); if (count < 0) break; digest.update(buffer, 0, count) } }
            return digest.digest().joinToString("") { "%02x".format(it) }
        }
        fun validPath(path: String): Boolean = path.length <= 240 && path.matches(Regex("[A-Za-z0-9_@][A-Za-z0-9_@./-]*")) &&
            path.split('/').all { it.isNotEmpty() && it != "." && it != ".." } &&
            path.matches(Regex(".+\\.(html|js|css|json|svg|png|jpe?g|gif|webp|ico|woff2?|ttf|otf|wasm|txt)"))
        private fun text(value: JSONObject, key: String): String {
            require(value.opt(key) is String) { "web_manifest_invalid" }; return value.getString(key)
        }
        private fun number(value: JSONObject, key: String, min: Long, max: Long): Long {
            val raw = value.opt(key)
            require(raw is Int || raw is Long) { "web_manifest_invalid" }
            return value.getLong(key).also { require(it in min..max) { "web_manifest_invalid" } }
        }
        fun parse(bytes: ByteArray, trust: JSONObject, applicationId: String, apkCode: Long, sdk: String): WebResourceManifest {
            require(bytes.size <= MAX_MANIFEST) { "web_manifest_invalid" }
            val envelope = JSONObject(bytes.toString(Charsets.UTF_8))
            require(envelope.keys().asSequence().toSet() == setOf("keyId", "payload", "signature")) { "web_manifest_invalid" }
            val keyId = text(envelope, "keyId")
            val keys = trust.getJSONArray("keys")
            val trusted = (0 until keys.length()).map { keys.getJSONObject(it) }.singleOrNull { it.getString("id") == keyId }
            require(trusted != null) { "web_signature_invalid" }
            val spki = Base64.decode(trusted.getString("spki"), Base64.NO_WRAP)
            require(hash(spki) == keyId) { "web_signature_invalid" }
            val payload = Base64.decode(text(envelope, "payload"), Base64.NO_WRAP)
            val signature = Signature.getInstance("SHA256withECDSA")
            signature.initVerify(KeyFactory.getInstance("EC").generatePublic(X509EncodedKeySpec(spki)))
            signature.update(payload)
            require(runCatching { signature.verify(Base64.decode(text(envelope, "signature"), Base64.NO_WRAP)) }.getOrDefault(false)) { "web_signature_invalid" }
            val value = JSONObject(payload.toString(Charsets.UTF_8))
            require(number(value, "schema", 1, 1) == 1L) { "web_manifest_invalid" }
            require(text(value, "applicationId") == applicationId) { "web_package_mismatch" }
            require(text(value, "channel") == "preview") { "web_manifest_invalid" }
            val revision = number(value, "revision", 1, 2147483647)
            val min = number(value, "minApkCode", 1, 2100000000)
            val max = number(value, "maxApkCode", min, 2100000000)
            require(apkCode in min..max) { "web_requires_apk" }
            require(number(value, "bridgeVersion", 1, 2147483647) == 1L && number(value, "dataVersion", 1, 2147483647) == 1L) { "web_requires_apk" }
            require(text(value, "sdkVersion") == sdk) { "web_sdk_mismatch" }
            val plugin = text(value, "requiredPluginVersion")
            require(plugin == BuildConfig.REQUIRED_PLUGIN_VERSION) { "web_plugin_mismatch" }
            val archive = value.getJSONObject("archive")
            val name = text(archive, "name")
            require(name == "dshm-web-r$revision.zip") { "web_manifest_invalid" }
            val digest = text(archive, "sha256")
            require(digest.matches(Regex("[a-f0-9]{64}"))) { "web_manifest_invalid" }
            val asset = UpdateAsset("https://github.com/${AppUpdateRelease.REPO}/releases/download/$TAG/$name", number(archive, "bytes", 1, MAX_ARCHIVE), digest)
            val rows = value.getJSONArray("files")
            require(rows.length() in 1..4096) { "web_manifest_invalid" }
            val files = (0 until rows.length()).map { index ->
                val row = rows.getJSONObject(index); val path = text(row, "path"); val hash = text(row, "sha256")
                require(validPath(path) && hash.matches(Regex("[a-f0-9]{64}"))) { "web_path_invalid" }
                WebResourceFile(path, number(row, "bytes", 0, MAX_CONTENT), hash)
            }
            require(files.map { it.path.lowercase(java.util.Locale.ROOT) }.toSet().size == files.size && files.sumOf { it.bytes } <= MAX_CONTENT) { "web_manifest_invalid" }
            require(files.map { it.path }.containsAll(entries)) { "web_manifest_invalid" }
            val notes = text(value, "notes"); require(notes.length <= 32000) { "web_manifest_invalid" }
            return WebResourceManifest(bytes, revision, notes, asset, files, plugin)
        }
    }
    fun unpack(archiveFile: File, target: File, cancelled: () -> Boolean = { false }) {
        require(!target.exists() && target.mkdirs()) { "web_storage_failed" }
        val expected = files.associateBy { it.path }; val seen = mutableSetOf<String>()
        try {
            ZipInputStream(archiveFile.inputStream().buffered()).use { zip ->
                while (true) {
                    if (cancelled()) throw java.io.IOException("update_cancelled")
                    val entry = zip.nextEntry ?: break
                    val file = expected[entry.name]
                    require(!entry.isDirectory && file != null && seen.add(entry.name)) { "web_path_invalid" }
                    val destination = File(target, entry.name)
                    require(destination.canonicalPath.startsWith(target.canonicalPath + File.separator)) { "web_path_invalid" }
                    require(destination.parentFile!!.isDirectory || destination.parentFile!!.mkdirs()) { "web_storage_failed" }
                    val digest = MessageDigest.getInstance("SHA-256"); var count = 0L
                    destination.outputStream().use { output ->
                        val buffer = ByteArray(64 * 1024)
                        while (true) {
                            if (cancelled()) throw java.io.IOException("update_cancelled")
                            val read = zip.read(buffer); if (read < 0) break
                            count += read; require(count <= file.bytes) { "web_file_invalid" }
                            output.write(buffer, 0, read); digest.update(buffer, 0, read)
                        }
                    }
                    require(count == file.bytes && digest.digest().joinToString("") { "%02x".format(it) } == file.sha256) { "web_file_invalid" }
                }
            }
            require(seen == expected.keys) { "web_file_invalid" }
        } catch (failure: Exception) {
            target.deleteRecursively()
            // 新Android会在nextEntry阶段先拒绝危险路径；同样作为损坏资源包处理。
            if (failure is java.util.zip.ZipException) throw IllegalArgumentException("web_archive_invalid", failure)
            throw failure
        }
    }
    fun verifyDirectory(directory: File) {
        val actual = directory.walkTopDown().filter { it.isFile }.map { it.relativeTo(directory).invariantSeparatorsPath }.toSet()
        require(actual == files.map { it.path }.toSet()) { "web_file_invalid" }
        for (entry in files) {
            val file = File(directory, entry.path)
            require(file.isFile && file.length() == entry.bytes) { "web_file_invalid" }
            val digest = MessageDigest.getInstance("SHA-256")
            file.inputStream().use { input -> val buffer = ByteArray(64 * 1024); while (true) { val n = input.read(buffer); if (n < 0) break; digest.update(buffer, 0, n) } }
            require(digest.digest().joinToString("") { "%02x".format(it) } == entry.sha256) { "web_file_invalid" }
        }
    }
}
