package dev.dshmobile.validation

import android.content.Context
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.os.Build
import java.io.File
import java.security.MessageDigest

internal object AppUpdateVerifier {
    @Suppress("DEPRECATION")
    fun current(context: Context): PackageInfo = context.packageManager.getPackageInfo(context.packageName, PackageManager.GET_SIGNING_CERTIFICATES)
    fun signers(info: PackageInfo): Set<String> = info.signingInfo?.apkContentsSigners
        ?.map { AppUpdateRelease.hash(it.toByteArray()) }?.toSet().orEmpty()
    @Suppress("DEPRECATION")
    fun verify(context: Context, file: File, release: AppUpdateRelease) {
        require(file.isFile && file.length() == release.apk.bytes) { "update_size_mismatch" }
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input -> val buffer = ByteArray(64 * 1024); while (true) {
            val count = input.read(buffer); if (count < 0) break; digest.update(buffer, 0, count)
        } }
        require(digest.digest().joinToString("") { "%02x".format(it) } == release.apk.sha256) { "update_digest_mismatch" }
        val archive = context.packageManager.getPackageArchiveInfo(file.absolutePath, PackageManager.GET_SIGNING_CERTIFICATES)
            ?: throw IllegalArgumentException("update_invalid_apk")
        require(archive.packageName == context.packageName) { "update_package_mismatch" }
        val current = current(context)
        require(archive.longVersionCode == release.code && archive.versionName == release.version) { "update_version_mismatch" }
        require(archive.longVersionCode > current.longVersionCode) { "update_version_not_newer" }
        require(archive.applicationInfo?.minSdkVersion?.let { it <= Build.VERSION.SDK_INT } == true) { "update_android_version" }
        require((archive.applicationInfo!!.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) == 0) { "update_debug_apk" }
        // 首版保持原签名；不把历史证书当成当前签名接受，也不尝试自动迁移签名身份。
        val installed = signers(current)
        require(installed.isNotEmpty() && installed == signers(archive)) { "update_signature_mismatch" }
    }
}
