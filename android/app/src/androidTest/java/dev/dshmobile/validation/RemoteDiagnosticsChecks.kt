package dev.dshmobile.validation

import android.content.Context
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.io.IOException
import java.net.Proxy
import java.net.ServerSocket
import java.net.SocketTimeoutException
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** 独立偏好和回环服务器；不访问已有身份、模型、配对或用户诊断记录。 */
object RemoteDiagnosticsChecks {
    fun run(context: Context) {
        val preferences = context.getSharedPreferences("diagnostic-check-${UUID.randomUUID()}", Context.MODE_PRIVATE)
        var time = System.currentTimeMillis()
        val diagnostics = RemoteDiagnostics(preferences) { time }
        try {
            val secret = "SENSITIVE_MARKER"
            val error = IOException("https://private.invalid/?token=$secret", SocketTimeoutException(secret))
            error.stackTrace = arrayOf(StackTraceElement("okhttp3.internal.ws.RealWebSocket", "checkUpgradeSuccess", "RealWebSocket.kt", 224),
                StackTraceElement("private.$secret", "method", "/private/$secret.kt", 9))
            val first = diagnostics.failure("reading", error)
            check(first.getString("code") == "network_timeout")
            check(!diagnostics.read().toString().contains(secret))
            check(!preferences.all.toString().contains(secret))
            check(diagnostics.read().toString().contains("RealWebSocket.kt:224"))
            diagnostics.failure("reading", error)
            check(diagnostics.read().getJSONArray("records").length() == 1)
            diagnostics.recovered()
            check(diagnostics.read().getJSONArray("records").getJSONObject(0).has("resolvedAt"))
            for (index in 0..14) { time += 2000; diagnostics.failure("websocket", httpStatus = 404) }
            for (index in 0..14) { time += 2000; diagnostics.failure("notifications", code = "host_offline", source = "notifications") }
            val records = diagnostics.read().getJSONArray("records")
            check(records.length() == 10)
            check((0 until records.length()).count { records.getJSONObject(it).getString("source") == "remote" } == 5)
            val restored = RemoteDiagnostics(preferences).read().getJSONArray("records")
            check(restored.length() == records.length())
            for (index in 0 until records.length()) {
                val expected = records.getJSONObject(index)
                val actual = restored.getJSONObject(index)
                for (field in listOf("id", "at", "source", "phase", "code", "httpStatus")) check(actual.opt(field) == expected.opt(field))
            }
            time += 2000
            val closed = diagnostics.failure("connection", closeCode = 1001, reason = secret)
            check(closed.getJSONArray("exceptions").length() == 0 && !closed.has("closeReason"))
            check(!diagnostics.read().toString().contains(secret))
            diagnostics.clear()
            check(RemoteDiagnostics(preferences).read().getJSONArray("records").length() == 0)
            handshake(diagnostics)
        } finally { preferences.edit().clear().commit() }
    }
    private fun handshake(diagnostics: RemoteDiagnostics) {
        val latch = CountDownLatch(1)
        val server = ServerSocket(0).apply { soTimeout = 8000 }
        val thread = Thread {
            try { server.accept().use { socket ->
                socket.soTimeout = 5000
                val reader = socket.getInputStream().bufferedReader()
                while (!reader.readLine().isNullOrEmpty()) { }
                socket.getOutputStream().write("HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".toByteArray())
            } } finally { server.close() }
        }.apply { start() }
        val client = OkHttpClient.Builder().proxy(Proxy.NO_PROXY).build()
        val socket = client.newWebSocket(Request.Builder().url("http://127.0.0.1:${server.localPort}/socket").build(), object : WebSocketListener() {
            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                diagnostics.failure("websocket", t, httpStatus = response?.code); latch.countDown()
            }
        })
        try {
            check(latch.await(10, TimeUnit.SECONDS))
            val record = diagnostics.read().getJSONArray("records").getJSONObject(0)
            check(record.getInt("httpStatus") == 404 && record.getString("code") == "http_404")
            check(record.getJSONArray("exceptions").length() > 0)
        } finally {
            socket.cancel(); server.close(); thread.join(5000); client.dispatcher.executorService.shutdown(); client.connectionPool.evictAll()
        }
    }
}
