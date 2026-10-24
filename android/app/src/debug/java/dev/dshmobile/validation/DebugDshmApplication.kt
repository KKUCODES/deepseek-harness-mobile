package dev.dshmobile.validation

import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/** 仅独立Debug UID接受本地下载回放；Release源码集不包含此入口，签名及加载器仍用生产实现。 */
class DebugDshmApplication : DshmApplication() {
    internal override fun createAppUpdates(): AppUpdates {
        if (packageName != "dev.dshmobile.validation.updaterestarttest") return super.createAppUpdates()
        // 独立本地验收没有对应的公开APK发行，使用空列表；不能冒充公开APK版本/签名匹配。
        val client = OkHttpClient.Builder().addInterceptor { chain ->
            check(chain.request().url.toString() == AppUpdateRelease.API)
            Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(200).message("OK").body("[]".toResponseBody()).build()
        }.build()
        return AppUpdates(this) { AppUpdateHttp(client) }
    }
    internal override fun createWebUpdates(): WebUpdates {
        val root = File(cacheDir, "web-restart-fixture")
        if (packageName !in setOf("dev.dshmobile.validation.rc21test", "dev.dshmobile.validation.updaterestarttest") || !File(root, "web-update.json").isFile) return super.createWebUpdates()
        val envelope = File(root, "web-update.json").readBytes()
        val payload = JSONObject(android.util.Base64.decode(JSONObject(envelope.toString(Charsets.UTF_8)).getString("payload"), android.util.Base64.NO_WRAP).toString(Charsets.UTF_8))
        val name = payload.getJSONObject("archive").getString("name")
        check(name.matches(Regex("dshm-web-r[1-9][0-9]*\\.zip")))
        val archive = File(root, name).readBytes()
        val base = "https://github.com/${AppUpdateRelease.REPO}/releases/download/${WebResourceManifest.TAG}/"
        fun asset(name: String, bytes: ByteArray) = JSONObject().put("name", name).put("browser_download_url", base + name)
            .put("state", "uploaded").put("size", bytes.size).put("digest", "sha256:" + WebResourceManifest.hash(bytes))
        val release = JSONObject().put("tag_name", WebResourceManifest.TAG).put("html_url", WebResourceManifest.PAGE).put("draft", false)
            .put("assets", JSONArray().put(asset("web-update.json", envelope)).put(asset(name, archive))).toString().toByteArray()
        val client = OkHttpClient.Builder().addInterceptor { chain ->
            val bytes = when (chain.request().url.toString()) {
                WebResourceManifest.API -> release
                base + "web-update.json" -> envelope
                base + name -> archive
                else -> error("Unexpected fixture resource URL")
            }
            Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(200).message("OK").body(bytes.toResponseBody()).build()
        }.build()
        return WebUpdates(this) { AppUpdateHttp(client) }
    }
}
