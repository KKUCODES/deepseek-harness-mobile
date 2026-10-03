package dev.dshmobile.validation

import android.content.Context
import android.net.Uri
import android.util.Base64
import android.webkit.WebResourceRequest
import org.json.JSONObject
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

object RemoteHtmlChecks {
    fun run(context: Context) {
        var owner: Int? = 1
        val resources = RemoteHtmlResources(context) { owner }
        fun call(op: String, data: JSONObject = JSONObject()): JSONObject {
            val ready = CountDownLatch(1); var value: JSONObject? = null; var failure: String? = null
            resources.dispatch(op, data) { result, error -> value = result; failure = error; ready.countDown() }
            check(ready.await(5, TimeUnit.SECONDS)); check(failure == null) { failure ?: "missing" }
            return value!!
        }
        fun request(url: String, main: Boolean = false, verb: String = "GET") = object : WebResourceRequest {
            override fun getUrl() = Uri.parse(url)
            override fun isForMainFrame() = main
            override fun isRedirect() = false
            override fun hasGesture() = false
            override fun getMethod() = verb
            override fun getRequestHeaders() = emptyMap<String, String>()
        }
        try {
            val id = call("html.begin").getString("previewId")
            val data = "<!doctype html><h1>Independent HTML</h1>".toByteArray()
            val payload = JSONObject().put("previewId", id)
            call("html.chunk", JSONObject(payload.toString()).put("offset", 0).put("data", Base64.encodeToString(data, Base64.NO_WRAP)))
            val url = call("html.finish", JSONObject(payload.toString()).put("bytes", data.size)).getString("url")
            check(resources.intercept(request(url, true))!!.statusCode == 403)
            check(resources.intercept(request(url, verb = "POST"))!!.statusCode == 403)
            check(resources.intercept(request("$url?extra=1"))!!.statusCode == 403)
            check(resources.intercept(request("https://remote.dshm.invalid/assets/web/remote.html")) == null)
            val response = resources.intercept(request(url))!!
            check(response.statusCode == 200 && response.mimeType == "text/html")
            check(response.responseHeaders["Content-Security-Policy"]!!.contains("sandbox allow-scripts"))
            check(response.responseHeaders["Content-Security-Policy"]!!.contains("connect-src 'none'"))
            check(response.data.use { it.readBytes().contentEquals(data) })
            val pending = resources.intercept(request(url))!!.data
            check(pending.read() == '<'.code)
            resources.cancel()
            check(runCatching { pending.read() }.isFailure)
            check(resources.intercept(request(url))!!.statusCode == 403)
            val next = call("html.begin").getString("previewId")
            call("html.close", payload)
            val nextPayload = JSONObject().put("previewId", next)
            val nextUrl = call("html.finish", JSONObject(nextPayload.toString()).put("bytes", 0)).getString("url")
            check(resources.intercept(request(nextUrl))!!.data.use { it.read() } == -1)
            owner = null
            check(resources.intercept(request(nextUrl))!!.statusCode == 403)
            resources.cancel()
        } finally { resources.close() }
    }
}
