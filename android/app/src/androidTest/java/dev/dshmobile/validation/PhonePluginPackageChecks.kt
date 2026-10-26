package dev.dshmobile.validation

import android.content.Context
import org.json.JSONObject
import java.io.File

/** 真实安装器/私有文件路由和偏好存储，使用专用测试目录，不触碰用户插件。 */
internal object PhonePluginPackageChecks {
    fun run(context: Context) {
        val root = File(context.cacheDir, "test-phone-plugin-packages")
        val prefs = context.getSharedPreferences("test-external-plugins", Context.MODE_PRIVATE)
        val legacy = context.getSharedPreferences("test-external-plugins-legacy", Context.MODE_PRIVATE)
        root.deleteRecursively(); prefs.edit().clear().commit()
        try {
            val packages = PhonePluginPackages(root); val store = PhonePluginStore(prefs, legacy, packages)
            fun artifact(version: String = "1.0.0", code: String = "export default ()=>({});") = JSONObject()
                .put("schema", 1).put("id", "@example/external").put("name", "外部首页").put("version", version).put("description", "公开API验证")
                .put("apiVersion", 1).put("surface", "dshm.remote.home").put("code", code).put("sha256", WebResourceManifest.hash(code.toByteArray()))
            fun parsed(data: JSONObject) = PhonePluginPackages.parse(data.toString().byteInputStream())
            fun rejected(data: JSONObject) = check(runCatching { parsed(data) }.isFailure)
            rejected(artifact().put("apiVersion", 2)); rejected(artifact().put("apiVersion", "1")); rejected(artifact().put("sha256", "0".repeat(64)))
            rejected(artifact().put("id", "../../escape")); rejected(artifact().put("id", "theme")); rejected(artifact().put("version", "latest"))
            rejected(artifact().put("uri", "file:///etc/passwd"))
            check(runCatching { PhonePluginPackages.parse(ByteArray(PhonePluginPackages.LIMIT + 1).inputStream()) }.isFailure)
            val one = parsed(artifact()); store.installExternal(one)
            fun item() = store.snapshot().getJSONObject("record").getJSONObject("@example/external")
            check(item().getBoolean("installed") && item().getBoolean("enabled"))
            check(packages.resource("/phone-plugins/${one.getString("sha256")}.js").data.readBytes().toString(Charsets.UTF_8) == one.getString("code"))
            check(packages.resource("/phone-plugins/../index.json").statusCode == 404)
            check(runCatching { store.installExternal(one) }.isFailure)
            val two = parsed(artifact("1.1.0", "export default ()=>({newVersion:true});")); store.installExternal(two)
            check(item().getString("version") == "1.1.0")
            check(runCatching { store.installExternal(one) }.isFailure)
            check(PhonePluginPackages(root).catalog().getJSONObject(0).getString("version") == "1.1.0")
            check(root.listFiles()!!.count { it.extension == "js" } == 1)
            store.claim("owner", "remote", JSONObject().put("lease", "lease"))
            val entry = JSONObject().put("id", "@example/external").put("host", "remote").put("group", "dshm.remote.home").put("version", "1.1.0")
            store.change(JSONObject().put("entry", entry).put("action", "uninstall"))
            check(packages.catalog().getJSONObject(0).getBoolean("available")) // 活宿主未确认停止前不删除代码。
            store.report("owner", "remote", JSONObject().put("lease", "lease").put("id", "@example/external").put("revision", item().getLong("revision")).put("status", "inactive").put("error", JSONObject.NULL))
            check(packages.catalog().length() == 0); check(root.listFiles()!!.none { it.extension == "js" })
            store.installExternal(two); check(item().getBoolean("installed"))
            val before = packages.catalog().toString()
            check(runCatching { packages.install(parsed(artifact("1.2.0"))) { error("disk full") } }.isFailure)
            check(packages.catalog().toString() == before)
        } finally { root.deleteRecursively(); prefs.edit().clear().commit(); legacy.edit().clear().commit() }
    }
}
