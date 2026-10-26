package dev.dshmobile.validation

import android.content.SharedPreferences
import org.json.JSONObject

/** 仅共享手机插件选择；不接触DSH授权、Key、会话或可执行资源地址。 */
internal class MobilePluginPreferences(private val preferences: SharedPreferences) {
    private val listeners = mutableSetOf<() -> Unit>()
    private var revision = 0L
    private var selectionRevision = 0L
    private var runtimeOwner: String? = null
    private var runtime: JSONObject? = null
    fun observe(listener: () -> Unit): () -> Unit { listeners.add(listener); return { listeners.remove(listener) } }
    fun snapshot() = JSONObject().put("configured", preferences.contains("selected"))
        .put("selected", preferences.getString("selected", null)?.takeIf { it.isNotEmpty() } ?: JSONObject.NULL)
        .put("revision", revision).put("selectionRevision", selectionRevision).put("runtime", runtime?.let { JSONObject(it.toString()) } ?: JSONObject.NULL)
    private fun changed() { revision++; listeners.toList().forEach { runCatching { it() } } }
    private fun selected(data: JSONObject): String? {
        require(data.has("selected"))
        val value = data.get("selected")
        require(value == JSONObject.NULL || value is String && value.length <= 260 && value.matches(Regex("(@[a-z0-9._-]+/)?[a-z0-9][a-z0-9._-]{0,127}")))
        return if (value == JSONObject.NULL) null else value as String
    }
    fun select(data: JSONObject, onlyIfMissing: Boolean = false) {
        require(data.keys().asSequence().toSet() == setOf("selected"))
        val id = selected(data)
        if (onlyIfMissing && preferences.contains("selected")) return
        // 空字符串是已明确选择默认首页；不存在字段才允许迁移旧Remote偏好。
        check(preferences.edit().putString("selected", id ?: "").commit())
        runtime = null; runtimeOwner = null; selectionRevision++; changed()
    }
    fun report(owner: String, data: JSONObject) {
        require(data.keys().asSequence().toSet() == setOf("selected", "status", "error"))
        val id = selected(data)
        require(data.getString("status") in setOf("inactive", "default", "loading", "active", "failed"))
        val error = data.get("error")
        require(error == JSONObject.NULL || error in setOf("missing", "incompatible", "timeout", "render", "load", "storage"))
        val expected = preferences.getString("selected", null)?.takeIf { it.isNotEmpty() }
        if (id != expected) return
        runtimeOwner = owner; runtime = JSONObject(data.toString()); changed()
    }
    fun release(owner: String) { if (runtimeOwner == owner) { runtime = null; runtimeOwner = null; changed() } }
}
