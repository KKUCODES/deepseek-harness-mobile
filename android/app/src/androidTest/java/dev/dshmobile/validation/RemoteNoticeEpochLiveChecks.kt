package dev.dshmobile.validation

import android.app.Instrumentation
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

/** 显式选用的联网验收：只改变真实测试会话回执的调度，不替换认证或事件内容。 */
internal object RemoteNoticeEpochLiveChecks {
    var stage = "initial"
        private set

    fun run(instrumentation: Instrumentation, sessionId: String, revoke: Boolean = false, overflow: Boolean = false) {
        require(sessionId.matches(Regex("session-[0-9a-f-]{36}")))
        require(!revoke || !overflow)
        val context = instrumentation.targetContext
        if (revoke) require(context.packageName == "dev.dshmobile.validation.pairingtest")
        // Instrumentation线程可能先于Application初始化，沿正式入口启动后再取得连接。
        instrumentation.startActivitySync(Intent(context, ValidationActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        instrumentation.waitForIdleSync()
        val app = context.applicationContext as DshmApplication
        val connection = app.noticeConnection
        val manager = context.getSystemService(NotificationManager::class.java)
        val preferences = context.getSharedPreferences("dshm.remote.notice-connection.v1", Context.MODE_PRIVATE)
        check(!preferences.getBoolean("paused", false))
        fun main(action: () -> Unit) { instrumentation.runOnMainSync(action); instrumentation.waitForIdleSync() }
        fun status(): String { var value = ""; main { value = connection.snapshot().getString("status") }; return value }
        fun until(timeout: Long = 45_000, predicate: () -> Boolean) {
            val deadline = System.currentTimeMillis() + timeout
            while (!predicate() && System.currentTimeMillis() < deadline) Thread.sleep(100)
            check(predicate()) { "condition_timeout" }
        }
        fun notices() = manager.activeNotifications.filter { it.tag?.contains(sessionId) == true }
        fun signal(value: String) { stage = value; instrumentation.sendStatus(1, Bundle().apply { putString("stage", value) }) }
        val socketField = connection.javaClass.getDeclaredField("socket").apply { isAccessible = true }
        val epochField = connection.javaClass.getDeclaredField("epoch").apply { isAccessible = true }
        var oldSocket: WebSocket? = null
        var original: WebSocketListener? = null
        var listenerField: java.lang.reflect.Field? = null
        val captured = CountDownLatch(1)
        val intercepted = AtomicBoolean(false)
        val overflowBoundary = AtomicBoolean(false)
        var realFrame = ""
        try {
            stage = "waiting-authenticated-connection"
            until { status() == "listening" }
            check(notices().isEmpty())
            main { oldSocket = socketField.get(connection) as WebSocket }
            val socket = checkNotNull(oldSocket)
            listenerField = socket.javaClass.getDeclaredField("listener").apply { isAccessible = true }
            val delegate = listenerField.get(socket) as WebSocketListener
            original = delegate
            var oldEpoch = 0
            main { oldEpoch = epochField.getInt(connection) }
            listenerField.set(socket, object : WebSocketListener() {
                override fun onOpen(socket: WebSocket, response: Response) = delegate.onOpen(socket, response)
                override fun onMessage(socket: WebSocket, text: String) {
                    val value = runCatching { JSONObject(text).optJSONObject("value") }.getOrNull()
                    if (value?.optString("type") == "outcome" && value.optString("sessionId") == sessionId && intercepted.compareAndSet(false, true)) {
                        realFrame = text
                        if (revoke) {
                            // 仅暂缓已到达的真实事件；关闭/失败仍交给原监听器，以接收电脑的真实撤权。
                            captured.countDown()
                            return
                        }
                        // 同一个主线程回合先让原监听器排队，再失效连接；原帧只能在失效之后执行。
                        Handler(Looper.getMainLooper()).post {
                            if (overflow) {
                                // 重放刚收到的同一真实帧，集中排队；不伪造认证/结算或执行257次任务。
                                val cancelled = AtomicInteger()
                                val observedSocket = object : WebSocket by socket {
                                    override fun cancel() { cancelled.incrementAndGet(); socket.cancel() }
                                }
                                repeat(256) { delegate.onMessage(observedSocket, text) }
                                val acceptedLimit = cancelled.get() == 0
                                delegate.onMessage(observedSocket, text)
                                overflowBoundary.set(acceptedLimit && cancelled.get() == 1)
                            } else {
                                delegate.onMessage(socket, text)
                                connection.pause()
                            }
                            captured.countDown()
                        }
                    } else delegate.onMessage(socket, text)
                }
                override fun onMessage(socket: WebSocket, bytes: ByteString) = delegate.onMessage(socket, bytes)
                override fun onClosing(socket: WebSocket, code: Int, reason: String) = delegate.onClosing(socket, code, reason)
                override fun onClosed(socket: WebSocket, code: Int, reason: String) = delegate.onClosed(socket, code, reason)
                override fun onFailure(socket: WebSocket, error: Throwable, response: Response?) = delegate.onFailure(socket, error, response)
            })
            signal("READY_FOR_OLD_OUTCOME")
            check(captured.await(120, TimeUnit.SECONDS)) { "real_outcome_missing" }
            instrumentation.waitForIdleSync()
            if (revoke) {
                signal("READY_FOR_DESKTOP_REVOCATION")
                until(90_000) { status() == "unauthorized" }
                check(notices().isEmpty())
                main { check(epochField.getInt(connection) > oldEpoch); check(socketField.get(connection) == null) }
                delegate.onMessage(socket, realFrame)
                instrumentation.waitForIdleSync()
                check(status() == "unauthorized" && notices().isEmpty())
                main { connection.restart() }
                until { status() == "unauthorized" }
                check(notices().isEmpty())
                main { check(socketField.get(connection) == null) }
                stage = "passed-live-revocation-old-frame-and-reconnect-denied"
                return
            }
            if (overflow) {
                stage = "waiting-queue-overflow-recovery"
                check(overflowBoundary.get()) { "queue_limit_not_enforced_at_257" }
                until { var advanced = false; main { advanced = epochField.getInt(connection) > oldEpoch }; advanced }
            } else {
                check(status() == "paused" && notices().isEmpty())
                main { check(epochField.getInt(connection) > oldEpoch) }
            }
            listenerField.set(socket, delegate)
            if (!overflow) main { connection.restart() }
            until { status() == "listening" }
            val retained = if (overflow) 1 else 0
            check(notices().size == retained)
            var currentSocket: Any? = null
            main { currentSocket = socketField.get(connection) }
            check(currentSocket !== socket)
            stage = "old-callbacks-after-reconnect"
            // 使用刚捕获的真实帧，同时覆盖旧socket的迟到故障/关闭；不记录正文或票据。
            delegate.onMessage(socket, realFrame)
            delegate.onFailure(socket, IOException("test-late-old-socket"), null)
            delegate.onClosed(socket, 1000, "device_revoked")
            instrumentation.waitForIdleSync()
            check(status() == "listening" && notices().size == retained)
            main { check(socketField.get(connection) === currentSocket) }
            val previousKeys = notices().map { it.key }.toSet()
            signal("READY_FOR_FRESH_OUTCOME")
            // 发送下一条消息时进入聊天会消费旧通知，不能要求旧通知仍和新通知同时存在。
            until(120_000) { notices().any { it.key !in previousKeys } }
            check(status() == "listening")
            check(notices().count { it.key !in previousKeys } == 1)
            stage = if (overflow) "passed-256-queued-257-cancelled-auto-reconnect-dedup-and-fresh-delivery"
                else "passed-real-frame-isolation-and-new-delivery"
        } finally {
            if (oldSocket != null && original != null) listenerField?.set(oldSocket, original)
            // 即使断言失败也恢复通知接收；不让测试留下持久暂停设置。
            if (preferences.getBoolean("paused", false)) main { connection.restart() }
        }
    }
}
