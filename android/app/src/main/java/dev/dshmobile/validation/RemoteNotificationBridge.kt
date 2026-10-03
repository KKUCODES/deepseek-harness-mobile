package dev.dshmobile.validation

import android.app.Activity
import org.json.JSONObject
import java.util.UUID

/** 页面只提供阅读位置、点击确认及设置；提醒内容仅由应用级只读连接产生。 */
internal class RemoteNotificationBridge(private val activity: Activity, private val identity: RemoteIdentity) {
    private val app get() = activity.application as DshmApplication
    private val notices get() = app.notices
    private fun fields(data: JSONObject, vararg keys: String) { require(data.keys().asSequence().toSet() == keys.toSet()) }
    fun invalidate() { notices.current(activity, null) }
    fun dispatch(op: String, data: JSONObject): JSONObject {
        when (op) {
            "notifications.settings" -> { fields(data); notices.settings(activity) }
            "notifications.status" -> { fields(data); return app.noticeConnection.snapshot() }
            "notifications.restart" -> { fields(data); app.noticeConnection.restart(); return app.noticeConnection.snapshot() }
            "notifications.context" -> {
                fields(data, "sessionId")
                val value = data.get("sessionId")
                require(value == JSONObject.NULL || value is String)
                notices.current(activity, if (value == JSONObject.NULL) null else value as String)
            }
            "notifications.take", "notifications.ack" -> {
                require(identity.paired())
                val binding = RemoteNotifications.binding(identity.info())
                if (op == "notifications.take") { fields(data); return notices.take(binding) }
                fields(data, "id")
                val id = data.getString("id"); require(UUID.fromString(id).toString() == id.lowercase())
                notices.acknowledge(binding, id)
            }
            else -> error("unsupported_operation")
        }
        return JSONObject()
    }
}
