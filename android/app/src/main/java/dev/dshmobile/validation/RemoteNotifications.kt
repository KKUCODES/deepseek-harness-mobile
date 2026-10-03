package dev.dshmobile.validation

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.ViewGroup
import android.widget.PopupWindow
import android.widget.TextView
import android.widget.BaseAdapter
import org.json.JSONArray
import org.json.JSONObject
import java.lang.ref.WeakReference
import java.security.MessageDigest
import java.util.Collections
import java.util.WeakHashMap
import java.util.UUID

/** 本机轻提醒与系统通知；只接收受限纯文本摘录，跳转仍只使用会话身份。 */
internal class RemoteNotifications(private val context: Context, private val appearance: PhoneAppearance) {
    companion object {
        const val TARGET = "dshm.private.notificationTarget"
        private const val PREFIX = "dshm.remote.notice."
        private const val RECORD = "dshm.private.notificationRecord.v1"
        internal fun session(value: String) = value.length in 1..200 && value.none { it.code < 32 || it.code == 127 }
        internal fun binding(identity: JSONObject): String = MessageDigest.getInstance("SHA-256")
            .digest(JSONArray().put(identity.getString("origin")).put(identity.getString("deviceId")).toString().toByteArray())
            .joinToString("") { "%02x".format(it) }
    }
    private data class Notice(val key: String, val binding: String, val session: String, val kind: String, val textId: Int,
        val preview: RemoteNoticePreview? = null)
    private val manager = context.getSystemService(NotificationManager::class.java)
    private val preferences = context.getSharedPreferences("dshm.notifications.v1", Context.MODE_PRIVATE)
    private val handler = Handler(Looper.getMainLooper())
    private val started = Collections.newSetFromMap(WeakHashMap<Activity, Boolean>())
    private var foreground = WeakReference<Activity>(null)
    private val visible = WeakHashMap<Activity, String?>()
    private val records = linkedMapOf<String, Notice>()
    private var popup: PopupWindow? = null
    private var popupKey: String? = null
    private var waitingBanner: Notice? = null
    private var requested: JSONObject? = null
    private val kinds = listOf("approval", "question", "completed", "error")
    private val labelIds = listOf(R.string.notice_approval_channel, R.string.notice_question_channel, R.string.notice_completed_channel, R.string.notice_error_channel)
    private val strings get() = appearance.localizedResources(context)
    private var language = appearance.language()

    init {
        updateChannels()
        appearance.subscribe { handler.post {
            if (language != appearance.language()) { language = appearance.language(); refreshLanguage() }
        } }
        // 只恢复系统中仍存在的通知，不重新notify；点击一条不能清掉其他尚未处理的提醒。
        manager.activeNotifications.filter { it.tag?.startsWith(PREFIX) == true }.forEach { active ->
            val notice = runCatching {
                val raw = active.notification.extras.getString(RECORD) ?: error("legacy notice")
                require(raw.length <= 2600 && active.id == 0)
                val data = JSONObject(raw)
                val fields = setOf("binding", "sessionId", "kind", "reason")
                require(data.keys().asSequence().toSet() == if (data.has("preview")) fields + "preview" else fields)
                val preview = if (data.has("preview")) RemoteNoticePreview.parse(data.getJSONObject("preview")) else null
                val key = active.tag.removePrefix(PREFIX)
                val bound = data.getString("binding"); val session = data.getString("sessionId")
                val kind = data.getString("kind"); val reason = data.getString("reason")
                require(bound.matches(Regex("[a-f0-9]{64}")) && Companion.session(session) && key.length in 1..500)
                require(kind in kinds && reason in setOf("approval", "question", "completed", "error", "blocked", "max-tokens"))
                require(if (kind == "error") reason in setOf("error", "blocked", "max-tokens") else reason == kind)
                require(preferences.getBoolean(kind, true))
                Notice(key, bound, session, kind, textId(reason), preview)
            }.getOrNull()
            if (notice == null) manager.cancel(active.tag, active.id) else records[notice.key] = notice
        }
        while (records.size > 32) remove(records.keys.first())
    }
    private fun updateChannels() {
        val resources = strings
        kinds.forEachIndexed { index, kind ->
            val channel = manager.getNotificationChannel(PREFIX + kind)
                ?: NotificationChannel(PREFIX + kind, resources.getString(labelIds[index]), NotificationManager.IMPORTANCE_DEFAULT).apply {
                    lockscreenVisibility = Notification.VISIBILITY_PRIVATE
                }
            channel.name = resources.getString(labelIds[index])
            channel.description = resources.getString(R.string.notice_channel_description)
            manager.createNotificationChannel(channel)
        }
    }
    private fun bannerText(label: TextView, notice: Notice) {
        val resources = strings
        val text = content(notice)
        label.text = "${title(notice)}\n$text  ›"
        label.contentDescription = resources.getString(R.string.notice_open, text)
    }
    private fun title(notice: Notice) = notice.preview?.title?.takeIf { it.isNotBlank() } ?: "DSHM · Remote"
    private fun content(notice: Notice): String {
        val status = strings.getString(notice.textId)
        return notice.preview?.text?.takeIf { it.isNotBlank() }?.let { "$status · $it" } ?: status
    }
    private fun publicNotice(kind: String) = Notification.Builder(context, PREFIX + kind)
        .setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle("DSHM")
        .setContentText(strings.getString(R.string.notice_public)).build()

