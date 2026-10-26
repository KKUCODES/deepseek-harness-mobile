package dev.dshmobile.validation

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject
import java.net.ConnectException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import java.util.Collections
import java.util.IdentityHashMap
import java.util.UUID
import java.util.concurrent.CopyOnWriteArraySet
import javax.net.ssl.SSLException

/** Local structural diagnostics only. Exception messages, response bodies, addresses and identities never enter this store. */
internal class RemoteDiagnostics(private val preferences: SharedPreferences, private val now: () -> Long = System::currentTimeMillis) {
    constructor(context: Context) : this(context.getSharedPreferences("dshm.remote.diagnostics.v1", Context.MODE_PRIVATE))
    private val listeners = CopyOnWriteArraySet<() -> Unit>()
    private val entries = mutableListOf<JSONObject>()
    init {
        val saved = preferences.getString("records", null)
        if (saved != null && saved.length <= 65_536) try {
            val values = JSONArray(saved)
            for (index in 0 until minOf(values.length(), 10)) sanitize(values.optJSONObject(index))?.let(entries::add)
        } catch (_: Exception) { /* Corrupt diagnostic history cannot prevent the App from starting. */ }
    }
    fun subscribe(listener: () -> Unit): () -> Unit { listeners.add(listener); return { listeners.remove(listener) } }
    @Synchronized fun read() = JSONObject().put("records", JSONArray(entries.map { JSONObject(it.toString()) }))
    @Synchronized fun clear() { entries.clear(); save() }
    @Synchronized fun recovered(source: String = "remote") {
        var changed = false
        for (entry in entries) if (entry.optString("source") == source && !entry.has("resolvedAt")) {
            entry.put("resolvedAt", now()); changed = true
        }
        if (changed) save()
    }
    @Synchronized fun failure(phase: String, error: Throwable? = null, httpStatus: Int? = null, closeCode: Int? = null,
        reason: String? = null, code: String? = null, source: String = "remote", javascriptFrames: List<String> = emptyList()): JSONObject {
        val safePhase = phase.takeIf { it in PHASES } ?: "unknown"
        val safeCode = when {
            httpStatus != null && httpStatus in 100..599 -> "http_$httpStatus"
            reason in REASONS -> reason!!
            code != null -> safeCode(code)
            error != null -> classify(error)
            else -> "remote_closed"
        }
        val stamp = now()
        entries.firstOrNull()?.let { previous ->
            if (!previous.has("resolvedAt") && previous.optString("source") == source && previous.optString("phase") == safePhase
                && previous.optString("code") == safeCode && stamp - previous.optLong("at") in 0..1500)
                return JSONObject(previous.toString())
        }
        val record = JSONObject().put("id", UUID.randomUUID().toString()).put("at", stamp)
            .put("phase", safePhase).put("code", safeCode).put("source", if (source == "notifications") source else "remote")
        if (httpStatus != null && httpStatus in 100..599) record.put("httpStatus", httpStatus)
        if (closeCode != null && closeCode in 1000..4999) record.put("closeCode", closeCode)
        if (reason in REASONS) record.put("closeReason", reason)
        val exceptions = if (error != null) trace(error) else JSONArray().apply {
            val frames = javascriptFrames.filter { JS_FRAME.matches(it) }.take(18)
            if (frames.isNotEmpty()) put(JSONObject().put("type", "JavaScriptError").put("frames", JSONArray(frames)))
        }
        record.put("exceptions", exceptions)
        entries.add(0, record)
        // Repeated background notification failures must not evict all foreground connection evidence.
        for (kind in listOf("remote", "notifications")) {
            var count = 0
            entries.removeAll { it.optString("source") == kind && ++count > 5 }
        }
        save()
        return JSONObject(record.toString())
    }
    private fun save() {
        // App backup is disabled. Persist only the already-projected, bounded records, never a raw Throwable.
        preferences.edit().putString("records", JSONArray(entries).toString()).commit()
        listeners.forEach { it() }
    }
    companion object {
        private val PHASES = setOf("pairing", "authorization", "ticket", "websocket", "authentication", "connection", "negotiating", "reading", "notifications", "unknown")
        private val REASONS = setOf("device_revoked", "permissions_changed", "credential_expired", "invalid_authentication", "authentication_required", "rate_limited", "capacity_exceeded", "invalid_frame", "host_replaced")
        private val CODES = REASONS + setOf("unknown_error", "connection_failed", "network_unreachable", "network_timeout", "tls_failure", "remote_closed",
            "host_offline", "host_upgrade_required", "device_pending", "invalid_protocol", "unsupported_dsh_version", "unsupported_dsh_capabilities",
            "unsupported_remote_version", "unsupported_remote_capabilities", "remote_bridge_timeout", "request_timeout_outcome_unknown",
            "response_too_large", "response_buffer_limit", "response_chunk_timeout", "invalid_response_chunk", "incomplete_response_chunk",
            "connection_closed_outcome_unknown", "host_disconnected_outcome_unknown", "remote_generation_changed", "remote_not_connected")
        private val TYPE = Regex("(?:java\\.|javax\\.|android\\.|com\\.android\\.|okhttp3\\.|okio\\.|com\\.nimbusds\\.|dev\\.dshmobile\\.validation\\.)[A-Za-z0-9_.$]{1,140}")
        private val FRAME = Regex("at (?:java\\.|javax\\.|android\\.|com\\.android\\.|okhttp3\\.|okio\\.|com\\.nimbusds\\.|dev\\.dshmobile\\.validation\\.)[A-Za-z0-9_.$<>]{1,140}\\((?:[A-Za-z0-9_$.-]{1,80}\\.(?:kt|java)(?::\\d{1,6})?|Unknown Source|Native Method)\\)")
        private val JS_FRAME = Regex("at (?:(?:remote-main|mobile-main|main|test)\\.js|chunks/chunk-[A-Z0-9]{8}\\.js):\\d{1,6}:\\d{1,6}")
        fun safeCode(value: String) = value.takeIf { it in CODES || it.matches(Regex("http_[1-5]\\d\\d")) } ?: "unknown_error"
        fun classify(error: Throwable): String {
            val seen = Collections.newSetFromMap(IdentityHashMap<Throwable, Boolean>())
            var current: Throwable? = error
            repeat(6) {
                val cause = current ?: return@repeat
                if (!seen.add(cause)) return@repeat
                when (cause) {
                    is SSLException -> return "tls_failure"
                    is SocketTimeoutException -> return "network_timeout"
                    is UnknownHostException, is ConnectException -> return "network_unreachable"
                }
                current = cause.cause
            }
            return "connection_failed"
        }
        private fun trace(error: Throwable): JSONArray {
            val output = JSONArray()
            val seen = Collections.newSetFromMap(IdentityHashMap<Throwable, Boolean>())
            var current: Throwable? = error
            var remaining = 18
            repeat(3) {
                val cause = current ?: return@repeat
                if (!seen.add(cause)) return@repeat
                if (TYPE.matches(cause.javaClass.name)) {
                    val frames = cause.stackTrace.asSequence().map { "at $it" }.filter { it.length <= 220 && FRAME.matches(it) }.take(remaining).toList()
                    remaining -= frames.size
                    output.put(JSONObject().put("type", cause.javaClass.name).put("frames", JSONArray(frames)))
                }
                current = cause.cause
            }
            return output
        }
        private fun sanitize(value: JSONObject?): JSONObject? {
            value ?: return null
            val id = value.optString("id")
            if (!id.matches(Regex("[a-fA-F0-9]{8}(?:-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}")) || value.optLong("at") <= 0) return null
            val record = JSONObject().put("id", id).put("at", value.getLong("at"))
                .put("source", if (value.optString("source") == "notifications") "notifications" else "remote")
                .put("phase", value.optString("phase").takeIf { it in PHASES } ?: "unknown").put("code", safeCode(value.optString("code")))
            for (field in listOf("httpStatus", "closeCode")) {
                val number = value.optInt(field)
                if (field == "httpStatus" && number in 100..599 || field == "closeCode" && number in 1000..4999) record.put(field, number)
            }
            if (value.optString("closeReason") in REASONS) record.put("closeReason", value.getString("closeReason"))
            if (value.optLong("resolvedAt") > 0) record.put("resolvedAt", value.getLong("resolvedAt"))
            val input = value.optJSONArray("exceptions") ?: JSONArray()
            val exceptions = JSONArray()
            var remaining = 18
            for (index in 0 until minOf(input.length(), 3)) {
                val cause = input.optJSONObject(index) ?: continue
                val type = cause.optString("type")
                if (!(TYPE.matches(type) || type == "JavaScriptError")) continue
                val values = cause.optJSONArray("frames") ?: JSONArray()
                val frames = JSONArray()
                for (position in 0 until minOf(values.length(), 18)) {
                    val frame = values.optString(position)
                    if (remaining > 0 && frame.length <= 220 && (FRAME.matches(frame) || JS_FRAME.matches(frame))) { frames.put(frame); remaining-- }
                }
                exceptions.put(JSONObject().put("type", type).put("frames", frames))
            }
            return record.put("exceptions", exceptions)
        }
    }
}
