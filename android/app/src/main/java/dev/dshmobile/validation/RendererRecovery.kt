package dev.dshmobile.validation

import android.app.Activity
import android.os.SystemClock

/** 渲染器可能由两个页面共用；只重建当前可见 Activity，后台页面在下次进入时恢复。 */
internal class RendererRecovery(private val activity: Activity) {
    private var resumed = false
    private var pending = false
    private var posted = false
    fun onResume() { resumed = true; recover() }
    fun onPause() { resumed = false }
    fun rendererGone() { pending = true; recover() }
    fun reopen() {
        activity.intent.putExtra("dshm.private.restoreReading", true)
        activity.recreate()
    }
    private fun recover() {
        if (!resumed || !pending || posted || activity.isFinishing || activity.isDestroyed) return
        val preferences = activity.getPreferences(Activity.MODE_PRIVATE)
        val now = SystemClock.elapsedRealtime()
        val last = preferences.getLong("renderer-recovery-time", 0)
        val count = if (now >= last && now - last < 60_000) preferences.getInt("renderer-recovery-count", 0) else 0
        // 连续崩溃不无限重启；保留原生失败封面的手动恢复按钮。
        if (count >= 2) return
        posted = true
        activity.window.decorView.post {
            posted = false
            if (!resumed || activity.isFinishing || activity.isDestroyed) return@post
            preferences.edit().putLong("renderer-recovery-time", now).putInt("renderer-recovery-count", count + 1).apply()
            pending = false
            reopen()
        }
    }
}
