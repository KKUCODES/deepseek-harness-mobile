package dev.dshmobile.validation

import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

/** 运行生产解析器，使用独立事件数据；不读取凭据、不发送模型消息。 */
internal object RemoteNoticeChecks {
    fun run() {
        val ledger = RemoteNoticeLedger()
        val notifications = mutableListOf<List<String>>()
        val resolved = mutableListOf<String>()
        var baseline = emptySet<String>()
        fun receive(value: JSONObject) = ledger.receive(value, { baseline = it }, { resolved.add(it) },
            { key, session, kind, reason, _ -> notifications.add(listOf(key, session, kind, reason)) })
        fun item(id: String = UUID.randomUUID().toString()) = JSONObject().put("eventId", id).put("sessionId", "test-session").put("kind", "question")
        fun ready(items: JSONArray = JSONArray(), available: Boolean = true) = JSONObject().put("type", "ready")
            .put("generation", UUID.randomUUID().toString()).put("pendingAvailable", available).put("pending", items)
        fun outcome(seq: Long, reason: String = "completed") = JSONObject().put("type", "outcome").put("sessionId", "test-session")
            .put("seq", seq).put("time", 100).put("turn", 1).put("reason", reason)
        fun reject(value: JSONObject) { check(runCatching { receive(value) }.isFailure) }
        val initial = item()
        reject(outcome(1))
        receive(ready(JSONArray().put(initial)))
        check(notifications.isEmpty() && baseline == setOf(initial.getString("eventId")))
        receive(JSONObject().put("type", "pending").put("item", initial))
        check(notifications.isEmpty())
        val next = item()
        receive(JSONObject().put("type", "pending").put("item", next))
        receive(JSONObject().put("type", "pending").put("item", next))
        check(notifications.size == 1 && notifications.single()[2] == "question")
        reject(JSONObject().put("type", "pending").put("item", JSONObject(next.toString()).put("sessionId", "other")))
        val id = next.getString("eventId")
        receive(JSONObject().put("type", "resolved").put("eventId", id))
        receive(JSONObject().put("type", "pending").put("item", next))
        check(resolved == listOf(id) && notifications.size == 1)
        receive(outcome(1)); receive(outcome(1))
        check(notifications.size == 2 && notifications.last()[2] == "completed")
        ledger.reconnect(); receive(ready())
        receive(outcome(1))
        check(notifications.size == 2 && baseline.isEmpty())
        listOf("error", "blocked", "max-tokens").forEachIndexed { index, reason ->
            receive(outcome(index + 2L, reason)); check(notifications.last()[2] == "error" && notifications.last()[3] == reason)
        }
        listOf("aborted", "interrupted", "unknown").forEach { reject(outcome(10, it)) }
        reject(outcome(10).put("seq", "10")); reject(outcome(10).put("seq", 1.5))
        reject(outcome(-1)); reject(outcome(9_007_199_254_740_992L))
        reject(outcome(10).put("sessionId", "test\n")); reject(outcome(10).put("secret", "ignored"))
        ledger.reconnect(); reject(ready(JSONArray().put(next)))
        reject(ready(JSONArray().put(initial).put(initial)))
        reject(ready(JSONArray().put(item()), false))
        val full = JSONArray(); repeat(256) { full.put(item()) }
        receive(ready(full))
        reject(JSONObject().put("type", "pending").put("item", item()))
        ledger.reconnect(); receive(ready(available = false))
        reject(JSONObject().put("type", "pending").put("item", item()))
        receive(outcome(11)); check(notifications.size == 6)
        val previews = RemoteNoticeLedger()
        var received: RemoteNoticePreview? = null
        fun previewReceive(value: JSONObject) = previews.receive(value, {}, {}, { _, _, _, _, preview -> received = preview }, true)
        previewReceive(ready())
        val preview = JSONObject().put("title", "真实会话标题").put("text", "已完成检查")
        val rich = outcome(20).put("preview", preview)
        reject(rich) // 未协商的连接不能偷偷接受新的内容字段。
        previewReceive(rich); check(received == RemoteNoticePreview("真实会话标题", "已完成检查"))
        for (bad in listOf(JSONObject().put("title", "x".repeat(121)).put("text", ""),
            JSONObject().put("title", "ok").put("text", "x".repeat(241)),
            JSONObject().put("title", "ok").put("text", "line\nline"),
            JSONObject().put("title", "ok").put("text", "text").put("url", "https://example.com"))) {
            check(runCatching { previewReceive(outcome(21).put("preview", bad)) }.isFailure)
        }
        check(runCatching { previewReceive(outcome(21)) }.isFailure)
        previewReceive(JSONObject().put("type", "pending").put("item", item()).put("preview", preview))
        check(received?.title == "真实会话标题")
    }
}
