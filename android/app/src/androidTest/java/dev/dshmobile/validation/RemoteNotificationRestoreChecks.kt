package dev.dshmobile.validation

import android.app.Instrumentation
import android.app.Notification
import android.app.NotificationManager
import android.content.Context
import android.os.Bundle
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

/** 独立UID的真实NotificationManager；不读取日常App的绑定或用户通知。 */
internal object RemoteNotificationRestoreChecks {
    var stage = "start"
    fun run(instrumentation: Instrumentation) {
        val context = instrumentation.targetContext
        check(context.packageName.endsWith(".pairingtest"))
        val manager = context.getSystemService(NotificationManager::class.java)
        val preferences = context.getSharedPreferences("dshm.notifications.v1", Context.MODE_PRIVATE)
        check(manager.areNotificationsEnabled())
        val prefix = "dshm.remote.notice."
        val binding = "a".repeat(64)
        fun main(action: () -> Unit) = instrumentation.runOnMainSync(action)
        fun active() = manager.activeNotifications.filter { it.tag?.startsWith(prefix) == true }
        fun expect(keys: Set<String>) {
            stage = "expect:" + keys.sorted().joinToString(",")
            val deadline = System.nanoTime() + 3_000_000_000L
            while (active().map { it.tag.removePrefix(prefix) }.toSet() != keys && System.nanoTime() < deadline) Thread.sleep(20)
            val actual = active().map { it.tag.removePrefix(prefix) }.toSet()
            if (actual != keys) { stage += ";actual:" + actual.sorted().joinToString(","); error("notification mismatch") }
        }
        lateinit var notices: RemoteNotifications
        fun reopen() = main { notices = RemoteNotifications(context, PhoneAppearance(context)) }
        try {
            check(preferences.edit().clear().commit()); manager.cancelAll(); reopen()
            main {
                notices.push(binding, "restore-one", "session-one", "question")
                notices.push(binding, "restore-two", "session-two", "approval")
            }
            expect(setOf("restore-one", "restore-two"))
            val times = active().associate { it.tag to it.postTime }
            reopen(); expect(setOf("restore-one", "restore-two"))
            check(active().associate { it.tag to it.postTime } == times) // 没有再次notify或改变通知时间。
            main { notices.retainBinding(binding); notices.baseline(binding, setOf("restore-two")) }
            expect(setOf("restore-two"))
            main { notices.resolve(binding, "restore-two") }; expect(emptySet())
            main { notices.push(binding, "dismissed", "session-one", "question") }
            expect(setOf("dismissed")); manager.cancel(prefix + "dismissed", 0); expect(emptySet())
            reopen(); expect(emptySet())
            main { notices.push(binding, "wrong-binding", "session-one", "question") }
            expect(setOf("wrong-binding")); reopen()
            main { notices.retainBinding("b".repeat(64)) }; expect(emptySet())
            main { notices.push(binding, "disabled", "session-one", "question") }; expect(setOf("disabled"))
            check(preferences.edit().putBoolean("question", false).commit()); reopen(); expect(emptySet())
            check(preferences.edit().putBoolean("question", true).commit())
            val invalid = Notification.Builder(context, prefix + "question")
                .setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle("DSHM isolated malformed fixture")
                .addExtras(Bundle().apply { putString("dshm.private.notificationRecord.v1", "{}") }).build()
            check(invalid.extras.getString("dshm.private.notificationRecord.v1") == "{}")
            manager.notify(prefix + "malformed", 0, invalid)
            expect(setOf("malformed"))
            check(active().single().notification.extras.getString("dshm.private.notificationRecord.v1") == "{}")
            reopen(); expect(emptySet())
            main { notices.push(binding, "clear-all", "session-one", "question") }; expect(setOf("clear-all"))
            reopen(); main { notices.retainBinding(null) }; expect(emptySet())

            // 结束事件经过生产账本再进入真实系统通知，检查三种失败原因不会互相混淆。
            val ledger = RemoteNoticeLedger()
            fun receive(frame: JSONObject) = main {
                ledger.receive(frame, { notices.baseline(binding, it) }, { notices.resolve(binding, it) },
                    { key, session, kind, reason, preview -> notices.push(binding, key, session, kind, reason, preview) })
            }
            receive(JSONObject().put("type", "ready").put("generation", UUID.randomUUID().toString())
                .put("pendingAvailable", true).put("pending", JSONArray()))
            val summaries = mutableSetOf<String>()
            for ((index, reason) in listOf("error", "blocked", "max-tokens").withIndex()) {
                stage = "outcome:$reason"
                val frame = JSONObject().put("type", "outcome").put("sessionId", "outcome-session")
                    .put("seq", index + 1).put("time", 100).put("turn", 1).put("reason", reason)
                receive(frame)
                val deadline = System.nanoTime() + 3_000_000_000L
                while (active().size != index + 1 && System.nanoTime() < deadline) Thread.sleep(20)
                check(active().size == index + 1)
                val item = active().single { JSONObject(it.notification.extras.getString("dshm.private.notificationRecord.v1")!!).getString("reason") == reason }
                check(item.notification.channelId == prefix + "error")
                check(item.notification.contentIntent != null)
                check(item.notification.visibility == Notification.VISIBILITY_PRIVATE)
                check(item.notification.publicVersion != null)
                val summary = item.notification.extras.getCharSequence(Notification.EXTRA_TEXT).toString()
                check(summary.isNotBlank()); check(summaries.add(summary))
                val before = active().associate { it.tag to it.postTime }
                receive(frame) // 同一结算不能再次投递或更新时间。
                check(active().associate { it.tag to it.postTime } == before)
                reopen()
                check(active().associate { it.tag to it.postTime } == before)
            }
            check(preferences.edit().putBoolean("error", false).commit()); reopen(); expect(emptySet())
            stage = "preview-restore-and-lockscreen"
            main { notices.push(binding, "preview", "preview-session", "completed", preview = RemoteNoticePreview("会话标题", "这是一条有限的正文摘要")) }
            expect(setOf("preview"))
            val previewNotice = active().single().notification
            check(previewNotice.extras.getCharSequence(Notification.EXTRA_TITLE).toString() == "会话标题")
            check(previewNotice.extras.getCharSequence(Notification.EXTRA_TEXT).toString().contains("这是一条有限的正文摘要"))
            check(!previewNotice.publicVersion.extras.toString().contains("会话标题"))
            check(!previewNotice.publicVersion.extras.toString().contains("正文摘要"))
            val previewTime = active().single().postTime
            reopen(); expect(setOf("preview")); check(active().single().postTime == previewTime)
            main { notices.retainBinding(null) }; expect(emptySet())
            receive(JSONObject().put("type", "outcome").put("sessionId", "outcome-session")
                .put("seq", 4).put("time", 100).put("turn", 2).put("reason", "error"))
            expect(emptySet())
        } finally { manager.cancelAll(); preferences.edit().clear().commit() }
    }
}
