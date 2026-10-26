package dev.dshmobile.validation

import android.content.Context
import org.json.JSONObject
import java.io.File

/** 用实际APK预装资产及隔离存储模拟首次安装和多次APK升级，不清用户数据。 */
internal object PhonePreinstalledChecks {
    fun run(context: Context) {
        val root = File(context.cacheDir, "test-preinstalled-plugins")
        val prefs = context.getSharedPreferences("test-preinstalled-records", Context.MODE_PRIVATE)
        val legacy = context.getSharedPreferences("test-preinstalled-legacy", Context.MODE_PRIVATE)
        root.deleteRecursively(); prefs.edit().clear().commit(); legacy.edit().clear().commit()
        try {
            val real = PhonePreinstalledPlugins(context.assets)
            check(real.ids.contains("@dshm/remote-home-design"))
            val source = real.bundle("@dshm/remote-home-design")!!; val key = source.getString("id")
            fun version(value: String) = JSONObject(source.toString()).put("version", value)
            fun preset(value: String) = PhonePreinstalledPlugins(listOf(version(value)))
            fun boot(pre: PhonePreinstalledPlugins = real) = PhonePluginStore(prefs, legacy, PhonePluginPackages(root), pre).also { it.initializePreinstalled() }
            var store = boot()
            fun item() = store.snapshot().getJSONObject("record").getJSONObject(key)
            fun descriptor() = JSONObject().put("id", key).put("host", "remote").put("group", "dshm.remote.home").put("version", item().getString("version"))
            fun change(action: String) = store.change(JSONObject().put("entry", descriptor()).put("action", action))
            check(item().getBoolean("installed") && item().getBoolean("enabled"))
            check(item().getBoolean("preinstalledSeen"))
            check(root.listFiles()!!.count { it.extension == "js" } == 1)
            val revision = item().getLong("revision"); store = boot(); check(item().getLong("revision") == revision)
            change("disable"); store = boot(preset("9.0.0")); check(!item().getBoolean("enabled") && item().getString("version") == source.getString("version"))
            store.installExternal(version("2.0.0")); check(!item().getBoolean("enabled"))
            store = boot(preset("9.0.0")); check(item().getString("version") == "2.0.0")
            store = boot(preset("0.0.1")); check(item().getString("version") == "2.0.0")
            change("uninstall"); store = boot(preset("9.0.0")); check(!item().getBoolean("installed"))
            check(root.listFiles()!!.none { it.extension == "js" })
            // 安装其他外部包不应把预装卸载墓碑清掉，移除再添加预装定义也不复活。
            val other = version("1.0.0").put("id", "@example/other")
            store.installExternal(other); store = boot(PhonePreinstalledPlugins(emptyList())); store = boot(preset("9.0.0"))
            check(!item().getBoolean("installed"))
            store.restorePreinstalled(JSONObject().put("id", key)); check(item().getBoolean("installed") && item().getString("version") == "9.0.0")
            check(runCatching { store.restorePreinstalled(JSONObject().put("id", key)) }.isFailure)
            change("uninstall"); store = boot(); store.restorePreinstalled(JSONObject().put("id", key))
            check(item().getString("version") == source.getString("version"))
            check(runCatching { store.restorePreinstalled(JSONObject().put("id", "@unknown/home")) }.isFailure)
            val emptyPrefs = context.getSharedPreferences("test-preinstalled-empty", Context.MODE_PRIVATE); emptyPrefs.edit().clear().commit()
            val emptyStore = PhonePluginStore(emptyPrefs, legacy, PhonePluginPackages(File(root,"empty")), PhonePreinstalledPlugins(emptyList()))
            emptyStore.initializePreinstalled(); check(emptyStore.snapshot().getJSONArray("external").length() == 0); emptyPrefs.edit().clear().commit()
        } finally { root.deleteRecursively(); prefs.edit().clear().commit(); legacy.edit().clear().commit() }
    }
}
