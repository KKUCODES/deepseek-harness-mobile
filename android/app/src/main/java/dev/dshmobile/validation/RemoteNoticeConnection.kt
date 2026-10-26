package dev.dshmobile.validation

import android.content.Context
import android.os.Handler
import android.os.Looper
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

/** 应用进程内的独立只读连接。只协商并订阅提醒，不加载页面、不发送模型消息，也不唤醒进程。 */
internal class RemoteNoticeConnection(context: Context, private val notices: RemoteNotifications) {
    private val diagnostics = (context.applicationContext as? DshmApplication)?.remoteDiagnostics
    private val preferences = context.getSharedPreferences("dshm.remote.notice-connection.v1", Context.MODE_PRIVATE)
    private val identity by lazy { RemoteIdentity(context) }
    private val worker = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private val http = OkHttpClient.Builder().followRedirects(false).followSslRedirects(false)
        .connectionPool(okhttp3.ConnectionPool(0, 1, TimeUnit.SECONDS)).retryOnConnectionFailure(false)
        .connectTimeout(10, TimeUnit.SECONDS).readTimeout(20, TimeUnit.SECONDS).callTimeout(25, TimeUnit.SECONDS)
        .pingInterval(20, TimeUnit.SECONDS).build()
    private var epoch = 0
    private var socket: WebSocket? = null
    private var binding: String? = null
    private var ledger = RemoteNoticeLedger()
    private var attempt = 0
    private var timer: Runnable? = null
    private var stage = "idle"
    private var negotiateId = ""
    private var followId = ""
    private var previews = false
    private var status = "idle"
    private val listeners = linkedSetOf<() -> Unit>()

