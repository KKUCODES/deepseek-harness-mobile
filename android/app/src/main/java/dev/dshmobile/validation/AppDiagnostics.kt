package dev.dshmobile.validation

import android.content.ContentValues
import android.content.Context
import android.content.ClipData
import android.content.ClipboardManager
import android.app.Activity
import android.app.AlertDialog
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.os.Handler
import android.os.Looper
import java.util.Collections
import java.util.IdentityHashMap
import java.util.concurrent.CopyOnWriteArraySet
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import org.json.JSONArray
import org.json.JSONObject

/** App-private journal. Only sanitized records reach SQLite, including fatal records written before Android terminates. */
internal class AppDiagnostics(context: Context) {
    private data class Capture(val enabled: Boolean)
    private val preferences = context.getSharedPreferences("dshm-diagnostics-settings", Context.MODE_PRIVATE)
    @Volatile private var capture = Capture(preferences.getBoolean("enabled", true))
    val enabled: Boolean get() = capture.enabled
    private val db = object : SQLiteOpenHelper(context, "dshm-diagnostics-v1.db", null, 1) {
        override fun onCreate(db: SQLiteDatabase) = db.execSQL("CREATE TABLE log (id INTEGER PRIMARY KEY AUTOINCREMENT, entry TEXT NOT NULL)")
        override fun onUpgrade(db: SQLiteDatabase, old: Int, new: Int) = Unit
    }
    private val worker = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private val listeners = CopyOnWriteArraySet<() -> Unit>()
    private val captureListeners = CopyOnWriteArraySet<() -> Unit>()
    private val notifying = AtomicBoolean()
    private val queued = AtomicInteger()
    private val version = BuildConfig.VERSION_NAME
    private val versionCode = BuildConfig.VERSION_CODE

    fun observe(listener: () -> Unit): () -> Unit { listeners.add(listener); return { listeners.remove(listener) } }
    fun observeCapture(listener: () -> Unit): () -> Unit { captureListeners.add(listener); return { captureListeners.remove(listener) } }

    /** Called on the UI thread. Stop accepting events before any queued writes can resume. */
    fun setEnabled(enabled: Boolean) {
        if (capture.enabled == enabled) return
        capture = Capture(enabled)
        preferences.edit().putBoolean("enabled", enabled).apply()
        captureListeners.forEach { runCatching { it() } }
    }

    fun native(domain: String, event: String, mode: String = "app", level: String = "INFO", code: String? = null, error: Throwable? = null,
        synchronous: Boolean = false, count: Int? = null) {
        val owner = capture
        if (!owner.enabled) return
        val create = { base(domain, event, mode, level, "android").apply {
            if (code != null && nativeCode.matches(code)) put("code", code)
            if (error != null) put("exception", nativeException(error))
            if (count != null && count in 0..100_000) put("count", count)
        } }
        if (synchronous) runCatching { append(owner, create()) } else enqueue(owner, create)
    }

    fun web(mode: String, raw: JSONObject) {
        val owner = capture
        if (!owner.enabled) return
        val domain = raw.optString("domain")
        val event = raw.optString("event")
        val level = raw.optString("level")
        if (domain !in domains || level !in levels || event !in webEvents) return
        enqueue(owner) { webEntry(mode, domain, event, level, raw) }
    }

    private fun webEntry(mode: String, domain: String, event: String, level: String, raw: JSONObject): JSONObject {
        val entry = base(domain, event, mode, level, "webview")
        val build = raw.optString("build")
        if (build.matches(Regex("[a-f0-9]{64}"))) entry.put("build", build)
        val trace = raw.optString("trace")
        if (trace.matches(Regex("[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}"))) entry.put("trace", trace)
        val code = raw.optString("code")
        if (code in webCodes || code.matches(Regex("http_[1-5][0-9]{2}"))) entry.put("code", code)
        for ((key, max) in listOf("count" to 100_000, "duration" to 86_400_000)) {
            val value = raw.optInt(key, -1)
            if (value in 0..max) entry.put(key, value)
        }
        raw.optJSONObject("exception")?.let { entry.put("exception", cleanWebException(it)) }
        raw.optJSONObject("location")?.let { value ->
            val frame = "${value.optString("file")}:${value.optInt("line")}:${value.optInt("column")}"
            if (webFrame.matches(frame)) entry.put("location", frame)
        }
        return entry
    }

    private fun base(domain: String, event: String, mode: String, level: String, source: String) = JSONObject()
        .put("at", System.currentTimeMillis()).put("appVersion", version).put("versionCode", versionCode)
        .put("source", source).put("mode", mode).put("domain", domain).put("event", event).put("level", level)

    private fun enqueue(owner: Capture, create: () -> JSONObject) {
        if (queued.incrementAndGet() > 160) { queued.decrementAndGet(); return }
        worker.execute {
            try { if (capture === owner) runCatching { append(owner, create()) } } finally { queued.decrementAndGet() }
        }
    }

