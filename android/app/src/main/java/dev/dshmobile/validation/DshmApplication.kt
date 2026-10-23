package dev.dshmobile.validation

import android.app.Activity
import android.app.Application
import android.os.Bundle
import java.io.File

/** 只观察本进程的页面生命周期，不启动服务或注册唤醒入口。 */
class DshmApplication : Application(), Application.ActivityLifecycleCallbacks {
    private val cacheListeners = java.util.concurrent.CopyOnWriteArraySet<() -> Unit>()
    fun cacheEpoch(): Long = getSharedPreferences("dshm.cache.v1", MODE_PRIVATE).getLong("epoch", 0)
    fun observeCacheClear(listener: () -> Unit): () -> Unit { cacheListeners.add(listener); return { cacheListeners.remove(listener) } }
    fun clearRemoteCaches() {
        val preferences = getSharedPreferences("dshm.cache.v1", MODE_PRIVATE)
        check(preferences.edit().putLong("epoch", cacheEpoch() + 1).commit())
        RemoteResourceCache.clear(File(cacheDir, "remote-resources"))
        for (listener in cacheListeners) listener()
    }
    internal lateinit var appearance: PhoneAppearance
        private set
    internal lateinit var notices: RemoteNotifications
        private set
    internal lateinit var noticeConnection: RemoteNoticeConnection
        private set
    internal lateinit var saveJournal: RemoteSaveJournal
        private set
    private lateinit var saveRecovery: RemoteSaveRecovery
    internal lateinit var updates: AppUpdates
        private set
    override fun onCreate() {
        super.onCreate()
        updates = AppUpdates(this)
        appearance = PhoneAppearance(this)
        saveJournal = RemoteSaveJournal(File(noBackupFilesDir, "remote-save-writes"))
        saveRecovery = RemoteSaveRecovery(saveJournal, appearance)
        notices = RemoteNotifications(this, appearance)
        noticeConnection = RemoteNoticeConnection(this, notices)
        registerActivityLifecycleCallbacks(this)
        noticeConnection.start()
    }
    override fun onActivityStarted(activity: Activity) = notices.started(activity)
    override fun onActivityStopped(activity: Activity) = notices.stopped(activity)
    override fun onActivityResumed(activity: Activity) {
        notices.resumed(activity); saveRecovery.resumed(activity)
        if (activity is ValidationActivity || activity is RemoteActivity) updates.resumed()
    }
    override fun onActivityPaused(activity: Activity) { saveRecovery.paused(activity); notices.paused(activity) }
    override fun onActivityDestroyed(activity: Activity) = notices.destroyed(activity)
    override fun onActivityCreated(activity: Activity, state: Bundle?) = Unit
    override fun onActivitySaveInstanceState(activity: Activity, state: Bundle) = Unit
}
