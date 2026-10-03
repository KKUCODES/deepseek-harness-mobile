package dev.dshmobile.validation

import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.MediaType.Companion.toMediaType
import org.json.JSONObject

/** 聊天桥与进程内只读提醒共用原DPoP请求构造，不另建凭据或认证协议。 */
internal class RemoteApi(private val http: OkHttpClient, private val identity: RemoteIdentity) {
    class Failure(val code: String) : Exception()
    fun call(origin: String, path: String, method: String, body: JSONObject? = null, authenticated: Boolean = true): JSONObject {
        val builder = Request.Builder().url(origin + path).header("DPoP", identity.proof(origin, path, method, authenticated))
        if (authenticated) builder.header("Authorization", identity.authorization())
        val bytes = body?.toString()?.toRequestBody("application/json".toMediaType())
        builder.method(method, if (method == "POST") bytes ?: ByteArray(0).toRequestBody(null) else null)
        http.newCall(builder.build()).execute().use { response ->
            if (!response.isSuccessful) throw Failure("http_${response.code}")
            val source = response.body?.source() ?: throw Failure("invalid_response")
            // 按上限读取，避免无 Content-Length 的无界正文。
            if (source.request(65_537)) throw Failure("response_too_large")
            return JSONObject(source.buffer.readUtf8())
        }
    }
}