    fun snapshot() = JSONObject().put("status", status)
    fun label(resources: android.content.res.Resources) = resources.getString(when (status) {
        "listening" -> R.string.notice_connected
        "connecting", "retrying" -> R.string.notice_connecting
        "paused" -> R.string.notice_disconnected
        "unpaired" -> R.string.notice_unpaired
        "unauthorized" -> R.string.notice_unauthorized
        "unsupported" -> R.string.notice_unsupported
        else -> R.string.notice_unavailable
    })
    fun subscribe(listener: () -> Unit): () -> Unit { listeners.add(listener); return { listeners.remove(listener) } }
    private fun publish(value: String) {
        if (status == value) return
        status = value
        if (BuildConfig.DEBUG) android.util.Log.d("DSHMNoticeConnection", value)
        listeners.toList().forEach { it() }
    }
    fun start() {
        if (preferences.getBoolean("paused", false)) { notices.retainBinding(null); publish("paused"); return }
        connect()
    }
    fun resume() {
        if (status in setOf("connecting", "listening", "retrying")) return
        restart()
    }
    fun restart() {
        check(preferences.edit().putBoolean("paused", false).commit())
        attempt = 0; connect()
    }
    fun pause(forget: Boolean = false) {
        // 显式断开才持久化暂停；Activity销毁与页面内部重连不能调用这里。
        check(preferences.edit().putBoolean("paused", true).commit())
        closeAttempt(); notices.retainBinding(null)
        if (forget) { binding = null; ledger = RemoteNoticeLedger() }
        publish("paused")
    }
    fun authorizationLost() {
        closeAttempt(); notices.retainBinding(null); publish("unauthorized")
    }
    private fun closeAttempt() {
        epoch++
        timer?.let(main::removeCallbacks); timer = null
        socket?.cancel(); socket = null
        http.dispatcher.cancelAll()
        stage = "idle"
    }
    private fun deadline(owner: Int) {
        timer?.let(main::removeCallbacks)
        timer = Runnable { if (epoch == owner) {
            diagnostics?.failure("notifications", code = "network_timeout", source = "notifications"); failed()
        } }.also { main.postDelayed(it, 35_000) }
    }
    private fun failed(terminal: String? = null) {
        closeAttempt()
        if (terminal != null) {
            notices.retainBinding(null); publish(terminal); return
        }
        publish("retrying")
        val owner = epoch
        val delay = (1000L shl attempt.coerceAtMost(5)).coerceAtMost(30_000)
        attempt = (attempt + 1).coerceAtMost(5)
        timer = Runnable { if (epoch == owner) connect() }.also { main.postDelayed(it, delay) }
    }
    private fun connect() {
        closeAttempt()
        val owner = epoch
        publish("connecting"); deadline(owner)
        worker.execute {
            try {
                if (!identity.paired()) { main.post { if (epoch == owner) { closeAttempt(); notices.retainBinding(null); publish("unpaired") } }; return@execute }
                val info = identity.info()
                val origin = info.getString("origin")
                val nextBinding = RemoteNotifications.binding(info)
                val ticket = RemoteApi(http, identity).call(origin, "/v1/device/ticket", "POST").getString("ticket")
                require(ticket.matches(Regex("[A-Za-z0-9_-]{43}")))
                main.post {
                    if (epoch != owner) return@post
                    notices.retainBinding(nextBinding)
                    if (binding != nextBinding) { binding?.let(notices::clear); binding = nextBinding; ledger = RemoteNoticeLedger() }
                    ledger.reconnect(); stage = "authenticating"
                    open(origin, ticket, owner)
                }
            } catch (error: Exception) {
                main.post { if (epoch == owner) {
                    diagnostics?.failure("ticket", error, httpStatus = (error as? RemoteApi.Failure)?.code?.removePrefix("http_")?.toIntOrNull(), source = "notifications")
                    failed(if (error is RemoteApi.Failure && error.code in setOf("http_401", "http_403")) "unauthorized" else null)
                } }
            }
        }
    }
    private fun open(origin: String, ticket: String, owner: Int) {
        // 对每代连接分别限制排队帧，旧连接迟到回调不能消耗新连接的额度。
        val queued = AtomicInteger()
        socket = http.newWebSocket(Request.Builder().url(origin + "/v1/device/socket").build(), object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                main.post {
                    if (epoch != owner) { webSocket.cancel(); return@post }
                    if (!webSocket.send(JSONObject().put("type", "authenticate").put("ticket", ticket).toString())) failed()
                }
            }
            override fun onMessage(webSocket: WebSocket, text: String) {
                if (text.length > 262_144 || text.toByteArray(Charsets.UTF_8).size > 262_144 || queued.incrementAndGet() > 256) {
                    webSocket.cancel(); return
                }
                main.post {
                    queued.decrementAndGet()
                    if (epoch != owner) return@post
                    try { receive(JSONObject(text), owner) } catch (_: Exception) { failed() }
                }
            }
            override fun onMessage(webSocket: WebSocket, bytes: ByteString) { webSocket.cancel() }
            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                webSocket.close(code, null); ended(owner, reason, closeCode = code)
            }
            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) = ended(owner, reason, closeCode = code)
            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) = ended(owner, null, t, response?.code)
        })
    }
    private fun ended(owner: Int, reason: String?, error: Throwable? = null, httpStatus: Int? = null, closeCode: Int? = null) {
        main.post {
            if (epoch == owner) {
                diagnostics?.failure(if (stage == "authenticating") "websocket" else "notifications", error, httpStatus, closeCode, reason, source = "notifications")
                failed(if (reason in setOf("device_revoked", "permissions_changed", "credential_expired", "invalid_authentication")) "unauthorized" else null)
            }
        }
    }
    private fun send(id: String, operation: JSONObject) {
        check(socket?.send(JSONObject().put("type", "request").put("id", id).put("operation", operation).toString()) == true)
    }
    private fun receive(frame: JSONObject, owner: Int) {
        val type = frame.getString("type")
        if (stage == "authenticating") {
            require(type == "ready" && frame.get("protocol") == 1 && frame.get("hostOnline") is Boolean)
            if (!frame.getBoolean("hostOnline")) { diagnostics?.failure("notifications", code = "host_offline", source = "notifications"); failed(); return }
            stage = "negotiating"; negotiateId = UUID.randomUUID().toString(); deadline(owner)
            send(negotiateId, JSONObject().put("method", "remote.negotiate").put("version", 2)); return
        }
        val expected = if (stage == "negotiating") negotiateId else followId
        require(frame.getString("id") == expected)
        if (type == "error" || type == "end") {
            // 仅记录固定错误分类，便于核验实际溢出恢复；不输出帧、身份或通知内容。
            if (BuildConfig.DEBUG && type == "error" && frame.optString("code") == "remote_notifications_overflow")
                android.util.Log.d("DSHMNoticeConnection", "stream_overflow")
            failed(if (frame.optString("code") in setOf("host_upgrade_required", "unsupported_dsh_version", "unsupported_dsh_capabilities", "unsupported_remote_capabilities")) "unsupported" else null); return
        }
        if (stage == "negotiating") {
            require(type == "result")
            val value = frame.getJSONObject("value")
            val hostVersion = value.optString("dshVersion")
            val channels = value.optJSONArray("channels")
            val streamAvailable = channels != null && (0 until channels.length()).any { channels.optString(it) == "stream" }
            if (value.optInt("transport") != 2 || !RemoteDshCompatibility.accepts(BuildConfig.DSH_SDK_VERSION, hostVersion)
                || !streamAvailable || value.opt("taskNotifications") != true) {
                failed("unsupported"); return
            }
            stage = "subscribing"; followId = UUID.randomUUID().toString(); deadline(owner)
            previews = value.opt("taskNotificationPreview") == 1
            val operation = JSONObject().put("method", "remote.taskFollow")
            if (previews) operation.put("previewVersion", 1)
            send(followId, operation); return
        }
        require(type == "event" && stage in setOf("subscribing", "listening"))
        val bound = binding ?: error("not_bound")
        ledger.receive(frame.getJSONObject("value"), { notices.baseline(bound, it) }, { notices.resolve(bound, it) },
            { key, session, kind, reason, preview -> notices.push(bound, key, session, kind, reason, preview) }, previews)
        timer?.let(main::removeCallbacks); timer = null
        stage = "listening"; attempt = 0; diagnostics?.recovered("notifications"); publish("listening")
    }
}
