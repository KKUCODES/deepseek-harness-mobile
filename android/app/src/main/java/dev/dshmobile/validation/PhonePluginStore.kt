package dev.dshmobile.validation

import android.content.SharedPreferences
import org.json.JSONObject

/** 安装意图持久化，运行状态仅由对应页面宿主报告；不存Key、会话或脚本地址。 */
internal class PhonePluginStore(private val preferences: SharedPreferences, private val legacy: SharedPreferences, private val packages: PhonePluginPackages? = null, private val preinstalled: PhonePreinstalledPlugins? = null) {
    private var records = JSONObject(preferences.getString("records", "{}")!!)
    private val runtimes = JSONObject()
    private val leases = mutableMapOf<String, String>()
    private var revision = 0L
    private val listeners = mutableSetOf<() -> Unit>()
    fun observe(listener: () -> Unit): () -> Unit { listeners.add(listener); return { listeners.remove(listener) } }
    fun snapshot(): JSONObject {
        val catalog = linkedMapOf<String, JSONObject>()
        packages?.catalog()?.let { list -> for (i in 0 until list.length()) list.getJSONObject(i).let { catalog[it.getString("id")] = it } }
        preinstalled?.catalog()?.let { list -> for (i in 0 until list.length()) {
            val preset = list.getJSONObject(i); val key = preset.getString("id")
            val item = catalog[key] ?: preset.also { catalog[key] = it }
            item.put("preinstalled", true).put("preinstalledVersion", preset.getString("version"))
        } }
        val projected = JSONObject(records.toString())
        // 首次写盘失败时仍允许显式恢复，不把没有安装副本的预装条目标成运行中。
        for ((key, item) in catalog) if (!projected.has(key)) projected.put(key, record(packageDescriptor(item), false, false))
        return JSONObject().put("schema", 2).put("revision", revision).put("record", projected)
            .put("runtime", JSONObject(runtimes.toString())).put("external", org.json.JSONArray(catalog.values.toList())).put("installerApi", if (packages != null) 1 else 0)
    }
    private fun changed() { revision++; listeners.toList().forEach { runCatching { it() } } }
    private fun fields(data: JSONObject, vararg names: String) { require(data.keys().asSequence().toSet() == names.toSet()) }
    private fun id(value: String) = value.also { require(it.length <= 260 && it.matches(Regex("(@[a-z0-9._-]+/)?[a-z0-9][a-z0-9._-]{0,127}"))) }
    private fun descriptor(data: JSONObject): JSONObject {
        fields(data, "id", "host", "group", "version")
        id(data.getString("id")); require(data.getString("host") in setOf("ordinary", "remote"))
        require(data.get("group") == JSONObject.NULL || data.get("group") is String && data.getString("group").matches(Regex("[a-zA-Z0-9._-]{1,128}")))
        require(data.getString("version").matches(Regex("[a-zA-Z0-9.+_-]{1,80}")))
        return JSONObject(data.toString())
    }
    private fun save(next: JSONObject) {
        check(next.length() <= 64 && next.toString().length <= 65536)
        check(preferences.edit().putString("records", next.toString()).commit())
        records = next; changed()
    }
    private fun record(entry: JSONObject, installed: Boolean, enabled: Boolean) = JSONObject(entry.toString())
        .put("installed", installed).put("enabled", enabled).put("revision", 1).put("configured", true)
    private fun matching(existing: JSONObject, entry: JSONObject) {
        require(existing.getString("host") == entry.getString("host") && existing.get("group") == entry.get("group"))
    }
    private fun disablePeers(next: JSONObject, target: JSONObject) {
        if (!target.getBoolean("enabled") || target.isNull("group")) return
        for (key in next.keys().asSequence().toList()) {
            val item = next.getJSONObject(key)
            if (key != target.getString("id") && item.getString("host") == target.getString("host") && item.get("group") == target.get("group") && item.getBoolean("enabled")) {
                item.put("enabled", false).put("revision", item.getLong("revision") + 1)
            }
        }
    }
    fun initialize(host: String, data: JSONObject) {
        fields(data, "entries")
        val entries = data.getJSONArray("entries"); require(entries.length() <= 64)
        val next = JSONObject(records.toString())
        for (i in 0 until entries.length()) {
            val input = entries.getJSONObject(i); fields(input, "entry", "installed", "enabled")
            val entry = descriptor(input.getJSONObject("entry")); require(entry.getString("host") == host)
            val key = entry.getString("id")
            val installed = input.get("installed"); val enabled = input.get("enabled")
            require(installed is Boolean && enabled is Boolean && (installed || !enabled))
            if (!next.has(key)) {
                // 旧版只有一个界面选择；仅在首次迁移互斥界面组时读取，不覆盖新安装/卸载记录。
                val legacyEnabled = if (host == "remote" && !entry.isNull("group") && legacy.contains("selected")) legacy.getString("selected", "") == key else enabled
                val item = record(entry, installed, installed && legacyEnabled)
                next.put(key, item); disablePeers(next, item)
            } else {
                val item = next.getJSONObject(key); matching(item, entry)
                if (item.getString("version") != entry.getString("version")) item.put("version", entry.getString("version")).put("revision", item.getLong("revision") + 1)
            }
        }
        if (next.toString() != records.toString()) save(next)
    }
    fun change(data: JSONObject) {
        fields(data, "entry", "action")
        val entry = descriptor(data.getJSONObject("entry")); val key = entry.getString("id")
        val action = data.getString("action"); require(action in setOf("install", "uninstall", "enable", "disable", "retry", "update"))
        val next = JSONObject(records.toString())
        val item = if (next.has(key)) next.getJSONObject(key).also { matching(it, entry) } else record(entry, true, false)
        if (action in setOf("enable", "disable", "update")) require(item.getBoolean("installed"))
        when (action) {
            "install" -> item.put("installed", true).put("enabled", true)
            "uninstall" -> item.put("installed", false).put("enabled", false)
            "enable" -> item.put("enabled", true)
            "disable" -> item.put("enabled", false)
        }
        item.put("version", entry.getString("version")).put("revision", item.getLong("revision") + 1)
        next.put(key, item); disablePeers(next, item)
        val previousRuntime = runtimes.optJSONObject(key)
        if (leases.containsKey(item.getString("host"))) runtimes.put(key, JSONObject().put("revision", item.getLong("revision")).put("status", if (item.getBoolean("enabled")) "loading" else "stopping").put("error", JSONObject.NULL))
        try { save(next) } catch (error: Exception) { if (previousRuntime == null) runtimes.remove(key) else runtimes.put(key, previousRuntime); throw error }
        if (action == "uninstall" && !leases.containsKey(item.getString("host"))) { packages?.remove(key); changed() }
    }
    private fun packageDescriptor(data: JSONObject) = JSONObject().put("id", data.getString("id")).put("host", "remote").put("group", data.getString("surface")).put("version", data.getString("version"))
    fun initializePreinstalled() {
        for (key in preinstalled?.ids.orEmpty()) {
            val current = records.optJSONObject(key)
            if (current != null) {
                if (!current.optBoolean("preinstalledSeen")) {
                    val next = JSONObject(records.toString()); next.getJSONObject(key).put("preinstalledSeen", true); save(next)
                }
                continue // 明确卸载、停用和外部版本都比APK默认值优先。
            }
            val source = preinstalled!!.bundle(key)!!
            val installed = packages?.catalog()?.let { list -> (0 until list.length()).map { list.getJSONObject(it) }.find { it.getString("id") == key } }
            if (installed != null) {
                val next = JSONObject(records.toString()); next.put(key, record(packageDescriptor(installed), true, false).put("preinstalledSeen", true)); save(next)
            } else {
                val selected = records.keys().asSequence().any { records.getJSONObject(it).let { item -> item.optBoolean("enabled") && item.optString("group") == source.getString("surface") } }
                val preferred = !legacy.contains("selected") || legacy.getString("selected", "") == key
                installPackage(source, enabledOnNew = !selected && preferred)
            }
        }
    }
    fun restorePreinstalled(data: JSONObject) {
        fields(data, "id"); val key = id(data.getString("id"))
        require(records.optJSONObject(key)?.optBoolean("installed") != true) { "plugin_already_installed" }
        require(packages?.catalog()?.let { list -> (0 until list.length()).none { list.getJSONObject(it).getString("id") == key } } == true) { "plugin_busy" }
        installPackage(preinstalled?.bundle(key) ?: throw IllegalArgumentException("plugin_preinstalled_missing"))
    }
    fun installExternal(data: JSONObject) = installPackage(data)
    private fun installPackage(data: JSONObject, enabledOnNew: Boolean = true) {
        val entry = packageDescriptor(data)
        val current = records.optJSONObject(data.getString("id"))
        packages!!.install(data) {
            val next = JSONObject(records.toString())
            val catalogIds = packages.catalog().let { list -> (0 until list.length()).map { list.getJSONObject(it).getString("id") }.toSet() }
            for (key in next.keys().asSequence().toList()) {
                val old = next.getJSONObject(key)
                if (key != entry.getString("id") && old.getString("host") == "remote" && !old.getBoolean("installed") && key !in catalogIds
                    && key !in preinstalled?.ids.orEmpty() && !old.optBoolean("preinstalledSeen")) next.remove(key)
            }
            val item = current?.let { JSONObject(it.toString()).also { value -> matching(value, entry) } } ?: record(entry, false, false)
            item.put("installed", true).put("enabled", if (current?.optBoolean("installed") == true) current.optBoolean("enabled") else enabledOnNew)
                .put("version", entry.getString("version")).put("revision", item.getLong("revision") + 1)
            if (entry.getString("id") in preinstalled?.ids.orEmpty()) item.put("preinstalledSeen", true)
            next.put(item.getString("id"), item); disablePeers(next, item); save(next)
        }
    }
    fun claim(owner: String, host: String, data: JSONObject) {
        fields(data, "lease"); val lease = data.getString("lease"); require(lease.matches(Regex("[a-zA-Z0-9-]{1,80}")))
        leases[host] = "$owner:$lease"
        for (key in runtimes.keys().asSequence().toList()) if (records.optJSONObject(key)?.optString("host") == host) runtimes.remove(key)
        changed()
    }
    fun report(owner: String, host: String, data: JSONObject) {
        fields(data, "lease", "id", "revision", "status", "error")
        if (leases[host] != "$owner:${data.getString("lease")}") return
        val key = id(data.getString("id")); val item = records.optJSONObject(key) ?: throw IllegalArgumentException()
        require(item.getString("host") == host)
        if (data.getLong("revision") != item.getLong("revision")) return
        val status = data.getString("status"); require(status in setOf("inactive", "loading", "active", "stopping", "failed"))
        val error = data.get("error"); require(error == JSONObject.NULL || error in setOf("load", "incompatible", "missing", "timeout", "render", "storage"))
        if (status == "active" && (!item.getBoolean("enabled") || !item.getBoolean("installed"))) return
        if (status == "inactive" && !item.getBoolean("installed")) packages?.remove(key)
        runtimes.put(key, JSONObject().put("status", status).put("error", error).put("revision", item.getLong("revision"))); changed()
    }
    fun release(owner: String, host: String? = null, lease: String? = null) {
        val hosts = leases.keys.filter { (host == null || it == host) && (if (lease == null) leases[it]?.startsWith("$owner:") == true else leases[it] == "$owner:$lease") }
        if (hosts.isEmpty()) return
        hosts.forEach { leases.remove(it) }
        for (key in runtimes.keys().asSequence().toList()) if (records.optJSONObject(key)?.optString("host") in hosts) runtimes.remove(key)
        changed()
    }
}
