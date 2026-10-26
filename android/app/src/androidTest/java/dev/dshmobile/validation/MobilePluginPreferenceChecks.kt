package dev.dshmobile.validation

import android.content.Context
import org.json.JSONObject
import org.json.JSONArray

/** 隔离偏好文件核验，不改主包的界面选择、Key、配对或会话。 */
internal object MobilePluginPreferenceChecks {
    fun run(context: Context) {
        val file = context.getSharedPreferences("test-mobile-plugins", Context.MODE_PRIVATE)
        file.edit().clear().commit()
        try {
            val prefs = MobilePluginPreferences(file)
            var events = 0
            val stop = prefs.observe { events++ }
            fun choice(id: String?) = JSONObject().put("selected", id ?: JSONObject.NULL)
            fun runtime(id: String?, status: String) = choice(id).put("status", status).put("error", JSONObject.NULL)
            check(!prefs.snapshot().getBoolean("configured"))
            prefs.select(choice(null), onlyIfMissing = true)
            check(prefs.snapshot().getBoolean("configured") && prefs.snapshot().isNull("selected"))
            prefs.select(choice("@example/home"), onlyIfMissing = true)
            check(prefs.snapshot().isNull("selected"))
            prefs.select(choice("@example/home"))
            val selection = prefs.snapshot().getLong("selectionRevision")
            prefs.report("old", runtime(null, "active"))
            check(prefs.snapshot().isNull("runtime"))
            prefs.report("old", runtime("@example/home", "active"))
            prefs.report("new", runtime("@example/home", "loading"))
            prefs.release("old")
            check(prefs.snapshot().getJSONObject("runtime").getString("status") == "loading")
            check(prefs.snapshot().getLong("selectionRevision") == selection)
            prefs.release("new"); check(prefs.snapshot().isNull("runtime"))
            check(MobilePluginPreferences(file).snapshot().getString("selected") == "@example/home")
            check(runCatching { prefs.select(choice("https://bad.invalid/a.js")) }.isFailure)
            check(runCatching { prefs.select(choice(null).put("unexpected", true)) }.isFailure)
            check(runCatching { prefs.report("new", runtime("@example/home", "wrong")) }.isFailure)
            val count = events; stop(); prefs.select(choice(null)); check(events == count)
        } finally { file.edit().clear().commit() }
        unified(context)
        PhonePluginPackageChecks.run(context)
        PhonePreinstalledChecks.run(context)
    }
    private fun unified(context: Context) {
        val file = context.getSharedPreferences("test-phone-plugins-v2", Context.MODE_PRIVATE)
        val legacy = context.getSharedPreferences("test-phone-plugins-legacy", Context.MODE_PRIVATE)
        file.edit().clear().commit(); legacy.edit().clear().putString("selected", "@example/home").commit()
        try {
            val store = PhonePluginStore(file, legacy)
            fun entry(id: String, version: String = "1.0.0") = JSONObject().put("id", id).put("host", "remote").put("group", "sample.home").put("version", version)
            fun initial(vararg entries: JSONObject) = JSONObject().put("entries", JSONArray(entries.map { JSONObject().put("entry", it).put("installed", true).put("enabled", true) }))
            fun change(id: String, action: String) = store.change(JSONObject().put("entry", entry(id)).put("action", action))
            fun record(id: String) = store.snapshot().getJSONObject("record").getJSONObject(id)
            fun claim(owner: String, lease: String) = store.claim(owner, "remote", JSONObject().put("lease", lease))
            fun report(owner: String, lease: String, id: String, rev: Long = record(id).getLong("revision")) = store.report(owner, "remote", JSONObject().put("lease", lease).put("id", id).put("revision", rev).put("status", "active").put("error", JSONObject.NULL))
            store.initialize("remote", initial(entry("@example/home"), entry("@example/other")))
            check(record("@example/home").getBoolean("enabled")); check(!record("@example/other").getBoolean("enabled"))
            claim("bridge", "first"); report("bridge", "first", "@example/home")
            check(store.snapshot().getJSONObject("runtime").getJSONObject("@example/home").getString("status") == "active")
            val oldRevision = record("@example/home").getLong("revision")
            change("@example/home", "uninstall"); report("bridge", "first", "@example/home", oldRevision)
            check(!record("@example/home").getBoolean("installed"))
            store.initialize("remote", initial(entry("@example/home", "1.1.0")))
            check(!record("@example/home").getBoolean("installed")); check(record("@example/home").getString("version") == "1.1.0")
            check(!PhonePluginStore(file, legacy).snapshot().getJSONObject("record").getJSONObject("@example/home").getBoolean("installed"))
            change("@example/home", "install"); change("@example/other", "enable")
            check(!record("@example/home").getBoolean("enabled")); check(record("@example/other").getBoolean("enabled"))
            claim("bridge", "second"); report("bridge", "second", "@example/other")
            store.release("bridge", "remote", "first")
            check(store.snapshot().getJSONObject("runtime").has("@example/other"))
            check(runCatching { store.initialize("ordinary", initial(entry("@example/home"))) }.isFailure)
            check(runCatching { store.change(JSONObject().put("entry", entry("https://bad.invalid/a.js")).put("action", "install")) }.isFailure)
            check(runCatching { store.change(JSONObject().put("entry", entry("@example/home").put("host", "ordinary")).put("action", "enable")) }.isFailure)
            check(runCatching { report("bridge", "second", "@example/other", -1) }.isSuccess)
            check(PhonePluginStore(file, legacy).snapshot().getJSONObject("runtime").length() == 0)
            store.release("bridge"); check(store.snapshot().getJSONObject("runtime").length() == 0)
        } finally { file.edit().clear().commit(); legacy.edit().clear().commit() }
    }
}
