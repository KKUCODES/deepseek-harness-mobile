package dev.dshmobile.validation

import okhttp3.Call
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import java.io.File
import java.io.IOException
import java.security.MessageDigest
import java.util.concurrent.TimeUnit

/** 独立无凭据HTTP客户端；每次重定向重新核对HTTPS主机，不借用聊天或Remote的网络身份。 */
internal class AppUpdateHttp {
    private val client = OkHttpClient.Builder().followRedirects(false).followSslRedirects(false)
        .connectTimeout(20, TimeUnit.SECONDS).readTimeout(30, TimeUnit.SECONDS).callTimeout(5, TimeUnit.MINUTES).build()
    @Volatile private var active: Call? = null
    @Volatile private var cancelled = false
    fun cancel() { cancelled = true; active?.cancel() }
    private fun open(url: String, etag: String? = null): Response {
        var target = url
        repeat(6) {
            if (cancelled) throw IOException("update_cancelled")
            require(AppUpdateRelease.allowedDownload(target)) { "update_invalid_url" }
            val request = Request.Builder().url(target).header("User-Agent", "DSHM/${BuildConfig.VERSION_NAME}")
                .header("Accept", if (target.startsWith("https://api.github.com/")) "application/vnd.github+json" else "application/octet-stream")
            if (etag != null && target == url) request.header("If-None-Match", etag)
            val call = client.newCall(request.build()); active = call
            if (cancelled) { call.cancel(); throw IOException("update_cancelled") }
            val response = call.execute()
            if (response.code !in setOf(301, 302, 303, 307, 308)) return response
            target = response.header("Location")?.let { response.request.url.resolve(it)?.toString() }.orEmpty()
            response.close()
        }
        throw IOException("update_redirect_limit")
    }
    fun json(url: String, max: Int, etag: String? = null): Pair<ByteArray?, String?> = open(url, etag).use { response ->
        if (response.code == 304) return Pair(null, etag)
        if (response.code == 403 || response.code == 429) throw IOException("update_rate_limited")
        if (!response.isSuccessful) throw IOException("update_network")
        val body = response.body ?: throw IOException("update_network")
        if (body.contentLength() > max) throw IOException("update_metadata_too_large")
        val output = java.io.ByteArrayOutputStream()
        body.byteStream().use { input ->
            val buffer = ByteArray(8192)
            while (true) {
                val read = input.read(buffer); if (read < 0) break
                if (cancelled) throw IOException("update_cancelled")
                if (output.size() + read > max) throw IOException("update_metadata_too_large")
                output.write(buffer, 0, read)
            }
        }
        Pair(output.toByteArray(), response.header("ETag"))
    }
    fun download(asset: UpdateAsset, file: File, progress: (Long) -> Unit) = open(asset.url).use { response ->
        if (!response.isSuccessful) throw IOException("update_network")
        val body = response.body ?: throw IOException("update_network")
        if (body.contentLength() >= 0 && body.contentLength() != asset.bytes) throw IOException("update_size_mismatch")
        val digest = MessageDigest.getInstance("SHA-256")
        var bytes = 0L
        body.byteStream().use { input -> file.outputStream().use { output ->
            val buffer = ByteArray(64 * 1024)
            while (true) {
                if (cancelled) throw IOException("update_cancelled")
                val read = input.read(buffer); if (read < 0) break
                bytes += read
                if (bytes > asset.bytes) throw IOException("update_size_mismatch")
                digest.update(buffer, 0, read); output.write(buffer, 0, read); progress(bytes)
            }
        } }
        if (bytes != asset.bytes) throw IOException("update_size_mismatch")
        if (digest.digest().joinToString("") { "%02x".format(it) } != asset.sha256) throw IOException("update_digest_mismatch")
    }
}