    private fun append(owner: Capture, entry: JSONObject) {
        if (capture !== owner) return
        val database = db.writableDatabase
        database.beginTransaction()
        try {
            if (capture !== owner) return
            val id = database.insertOrThrow("log", null, ContentValues().apply { put("entry", entry.toString()) })
            database.delete("log", "id <= ?", arrayOf((id - HISTORY_LIMIT).toString()))
            if (capture !== owner) return
            database.setTransactionSuccessful()
        } finally { database.endTransaction() }
        if (listeners.isNotEmpty() && notifying.compareAndSet(false, true)) main.postDelayed({
            notifying.set(false)
            listeners.forEach { runCatching { it() } }
        }, 100)
    }

    fun read(after: Long, latest: Boolean = false, deliver: (JSONObject) -> Unit) {
        worker.execute {
            val result = runCatching {
                val rows = JSONArray()
                var bytes = 0
                var more = false
                val order = if (latest) "DESC" else "ASC"
                db.readableDatabase.rawQuery("SELECT id, entry FROM log WHERE id > ? ORDER BY id $order LIMIT 65", arrayOf(after.toString())).use { cursor ->
                    while (cursor.moveToNext()) {
                        val value = cursor.getString(1)
                        if (rows.length() >= 64 || (rows.length() > 0 && bytes + value.length > 180_000)) { more = true; break }
                        rows.put(JSONObject(value).put("id", cursor.getLong(0)))
                        bytes += value.length
                    }
                }
                JSONObject().put("rows", rows).put("more", more)
            }.getOrElse { JSONObject().put("rows", JSONArray()).put("unavailable", true) }
            main.post { deliver(result) }
        }
    }

    fun copy(activity: Activity, id: Long, deliver: (Boolean) -> Unit) {
        worker.execute {
            val entry = runCatching {
                db.readableDatabase.rawQuery("SELECT entry FROM log WHERE id = ?", arrayOf(id.toString())).use { cursor ->
                    if (cursor.moveToFirst()) JSONObject(cursor.getString(0)).put("id", id) else null
                }
            }.getOrNull()
            main.post { deliver(entry != null && runCatching { copyJson(activity, entry) }.isSuccess) }
        }
    }

    private fun copyJson(activity: Activity, entry: JSONObject) {
        activity.getSystemService(ClipboardManager::class.java).setPrimaryClip(ClipData.newPlainText("DSHM Diagnostics", entry.toString(2)))
    }

    fun showStartupLogs(activity: Activity, english: Boolean) {
        read(0, latest = true) { reply ->
            if (activity.isFinishing || activity.isDestroyed) return@read
            val values = reply.optJSONArray("rows") ?: JSONArray()
            val records = (0 until values.length()).map(values::getJSONObject)
            val title = if (english) "Diagnostics" else "问题诊断"
            AlertDialog.Builder(activity).setTitle(title)
                .setItems(records.map { "${it.optString("level")} · ${it.optString("event")}" }.toTypedArray()) { _, index ->
                    val entry = records[index]
                    AlertDialog.Builder(activity).setTitle(title).setMessage(entry.toString(2))
                        .setPositiveButton(if (english) "Copy details" else "复制详情") { _, _ -> runCatching { copyJson(activity, entry) } }
                        .setNegativeButton(android.R.string.cancel, null).show()
                }.setNeutralButton(
                    if (enabled) (if (english) "Stop recording" else "关闭日志采集") else (if (english) "Start recording" else "开启日志采集")
                ) { _, _ -> setEnabled(!enabled); showStartupLogs(activity, english) }
                .setNegativeButton(android.R.string.cancel, null).show()
        }
    }

