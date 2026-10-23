package dev.dshmobile.validation

import android.app.Activity
import android.webkit.WebView
import android.webkit.WebResourceRequest
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/** 单独 WebView、origin、桥和凭据；没有普通聊天 Key 或任意 HTTP 请求入口。 */
class RemoteBridge(private val activity: Activity, private val webView: WebView, private val openOrdinary: (Boolean) -> Unit = { activity.finish() }) {
    private val identity = RemoteIdentity(activity)
    private val worker = Executors.newSingleThreadExecutor()
    private val http = OkHttpClient.Builder().followRedirects(false).followSslRedirects(false)
        // 网关/代理会关闭空闲 HTTP；禁重试时复用它会让首次重连 EOF。
        // 配对和票据请求低频，直接释放空闲连接，不能靠重放写请求掩盖失败。
        .connectionPool(okhttp3.ConnectionPool(0, 1, TimeUnit.SECONDS))
        .retryOnConnectionFailure(false).connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS).callTimeout(25, TimeUnit.SECONDS)
        .pingInterval(20, TimeUnit.SECONDS).build()
    @Volatile private var closed = false
    private var pending = 0
    private var pairLink: String? = null
    private val scanner = RemotePairScanner(activity) {
        !closed && !identity.paired() && !html.isActive && webView.url == ORIGIN + "/assets/web/remote.html"
    }
    internal fun offerPairLink(raw: String) {
        if (!closed && !identity.paired()) {
            scanner.cancel()
            pairLink = RemotePairLink.parse(raw)?.canonical
        }
    }
    @Volatile private var generation = 0
    @Volatile private var socket: WebSocket? = null
    @Volatile private var ready = false
    fun connectionGeneration(): Int? = if (ready && !closed) generation else null
    private val noticeConnection get() = (activity.application as DshmApplication).noticeConnection
    private val notifications = RemoteNotificationBridge(activity, identity)
    private val stopAppearance = (activity.application as DshmApplication).appearance.subscribe {
        // 外观事件只投递给顶层 DSHM。HTML 子框架存在不应阻止父页面同步。
        if (!closed && webView.url == ORIGIN + "/assets/web/remote.html")
            webView.evaluateJavascript("window.dispatchEvent(new Event('dshm-appearance-change'))", null)
    }
    private val stopNoticeStatus = noticeConnection.subscribe {
        if (!closed && !html.isActive && webView.url == ORIGIN + "/assets/web/remote.html")
            webView.evaluateJavascript("window.dispatchEvent(new Event('dshm-notification-status'))", null)
    }
    private val computerKey = RemoteComputerKey(activity, ::connectionGeneration, { frame ->
        ready && !closed && (socket?.queueSize() ?: 0L) <= 4 * 1024 * 1024 && socket?.send(frame.toString()) == true
    }, { identity.origin.startsWith("http:") })
    private val downloads = RemoteDownloads(activity, ::connectionGeneration)
    private val modelProbe = RemoteModelProbe(activity, ::connectionGeneration, { frame ->
        ready && !closed && (socket?.queueSize() ?: 0L) <= 4 * 1024 * 1024 && socket?.send(frame.toString()) == true
    }, { identity.origin.startsWith("http:") })
    private val html = RemoteHtmlResources(activity, ::connectionGeneration)
    fun htmlResource(request: WebResourceRequest) = html.intercept(request)
    fun allowsHtmlNavigation(request: WebResourceRequest) = !request.isForMainFrame && html.owns(request.url)
    fun hasHtmlPreview() = html.isActive
    fun onActivityResult(requestCode: Int, resultCode: Int, data: android.content.Intent?) = scanner.onResult(requestCode, resultCode, data) || downloads.onResult(requestCode, resultCode, data)
    private val resources = RemoteResources(java.io.File(activity.cacheDir, "remote-resources"), {
        if (ready && !closed && identity.paired()) identity.info().toString() else null
    }) { frame ->
        ready && !closed && (socket?.queueSize() ?: 0L) <= 4 * 1024 * 1024 && socket?.send(frame.toString()) == true
    }
    fun resource(request: WebResourceRequest) = resources.intercept(request)
    private val stopCacheClear = (activity.application as DshmApplication).observeCacheClear {
        if (!closed) webView.evaluateJavascript("window.dispatchEvent(new Event('dshm-cache-clear'))", null)
    }
    private class Failure(val code: String) : Exception()

    fun install() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return
        WebViewCompat.addWebMessageListener(webView, "DSHMRemote", setOf(ORIGIN)) { _, message, source, main, reply ->
            if (closed || !main || source.toString() != ORIGIN) return@addWebMessageListener
            var id = ""
            try {
                val raw = message.data ?: throw Failure("invalid_request")
                if (raw.length > 300_000 || pending >= 8) throw Failure("request_limit")
                val request = JSONObject(raw)
                id = request.getString("id")
                UUID.fromString(id)
                val data = request.optJSONObject("data") ?: JSONObject()
                when (request.getString("op")) {
                    "app.info" -> {
                        if (data.length() != 0 || html.isActive || webView.url != ORIGIN + "/assets/web/remote.html") throw Failure("unsupported_operation")
                        respond(reply, id, AppInfo.read())
                    }
                    "appearance.read" -> {
                        // 上方已核验主框架与来源；预览子框架没有此桥，也不能读取手机偏好。
                        if (data.length() != 0 || webView.url != ORIGIN + "/assets/web/remote.html") throw Failure("unsupported_operation")
                        respond(reply, id, (activity.application as DshmApplication).appearance.read())
                    }
                    "notifications.context", "notifications.take", "notifications.ack", "notifications.settings", "notifications.status", "notifications.restart" -> {
                        if (html.isActive || webView.url != ORIGIN + "/assets/web/remote.html") throw Failure("unsupported_operation")
                        respond(reply, id, notifications.dispatch(request.getString("op"), data))
                    }
                    "computerKey.configure" -> {
                        if (html.isActive || webView.url != ORIGIN + "/assets/web/remote.html") throw Failure("unsupported_operation")
                        computerKey.open(data) { value, failure -> respond(reply, id, value, failure) }
                    }
                    "computerKey.cancel" -> { computerKey.cancel(); respond(reply, id, JSONObject()) }
                    "modelProbe.temporary" -> {
                        if (html.isActive || webView.url != ORIGIN + "/assets/web/remote.html") throw Failure("unsupported_operation")
                        modelProbe.open(data) { value, failure -> respond(reply, id, value, failure) }
                    }
                    "modelProbe.cancel" -> { modelProbe.cancel(); respond(reply, id, JSONObject()) }
                    "clipboard.write" -> {
                        if (data.keys().asSequence().toSet() != setOf("text")) throw Failure("invalid_request")
                        val value = data.get("text")
                        // 最坏 JSON 转义后仍在桥的 300 KB 单请求上限内；不开放读取剪贴板。
                        if (value !is String || value.length !in 1..40_000) throw Failure("request_limit")
                        val clipboard = activity.getSystemService(android.content.ClipboardManager::class.java)
                        clipboard.setPrimaryClip(android.content.ClipData.newPlainText("DSHM Remote", value))
                        respond(reply, id, JSONObject())
                    }
                    "html.begin", "html.chunk", "html.finish", "html.close" -> html.dispatch(request.getString("op"), data) { value, failure -> respond(reply, id, value, failure) }
                    "file.begin", "file.chunk", "file.finish", "file.save", "file.share", "file.abort" -> downloads.dispatch(request.getString("op"), data) { value, failure -> respond(reply, id, value, failure) }
                    "binding.info" -> respond(reply, id, identity.info().put("cacheEpoch", (activity.application as DshmApplication).cacheEpoch()))
                    "binding.scan" -> {
                        if (data.keys().asSequence().toSet() != setOf("source")) throw Failure("invalid_request")
                        scanner.open(data.getString("source")) { value, failure -> respond(reply, id, value, failure) }
                    }
                    "binding.link" -> {
                        val pendingLink = pairLink
                        pairLink = null
                        respond(reply, id, JSONObject().apply { if (!identity.paired() && pendingLink != null) put("link", pendingLink) })
                    }
                    "binding.claim" -> { scanner.cancel(); execute(reply, id) { claim(data) } }
                    "binding.status" -> execute(reply, id) { api(identity.origin, "/v1/device", "GET") }
                    "socket.connect" -> {
                        disconnect()
                        noticeConnection.resume()
                        val owner = generation
                        execute(reply, id) {
                            val ticket = api(identity.origin, "/v1/device/ticket", "POST").getString("ticket")
                            activity.runOnUiThread { if (!closed && owner == generation) connect(ticket, reply, owner) }
                            JSONObject()
                        }
                    }
                    "socket.send" -> {
                        if (!ready) throw Failure("remote_not_connected")
                        val frame = data.getJSONObject("frame")
                        UUID.fromString(frame.getString("id"))
                        when (frame.getString("type")) {
                            "cancel" -> Unit
                            "ack" -> if (frame.getInt("count") !in 1..4) throw Failure("invalid_frame")
                            "responseAck" -> {
                                UUID.fromString(frame.getString("transferId"))
                                if (frame.keys().asSequence().toSet() != setOf("type", "id", "transferId", "index") ||
                                    frame.get("index") !is Int || frame.getInt("index") !in 0..511) throw Failure("invalid_frame")
                            }
                            "uploadChunk" -> if (frame.getString("data").length !in 4..87384) throw Failure("invalid_frame")
                            "uploadEnd" -> Unit
                            "request" -> {
                                val operation = frame.getJSONObject("operation")
                                val method = operation.getString("method")
                                if (method !in METHODS) throw Failure("unsupported_operation")
                                if (method == "remote.modelProbePrepare" || method == "remote.modelProbeExecute") {
                                    if (html.isActive || webView.url != ORIGIN + "/assets/web/remote.html") throw Failure("unsupported_operation")
                                    // 临时Key分支仅由原生窗口直接发送，通用页面桥不接受该模式或额外字段。
                                    val keys = operation.keys().asSequence().toSet()
                                    if (method == "remote.modelProbePrepare") {
                                        val auth = operation.getJSONObject("authentication")
                                        val mode = auth.getString("mode")
                                        val authKeys = if (mode == "stored") setOf("mode", "provider") else setOf("mode")
                                        if (mode !in setOf("none", "stored") || auth.keys().asSequence().toSet() != authKeys ||
                                            keys != setOf("method", "baseURL", "api", "authentication")) throw Failure("unsupported_operation")
                                    } else if (operation.getString("mode") !in setOf("none", "stored") ||
                                        keys != setOf("method", "snapshot", "confirmed", "mode")) throw Failure("unsupported_operation")
                                }
                            }
                            else -> throw Failure("invalid_frame")
                        }
                        if ((socket?.queueSize() ?: 0L) > 4 * 1024 * 1024 || socket?.send(frame.toString()) != true)
                            throw Failure("remote_send_failed")
                        respond(reply, id, JSONObject())
                    }
                    "socket.disconnect" -> { noticeConnection.pause(); disconnect(); respond(reply, id, JSONObject()) }
                    "socket.release" -> { disconnect(); respond(reply, id, JSONObject()) }
                    "binding.forget" -> { noticeConnection.pause(forget = true); notifications.invalidate(); disconnect();
                        (activity.application as DshmApplication).clearRemoteCaches()
                        execute(reply, id) { identity.clear(); JSONObject() } }
                    "ordinary.open", "appearance.settings" -> {
                        if (data.length() != 0 || html.isActive || webView.url != ORIGIN + "/assets/web/remote.html") throw Failure("unsupported_operation")
                        respond(reply, id, JSONObject())
                        openOrdinary(request.getString("op") == "appearance.settings")
                    }
                    else -> throw Failure("unsupported_operation")
                }
            } catch (error: Exception) { respond(reply, id, error = code(error)) }
        }
    }
    private fun code(error: Exception) = if (error is Failure) error.code else "remote_operation_failed"
    private fun respond(reply: JavaScriptReplyProxy, id: String, data: JSONObject? = null, error: String? = null) {
        if (closed || !WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return
        val value = JSONObject().put("id", id)
        if (error == null) value.put("data", data ?: JSONObject()) else value.put("error", error)
        try { reply.postMessage(value.toString()) } catch (_: Exception) { }
    }
    private fun emit(reply: JavaScriptReplyProxy, value: JSONObject, owner: Int) {
        activity.runOnUiThread {
            if (!closed && owner == generation && WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER))
                try { reply.postMessage(JSONObject().put("event", value).toString()) } catch (_: Exception) { }
        }
    }
    private fun execute(reply: JavaScriptReplyProxy, id: String, action: () -> JSONObject) {
        val owner = generation
        pending++
        worker.execute {
            var result: JSONObject? = null; var failure: String? = null
            try { result = action() } catch (error: Exception) { failure = code(error) }
            activity.runOnUiThread { pending--; if (owner == generation) respond(reply, id, result, failure) }
        }
    }
    private fun claim(data: JSONObject): JSONObject {
        if (identity.paired()) throw Failure("remote_already_paired")
        val link = RemotePairLink.parse(data.getString("link")) ?: throw Failure("invalid_pair_link")
        val origin = link.origin
        val name = data.getString("name").trim()
        if (name.length !in 1..80) throw Failure("invalid_device_name")
        identity.prepare()
        val value = try { api(origin, "/v1/pairings/claim", "POST", JSONObject().put("key", link.canonical.substringAfter("#key=")).put("name", name), false) }
        catch (failure: Failure) { if (failure.code == "http_409") throw Failure("pairing_unavailable") else throw failure }
        identity.save(origin, value)
        return identity.info().put("status", "pending")
    }
    private fun api(origin: String, path: String, method: String, body: JSONObject? = null, authenticated: Boolean = true): JSONObject {
        try { return RemoteApi(http, identity).call(origin, path, method, body, authenticated) }
        catch (error: RemoteApi.Failure) { throw Failure(error.code) }
    }
    private fun connect(ticket: String, reply: JavaScriptReplyProxy, owner: Int) {
        val request = Request.Builder().url(identity.origin + "/v1/device/socket").build()
        socket = http.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                if (owner != generation || closed) { webSocket.cancel(); return }
                webSocket.send(JSONObject().put("type", "authenticate").put("ticket", ticket).toString())
            }
            override fun onMessage(webSocket: WebSocket, text: String) {
                if (owner != generation || closed) return
                if (text.toByteArray(Charsets.UTF_8).size > 2 * 1024 * 1024) { webSocket.cancel(); return }
                try {
                    val frame = JSONObject(text)
                    if (modelProbe.owns(frame)) {
                        activity.runOnUiThread { if (!closed && owner == generation) modelProbe.receive(frame) }
                        return
                    }
                    if (computerKey.owns(frame)) {
                        activity.runOnUiThread {
                            if (!closed && owner == generation) computerKey.receive(frame)
                        }
                        return
                    }
                    if (resources.receive(frame)) return
                    if (frame.optString("type") == "ready") {
                        if (frame.optInt("protocol") != 1) { webSocket.cancel(); return }
                        activity.runOnUiThread { if (owner == generation) ready = true }
                    }
                    emit(reply, frame, owner)
                } catch (_: Exception) { webSocket.cancel() }
            }
            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) = ended(reply, owner, reason)
            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) { webSocket.close(code, null); ended(reply, owner, reason) }
            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) = ended(reply, owner)
        })
    }
    private fun ended(reply: JavaScriptReplyProxy, owner: Int, reason: String? = null) {
        activity.runOnUiThread { if (owner == generation) {
            notifications.invalidate()
            if (reason in setOf("device_revoked", "permissions_changed", "credential_expired")) noticeConnection.authorizationLost()
            if (reason in setOf("device_revoked", "permissions_changed", "credential_expired")) (activity.application as DshmApplication).clearRemoteCaches()
            modelProbe.cancel(); computerKey.cancel(); ready = false; resources.disconnect(); downloads.cancel(); html.cancel()
        } }
        val event = JSONObject().put("type", "closed")
        // 只传递网关已定义的状态码，不把任意服务端关闭文本带进页面。
        if (reason in setOf("device_revoked", "permissions_changed")) event.put("reason", reason)
        emit(reply, event, owner)
    }
    fun disconnect() { notifications.invalidate(); modelProbe.cancel(); computerKey.cancel(); scanner.cancel(); generation++; ready = false; resources.disconnect(); downloads.cancel(); html.cancel(); socket?.cancel(); socket = null }
    fun close() { closed = true; stopNoticeStatus(); stopAppearance(); stopCacheClear(); pairLink = null; disconnect(); scanner.close(); downloads.close(); html.close(); http.dispatcher.cancelAll(); worker.shutdownNow() }
    companion object {
        const val ORIGIN = "https://remote.dshm.invalid"
        private val METHODS = setOf("session.list", "session.follow", "session.page", "session.control", "session.prompt", "session.cancel",
            "remote.providerSettingsList", "remote.providerSettingsRead", "remote.providerSettingsWrite",
            "remote.providerKeySetup",
            "remote.providerCardRead",
            "remote.modelReadiness",
            "remote.presetManagementRead", "remote.presetCopy", "remote.presetDelete", "remote.codingToolsRead",
            "remote.providerRemovalRead", "remote.providerRemovalWrite",
            "remote.providerCreationRead", "remote.providerCreationWrite",
            "remote.providerModelsRead", "remote.providerModelsWrite",
            "remote.deepSeekModelsRead", "remote.deepSeekModelsWrite",
            "remote.providerModelsDiscover",
            "remote.modelProbePrepare", "remote.modelProbeExecute",
            "remote.desktopApps", "remote.prepareDesktopApp", "remote.openDesktopApp", "remote.desktopAppIcon",
            "remote.subagentStateFollow",
            "remote.negotiate", "remote.rpc", "remote.stream", "remote.graph", "remote.graphFollow", "remote.feedbackFollow", "remote.taskFollow", "remote.resource", "remote.upload", "remote.prompt", "remote.office", "remote.attachment", "remote.attachmentOffice", "remote.changes", "remote.jobStop", "remote.jobOutput", "remote.commandOutput", "remote.sessionExport", "remote.settingsRead", "remote.settingsWrite", "remote.keyRead", "remote.endpointRead", "remote.endpointWrite", "remote.desktop", "remote.openFile", "remote.prepareDesktopFile", "remote.openDesktopFile", "remote.prepareDesktopAttachment", "remote.openDesktopAttachment", "remote.pluginOperationStart", "remote.pluginOperationRead", "remote.pluginOperations")
    }
}