    @android.annotation.SuppressLint("MissingPermission")
    private fun refreshLanguage() {
        updateChannels()
        popupKey?.let { key -> records[key]?.let { notice -> (popup?.contentView as? TextView)?.let { bannerText(it, notice) } } }
        if (!allowed()) return
        // 只更新系统里仍显示的原通知，保留时间和PendingIntent；不重放已划掉的提醒。
        manager.activeNotifications.forEach { active ->
            val tag = active.tag ?: return@forEach
            if (!tag.startsWith(PREFIX)) return@forEach
            val notice = records[tag.removePrefix(PREFIX)] ?: return@forEach
            val updated = Notification.Builder.recoverBuilder(context, active.notification)
                .setContentTitle(title(notice)).setContentText(content(notice))
                .setStyle(Notification.BigTextStyle().bigText(content(notice))).setPublicVersion(publicNotice(notice.kind))
                .setOnlyAlertOnce(true).build()
            try { manager.notify(tag, active.id, updated) } catch (_: SecurityException) { }
        }
    }
    fun started(activity: Activity) { started.add(activity) }
    fun stopped(activity: Activity) {
        started.remove(activity)
        if (started.isEmpty()) waitingBanner?.let { waitingBanner = null; display(it) }
    }
    fun resumed(activity: Activity) {
        foreground = WeakReference(activity)
        visible[activity]?.let { current(activity, it) }
        waitingBanner?.let { waitingBanner = null; display(it) }
    }
    fun paused(activity: Activity) {
        if (foreground.get() === activity) { foreground.clear(); dismiss() }
    }
    fun destroyed(activity: Activity) { visible.remove(activity); stopped(activity); paused(activity) }
    fun current(activity: Activity, session: String?) {
        require(session == null || Companion.session(session))
        visible[activity] = session
        if (foreground.get() === activity && session != null) records.values.filter { it.session == session }.map { it.key }.forEach(::remove)
    }
    private fun dismiss() { popup?.dismiss(); popup = null; popupKey = null }
    private fun remove(key: String) {
        records.remove(key); manager.cancel(PREFIX + key, 0)
        if (popupKey == key) dismiss()
        if (waitingBanner?.key == key) waitingBanner = null
    }
    fun clear(binding: String) {
        records.values.filter { it.binding == binding }.map { it.key }.forEach(::remove)
        if (requested?.optString("binding") == binding) requested = null
    }
    fun retainBinding(binding: String?) {
        records.values.filter { it.binding != binding }.map { it.key }.forEach(::remove)
        if (requested?.optString("binding") != binding) requested = null
    }
    fun baseline(binding: String, ids: Set<String>) {
        records.values.filter { it.binding == binding && it.kind in setOf("approval", "question") && it.key !in ids }.map { it.key }.forEach(::remove)
    }
    fun resolve(binding: String, id: String) { if (records[id]?.binding == binding) remove(id) }
    fun push(binding: String, key: String, session: String, kind: String, reason: String = kind, preview: RemoteNoticePreview? = null) {
        require(binding.matches(Regex("[a-f0-9]{64}")) && Companion.session(session) && key.length in 1..500 && kind in kinds)
        if (!preferences.getBoolean(kind, true) || records.containsKey(key)) return
        val notice = Notice(key, binding, session, kind, textId(reason), preview)
        records[key] = notice
        while (records.size > 32) remove(records.keys.first())
        display(notice)
    }
    private fun textId(reason: String) = when (reason) {
            "approval" -> R.string.notice_approval
            "question" -> R.string.notice_question
            "completed" -> R.string.notice_completed
            "blocked" -> R.string.notice_blocked
            "max-tokens" -> R.string.notice_limit
            else -> R.string.notice_error
    }
    private fun target(notice: Notice) = JSONObject().put("binding", notice.binding).put("sessionId", notice.session)
    private fun intent(notice: Notice) = Intent(context, RemoteActivity::class.java)
        .addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        .setData(Uri.parse("dshm-notice://task/${UUID.randomUUID()}"))
        .putExtra(TARGET, target(notice).toString())
    @android.annotation.SuppressLint("MissingPermission") // allowed() 检查权限，notify仍捕获权限并发撤回。
    private fun display(notice: Notice) {
        if (records[notice.key] !== notice) return
        val activity = foreground.get()
        if (BuildConfig.DEBUG) android.util.Log.d("DSHMNotifications", "display kind=${notice.kind} foreground=${activity?.javaClass?.simpleName} started=${started.size} sameSession=${activity != null && visible[activity] == notice.session}")
        if (activity is RemoteActivity && visible[activity] == notice.session) { remove(notice.key); return }
        if (activity != null && !activity.isFinishing && !activity.isDestroyed) {
            if (!activity.window.decorView.isAttachedToWindow) {
                activity.window.decorView.post { if (foreground.get() === activity && records.containsKey(notice.key)) display(notice) }
                return
            }
            dismiss()
            val scale = activity.resources.displayMetrics.density
            val label = TextView(activity).apply {
                bannerText(this, notice); textSize = 15f; setTextColor(Color.WHITE)
                setPadding((18 * scale).toInt(), (14 * scale).toInt(), (18 * scale).toInt(), (14 * scale).toInt())
                background = GradientDrawable().apply { setColor(Color.rgb(38, 38, 38)); cornerRadius = 16 * scale }
                setOnClickListener { remove(notice.key); activity.startActivity(intent(notice)) }
            }
            val window = PopupWindow(label, activity.resources.displayMetrics.widthPixels - (32 * scale).toInt(), ViewGroup.LayoutParams.WRAP_CONTENT, false)
            popup = window; popupKey = notice.key
            try { window.showAtLocation(activity.window.decorView, Gravity.TOP or Gravity.CENTER_HORIZONTAL, 0, (48 * scale).toInt()) }
            catch (_: android.view.WindowManager.BadTokenException) {
                if (BuildConfig.DEBUG) android.util.Log.d("DSHMNotifications", "banner_window_unavailable")
                dismiss(); return
            }
            handler.postDelayed({ if (popup === window) dismiss() }, 6000)
        } else if (started.isNotEmpty()) {
            // Activity切换的短间隙仍属前台；交给下一页，不误发系统通知。
            waitingBanner = notice
        } else if (allowed()) {
            val pending = PendingIntent.getActivity(context, 0, intent(notice), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
            val notification = Notification.Builder(context, PREFIX + notice.kind)
                .setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle(title(notice)).setContentText(content(notice))
                .setStyle(Notification.BigTextStyle().bigText(content(notice)))
                .setContentIntent(pending).setAutoCancel(true).setOnlyAlertOnce(true).setVisibility(Notification.VISIBILITY_PRIVATE)
                .addExtras(Bundle().apply {
                    val reason = when (notice.textId) {
                        R.string.notice_blocked -> "blocked"
                        R.string.notice_limit -> "max-tokens"
                        else -> notice.kind
                    }
                    val record = target(notice).put("kind", notice.kind).put("reason", reason)
                    notice.preview?.let { record.put("preview", it.json()) }
                    putString(RECORD, record.toString())
                })
                .setPublicVersion(publicNotice(notice.kind)).build()
            // 权限可以在检查后被系统收回，不能让通知失败中断聊天。
            try { manager.notify(PREFIX + notice.key, 0, notification) } catch (_: SecurityException) { }
        }
    }
    fun accept(incoming: Intent) {
        val raw = incoming.getStringExtra(TARGET); incoming.removeExtra(TARGET)
        if (raw == null || raw.length > 1200) return
        runCatching { JSONObject(raw) }.getOrNull()?.takeIf {
            it.keys().asSequence().toSet() == setOf("binding", "sessionId")
                && it.optString("binding").matches(Regex("[a-f0-9]{64}")) && session(it.optString("sessionId"))
        }?.let { requested = it.put("id", UUID.randomUUID().toString()) }
    }
    fun take(binding: String): JSONObject {
        val value = requested ?: return JSONObject()
        if (value.getString("binding") != binding) { requested = null; return JSONObject() }
        return JSONObject().put("sessionId", value.getString("sessionId")).put("id", value.getString("id"))
    }
    fun acknowledge(binding: String, id: String) {
        if (requested?.optString("binding") == binding && requested?.optString("id") == id) requested = null
    }
    private fun allowed() = manager.areNotificationsEnabled() && (Build.VERSION.SDK_INT < 33
        || context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED)
    fun settings(activity: Activity) {
        val selected = kinds.map { preferences.getBoolean(it, true) }.toBooleanArray()
        val connection = (activity.application as DshmApplication).noticeConnection
        val labels = labelIds.map { strings.getString(it) }.toTypedArray()
        fun title() = strings.let { it.getString(R.string.notice_settings_title, connection.label(it)) }
        fun systemLabel() = strings.getString(if (allowed()) R.string.notice_system_settings else R.string.notice_system_allow)
        val dialog = AlertDialog.Builder(appearance.dialogContext(activity)).setTitle(title())
            .setMultiChoiceItems(labels, selected) { _, index, value ->
                preferences.edit().putBoolean(kinds[index], value).apply()
                if (!value) records.values.filter { it.kind == kinds[index] }.map { it.key }.forEach(::remove)
            }
            .setPositiveButton(strings.getString(R.string.notice_done), null)
            .setNegativeButton(strings.getString(R.string.notice_reconnect)) { _, _ -> connection.restart(); settings(activity) }
            .setNeutralButton(systemLabel()) { _, _ ->
                // 系统不再弹窗时转到设置，避免反复请求后按钮看起来没有响应。
                val canRequest = Build.VERSION.SDK_INT >= 33
                    && activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                    && (!preferences.getBoolean("permissionRequested", false)
                        || activity.shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS))
                if (canRequest) {
                    preferences.edit().putBoolean("permissionRequested", true).apply()
                    activity.requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 8412)
                } else activity.startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName))
            }.show()
        val stop = connection.subscribe { dialog.setTitle(title()) }
        val stopLanguage = appearance.subscribe { handler.post {
            if (dialog.isShowing) {
                dialog.setTitle(title())
                labels.indices.forEach { labels[it] = strings.getString(labelIds[it]) }
                (dialog.listView.adapter as? BaseAdapter)?.notifyDataSetChanged()
                dialog.getButton(AlertDialog.BUTTON_POSITIVE).text = strings.getString(R.string.notice_done)
                dialog.getButton(AlertDialog.BUTTON_NEGATIVE).text = strings.getString(R.string.notice_reconnect)
                dialog.getButton(AlertDialog.BUTTON_NEUTRAL).text = systemLabel()
            }
        } }
        dialog.setOnDismissListener { stop(); stopLanguage() }
    }
}
