package dev.dshmobile.validation

import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

/** 协商后的纯文本摘录；独立于通知跳转身份，不解释 URL 或富文本。 */
internal data class RemoteNoticePreview(val title: String, val text: String) {
    fun json() = JSONObject().put("title", title).put("text", text)
    companion object {
        fun parse(value: JSONObject): RemoteNoticePreview {
            require(value.keys().asSequence().toSet() == setOf("title", "text"))
            fun field(name: String, limit: Int): String {
                val text = value.get(name); require(text is String && text.length <= limit)
                require(text.none { it.code < 32 || it.code in 127..159 || it.code in 0x202a..0x202e || it.code in 0x2066..0x2069 })
                return text
            }
            return RemoteNoticePreview(field("title", 120), field("text", 240))
        }
    }
}

/** 只读流的进程内身份账本：初始集合不提醒，旧事件不因页面重建或重连再次提醒。 */
internal class RemoteNoticeLedger {
    data class Pending(val id: String, val session: String, val kind: String)
    private val seen = linkedSetOf<String>()
    private var pending = linkedMapOf<String, Pending>()
    private var ready = false
    private var pendingAvailable = false
    fun reconnect() { ready = false }
    private fun remember(key: String): Boolean {
        val fresh = seen.add(key)
        while (seen.size > 4096) seen.remove(seen.first())
        return fresh
    }
    private fun fields(value: JSONObject, vararg names: String) { require(value.keys().asSequence().toSet() == names.toSet()) }
    private fun string(value: JSONObject, key: String): String { val raw = value.get(key); require(raw is String); return raw }
    private fun uuid(value: String): String { require(UUID.fromString(value).toString() == value.lowercase()); return value }
    private fun session(value: JSONObject): String = string(value, "sessionId").also { require(RemoteNotifications.session(it)) }
    private fun integer(value: JSONObject, key: String): Long {
        val raw = value.get(key); require(raw is Int || raw is Long)
        return (raw as Number).toLong().also { require(it in 0..9_007_199_254_740_991L) }
    }
    private fun item(value: JSONObject): Pending {
        fields(value, "eventId", "sessionId", "kind")
        val kind = string(value, "kind"); require(kind in setOf("approval", "question"))
        return Pending(uuid(string(value, "eventId")), session(value), kind)
    }
    fun receive(value: JSONObject, baseline: (Set<String>) -> Unit, resolved: (String) -> Unit,
        notify: (String, String, String, String, RemoteNoticePreview?) -> Unit, previews: Boolean = false) {
        if (!ready) {
            fields(value, "type", "generation", "pendingAvailable", "pending")
            require(string(value, "type") == "ready"); uuid(string(value, "generation"))
            require(value.get("pendingAvailable") is Boolean)
            val available = value.getBoolean("pendingAvailable")
            val values = value.getJSONArray("pending")
            require(values.length() <= 256 && (available || values.length() == 0))
            val items = (0 until values.length()).map { item(values.getJSONObject(it)) }
            require(items.map { it.id }.toSet().size == items.size && items.none { "resolved:${it.id}" in seen })
            val ids = items.map { it.id }.toSet()
            pending.keys.filter { it !in ids }.forEach { remember("resolved:$it") }
            items.forEach { remember("pending:${it.id}") }
            pending = items.associateByTo(linkedMapOf()) { it.id }
            pendingAvailable = available; ready = true; baseline(ids); return
        }
        when (string(value, "type")) {
            "pending" -> {
                require(pendingAvailable)
                fields(value, *if (previews) arrayOf("type", "item", "preview") else arrayOf("type", "item"))
                val preview = if (previews) RemoteNoticePreview.parse(value.getJSONObject("preview")) else null
                val next = item(value.getJSONObject("item"))
                if ("resolved:${next.id}" in seen) return
                val previous = pending[next.id]
                require(previous == null || previous == next)
                require(previous != null || pending.size < 256)
                pending[next.id] = next
                if (remember("pending:${next.id}")) notify(next.id, next.session, next.kind, next.kind, preview)
            }
            "resolved" -> {
                require(pendingAvailable); fields(value, "type", "eventId")
                val id = uuid(string(value, "eventId")); pending.remove(id)
                remember("pending:$id"); remember("resolved:$id"); resolved(id)
            }
            "outcome" -> {
                fields(value, *if (previews) arrayOf("type", "sessionId", "seq", "time", "turn", "reason", "preview")
                    else arrayOf("type", "sessionId", "seq", "time", "turn", "reason"))
                val preview = if (previews) RemoteNoticePreview.parse(value.getJSONObject("preview")) else null
                val session = session(value)
                val seq = integer(value, "seq")
                integer(value, "time"); integer(value, "turn")
                val reason = string(value, "reason"); require(reason in setOf("completed", "error", "blocked", "max-tokens"))
                val key = "outcome:" + JSONArray().put(session).put(seq).toString()
                if (remember(key)) notify(key, session, if (reason == "completed") "completed" else "error", reason, preview)
            }
            else -> error("invalid_notification_event")
        }
    }
}
