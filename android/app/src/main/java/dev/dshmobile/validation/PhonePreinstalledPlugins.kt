package dev.dshmobile.validation

import android.content.res.AssetManager
import org.json.JSONArray
import org.json.JSONObject

/** 只提供APK内的完整包；安装副本仍经PhonePluginStore和PhonePluginPackages处理。 */
internal class PhonePreinstalledPlugins(private val bundles: List<JSONObject>) {
    constructor(assets: AssetManager) : this(assets.list("preinstalled-plugins").orEmpty().filter { it.endsWith(".dshm-plugin") }.sorted().map { file ->
        require(file.matches(Regex("[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}\\.dshm-plugin")))
        assets.open("preinstalled-plugins/$file").use { PhonePluginPackages.parse(it) }
    })
    init { require(bundles.size <= 32 && bundles.map { it.getString("id") }.distinct().size == bundles.size) }
    val ids get() = bundles.map { it.getString("id") }.toSet()
    fun bundle(id: String) = bundles.find { it.getString("id") == id }?.let { JSONObject(it.toString()) }
    fun catalog(): JSONArray = JSONArray().also { list -> bundles.forEach { source -> list.put(JSONObject(source.toString()).apply {
        remove("code"); remove("schema"); put("available", false); put("preinstalled", true); put("preinstalledVersion", source.getString("version"))
    }) } }
}
