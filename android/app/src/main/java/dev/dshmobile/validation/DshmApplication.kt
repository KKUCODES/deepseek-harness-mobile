package dev.dshmobile.validation

import android.app.Activity
import android.app.Application
import android.os.Bundle
import java.io.File

/** 只观察本进程的页面生命周期，不启动服务或注册唤醒入口。 */
open class DshmApplication : Application(), Application.ActivityLifecycleCallbacks {
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
    internal lateinit var remoteDiagnostics: RemoteDiagnostics
        private set
    internal lateinit var mobilePlugins: MobilePluginPreferences
        private set
    internal lateinit var phonePlugins: PhonePluginStore
        private set
    internal lateinit var phonePluginPackages: PhonePluginPackages
        private set
    internal lateinit var saveJournal: RemoteSaveJournal
        private set
    private lateinit var saveRecovery: RemoteSaveRecovery
    internal lateinit var updates: AppUpdates
        private set
    internal lateinit var webUpdates: WebUpdates
        private set
    internal open fun createWebUpdates() = WebUpdates(this)
    internal open fun createAppUpdates() = AppUpdates(this)
    override fun onCreate() {
        super.onCreate()
        // 重启接力进程不初始化资源存储，防止它提前激活pending或与主进程写入竞争。
        if (getProcessName() == "$packageName:updateRestart") return
        webUpdates = createWebUpdates()
        updates = createAppUpdates()
        appearance = PhoneAppearance(this)
        mobilePlugins = MobilePluginPreferences(getSharedPreferences("dshm.mobile-plugins.v1", MODE_PRIVATE))
        phonePluginPackages = PhonePluginPackages(File(noBackupFilesDir, "phone-plugins-v1"))
        val preinstalled = runCatching { PhonePreinstalledPlugins(assets) }.getOrElse {
            android.util.Log.w("DSHMPlugins", "Preinstalled catalog unavailable"); PhonePreinstalledPlugins(emptyList())
        }
        phonePlugins = PhonePluginStore(getSharedPreferences("dshm.phone-plugins.v2", MODE_PRIVATE), getSharedPreferences("dshm.mobile-plugins.v1", MODE_PRIVATE), phonePluginPackages, preinstalled)
        runCatching { phonePlugins.initializePreinstalled() }.onFailure { android.util.Log.w("DSHMPlugins", "Preinstalled initialization incomplete") }
        saveJournal = RemoteSaveJournal(File(noBackupFilesDir, "remote-save-writes"))
        saveRecovery = RemoteSaveRecovery(saveJournal, appearance)
        notices = RemoteNotifications(this, appearance)
        remoteDiagnostics = RemoteDiagnostics(this)
        noticeConnection = RemoteNoticeConnection(this, notices)
        registerActivityLifecycleCallbacks(this)
        noticeConnection.start()
    }
    override fun onActivityStarted(activity: Activity) = notices.started(activity)
    override fun onActivityStopped(activity: Activity) = notices.stopped(activity)
    override fun onActivityResumed(activity: Activity) {
        notices.resumed(activity); saveRecovery.resumed(activity)
        if (activity is ValidationActivity || activity is RemoteActivity) { updates.resumed(); webUpdates.check(automatic = true) }
    }
    override fun onActivityPaused(activity: Activity) { saveRecovery.paused(activity); notices.paused(activity) }
    override fun onActivityDestroyed(activity: Activity) = notices.destroyed(activity)
    override fun onActivityCreated(activity: Activity, state: Bundle?) = Unit
    override fun onActivitySaveInstanceState(activity: Activity, state: Bundle) = Unit
}