    fun installCrashHandler() {
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, failure ->
            runCatching { native("startup", "native_uncaught", level = "ERROR", code = "uncaught", error = failure, synchronous = true) }
            previous?.uncaughtException(thread, failure)
        }
    }

    private fun nativeException(error: Throwable): JSONObject {
        val causes = JSONArray()
        val seen = Collections.newSetFromMap(IdentityHashMap<Throwable, Boolean>())
        var remaining = MAX_FRAMES
        var omitted = 0
        fun visit(value: Throwable?, relation: String) {
            if (value == null || !seen.add(value)) return
            if (causes.length() >= MAX_CAUSES) { omitted++; return }
            val frames = JSONArray()
            for (frame in value.stackTrace) {
                val owner = frame.className
                val method = frame.methodName
                val file = frame.fileName?.takeIf(fileName::matches)
                if (!identifier.matches(owner) || !methodName.matches(method) || remaining <= 0) { omitted++; continue }
                val source = when {
                    frame.isNativeMethod -> "Native Method"
                    file == null -> "Unknown Source"
                    frame.lineNumber > 0 -> "$file:${frame.lineNumber}"
                    else -> file
                }
                frames.put("$owner.$method($source)"); remaining--
            }
            causes.put(JSONObject().put("type", value.javaClass.name.takeIf(identifier::matches) ?: "Throwable")
                .put("relation", relation).put("frames", frames))
            visit(value.cause, "cause")
            value.suppressed.take(MAX_CAUSES).forEach { visit(it, "suppressed") }
            omitted += (value.suppressed.size - MAX_CAUSES).coerceAtLeast(0)
        }
        visit(error, "root")
        return JSONObject().put("causes", causes).put("omitted", omitted)
    }

    private fun cleanWebException(value: JSONObject): JSONObject {
        val input = value.optJSONArray("causes") ?: JSONArray()
        val causes = JSONArray()
        var remaining = MAX_FRAMES
        var omitted = value.optInt("omitted").coerceIn(0, 100_000) + (input.length() - MAX_CAUSES).coerceAtLeast(0)
        for (i in 0 until minOf(input.length(), MAX_CAUSES)) {
            val cause = input.optJSONObject(i) ?: continue
            val type = cause.optString("type").takeIf { it in errorTypes } ?: "Error"
            val relation = cause.optString("relation").takeIf { it in setOf("root", "cause", "suppressed") } ?: "root"
            val source = cause.optJSONArray("frames") ?: JSONArray()
            val frames = JSONArray()
            for (j in 0 until minOf(source.length(), MAX_FRAMES)) {
                val frame = source.optString(j)
                if (remaining <= 0 || !webFrame.matches(frame)) { omitted++; continue }
                frames.put(frame); remaining--
            }
            omitted += (source.length() - MAX_FRAMES).coerceAtLeast(0)
            causes.put(JSONObject().put("type", type).put("relation", relation).put("frames", frames))
        }
        return JSONObject().put("causes", causes).put("omitted", omitted)
    }

    companion object {
        private const val HISTORY_LIMIT = 400
        private const val MAX_FRAMES = 300
        private const val MAX_CAUSES = 16
        private val domains = setOf("ordinary", "remote", "startup", "plugin", "update")
        private val levels = setOf("INFO", "WARN", "ERROR")
        private val identifier = Regex("(?:dev\\.dshmobile\\.|java\\.|javax\\.|android\\.|androidx\\.|com\\.android\\.|com\\.nimbusds\\.|dalvik\\.|libcore\\.|kotlin\\.|kotlinx\\.|okhttp3\\.|okio\\.|org\\.json\\.)[A-Za-z0-9_.$]{1,155}")
        private val methodName = Regex("[A-Za-z0-9_.$<>-]{1,150}")
        private val fileName = Regex("[A-Za-z0-9_.$-]{1,100}\\.(?:java|kt)")
        private val nativeCode = Regex("[a-z][a-z0-9_]{0,59}")
        private val webFrame = Regex("(?:(?:app-diagnostics|startup|mobile-main|remote-main|main)\\.js|(?:chunks|plugins)/[A-Za-z0-9_-]{1,125}\\.js):[0-9]{1,8}:[0-9]{1,8}")
        private val errorTypes = "Error TypeError RangeError ReferenceError SyntaxError URIError EvalError AggregateError DOMException AbortError NetworkError QuotaExceededError NotFoundError SecurityError InvalidStateError".split(' ').toSet()
        private val webEvents = ("uncaught_error unhandled_rejection resource_load_failed first_paint startup_failed render_failed image_render_failed " +
            "connection_start connection_ready connection_closed connection_error picker_open picker_returned picker_clipdata picker_canceled picker_expired picker_rejected picker_failed files_received files_skipped files_ready files_failed " +
            "ordinary_open_start ordinary_open_done ordinary_open_failed ordinary_send_start ordinary_send_done ordinary_send_failed ordinary_send_cancelled ordinary_request_accepted ordinary_response ordinary_history_failed " +
            "session_open_start session_open_done session_open_failed session_open_cancelled history_page_start history_page_done history_page_failed history_page_cancelled remote_send_start remote_send_done remote_send_failed remote_send_cancelled remote_turn_started remote_turn_input_received remote_turn_done remote_turn_failed " +
            "phone_plugin_start phone_plugin_done phone_plugin_failed phone_plugin_operation_failed remote_plugin_start remote_plugin_done remote_plugin_failed ordinary_plugin_start ordinary_plugin_done ordinary_plugin_failed " +
            "update_action_start update_action_done update_action_failed").split(' ').toSet()
        private val webCodes = ("unknown_error missing_credential model_error model_timeout model_rate_limited model_auth_failed model_unavailable history_write_failed history_read_failed request_failed request_aborted attachment_failed upload_failed send_unconfirmed send_rejected connection_offline host_offline host_upgrade_required invalid_protocol unsupported_dsh_version unsupported_dsh_capabilities unsupported_remote_version unsupported_remote_capabilities network_timeout network_unreachable tls_failure remote_closed device_pending device_revoked permissions_changed credential_expired invalid_authentication response_too_large response_buffer_limit response_chunk_timeout invalid_response_chunk incomplete_response_chunk remote_bridge_timeout request_timeout_outcome_unknown connection_closed_outcome_unknown host_disconnected_outcome_unknown remote_generation_changed remote_not_connected invalid_response response_failed web_restart_busy web_restart_save_failed update_bridge_failed plugin_operation_failed mount_failed activation_failed load_failed storage_failed timeout render_failed resource_load_failed uncaught unhandled_rejection history_gap " +
            "provider_error stream_closed transport_failed unexpected_content_type invalid_json invalid_chunk invalid_delta missing_finish_reason content_filter insufficient_system_resource provider_model_missing credential_unavailable key_required").split(' ').toSet()
    }
}
