package dev.dshmobile.validation

import android.util.AtomicFile
import android.webkit.WebResourceResponse
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.InputStream
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.security.MessageDigest

/** 用户选择并确认的完整单文件包。内容寻址避免路径注入，包摘要只校验完整性，不证明作者身份。 */
internal class PhonePluginPackages(private val root: File) {
    companion object {
        const val LIMIT = 2 * 1024 * 1024
        private val packageId = Regex("(@[a-z0-9._-]+/)?[a-z0-9][a-z0-9._-]{0,127}")
        private val version = Regex("(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)")
        fun parse(input: InputStream): JSONObject {
            val output = java.io.ByteArrayOutputStream(); val buffer = ByteArray(8192)
            while (true) {
                val size = input.read(buffer); if (size < 0) break
                require(output.size() + size <= LIMIT) { "plugin_package_too_large" }; output.write(buffer, 0, size)
            }
            val bytes = output.toByteArray()
            require(bytes.size <= LIMIT) { "plugin_package_too_large" }
            val text = Charsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString()
            val data = JSONObject(text)
            require(data.keys().asSequence().toSet() == setOf("schema", "id", "name", "version", "description", "apiVersion", "surface", "code", "sha256")) { "plugin_package_invalid" }
            require(data.opt("schema") is Int && data.opt("apiVersion") is Int && listOf("id", "name", "version", "description", "surface", "code", "sha256").all { data.opt(it) is String }) { "plugin_package_invalid" }
            require(data.getInt("schema") == 1 && data.getInt("apiVersion") == 1 && data.getString("surface") == "dshm.remote.home") { "plugin_api_incompatible" }
            require(data.getString("id").length <= 260 && packageId.matches(data.getString("id")) && data.getString("version").length <= 80 && version.matches(data.getString("version"))) { "plugin_package_invalid" }
            require(data.getString("id") !in setOf("input", "theme", "rendering")) { "plugin_package_invalid" }
            for ((field, max) in listOf("name" to 80, "description" to 500)) {
                val value = data.getString(field)
                require(value.isNotBlank() && value.length <= max && value.none { it.code < 32 }) { "plugin_package_invalid" }
            }
            val code = data.getString("code"); require(code.isNotBlank() && !code.contains('\u0000')) { "plugin_package_invalid" }
            val hash = MessageDigest.getInstance("SHA-256").digest(code.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
            require(hash == data.getString("sha256")) { "plugin_package_integrity" }
            return data
        }
        private fun parts(version: String) = version.split('.').map { it.toBigInteger() }
        fun newer(next: String, old: String): Boolean {
            if (!version.matches(old)) return true // 旧随包记录仅用于迁移，不能改变新外部包的校验规则。
            val left = parts(next); val right = parts(old)
            for (i in 0..2) if (left[i] != right[i]) return left[i] > right[i]
            return false
        }
    }
    private val index = AtomicFile(File(root, "index.json"))
    private var entries = runCatching {
        if (index.baseFile.exists()) JSONObject(index.openRead().use { it.readBytes().toString(Charsets.UTF_8) }) else JSONObject()
    }.getOrElse { JSONObject() } // 损坏的插件索引不阻止聊天启动；不加载没有有效登记的脚本。
    @Synchronized fun catalog(): JSONArray = JSONArray().also { list -> entries.keys().forEach { list.put(JSONObject(entries.getJSONObject(it).toString())) } }
    private fun save(next: JSONObject) {
        root.mkdirs()
        val stream = index.startWrite()
        try { stream.write(next.toString().toByteArray()); index.finishWrite(stream); entries = next }
        catch (error: Exception) { index.failWrite(stream); throw error }
    }
    @Synchronized fun install(data: JSONObject, commit: () -> Unit) {
        val id = data.getString("id"); val old = entries.optJSONObject(id)
        require(old == null || !old.optBoolean("available") || newer(data.getString("version"), old.getString("version"))) { "plugin_version_not_newer" }
        require(entries.has(id) || entries.length() < 32) { "plugin_package_limit" }
        val metadata = JSONObject(data.toString()).apply { remove("code"); remove("schema"); put("available", true) }
        val file = AtomicFile(File(root, data.getString("sha256") + ".js"))
        root.mkdirs(); val stream = file.startWrite()
        try { stream.write(data.getString("code").toByteArray(Charsets.UTF_8)); file.finishWrite(stream) }
        catch (error: Exception) { file.failWrite(stream); throw error }
        val previous = JSONObject(entries.toString()); val next = JSONObject(entries.toString()).put(id, metadata)
        save(next)
        try { commit() } catch (error: Exception) { save(previous); collect(); throw error }
        collect()
    }
    @Synchronized fun remove(id: String) {
        if (!entries.has(id)) return
        val next = JSONObject(entries.toString()); next.remove(id)
        save(next); collect()
    }
    @Synchronized private fun collect() {
        val live = entries.keys().asSequence().map { entries.getJSONObject(it) }.filter { it.optBoolean("available") }.map { it.getString("sha256") + ".js" }.toSet()
        root.listFiles()?.filter { it.name.matches(Regex("[a-f0-9]{64}\\.js")) && it.name !in live }?.forEach { it.delete() }
    }
    @Synchronized fun resource(path: String): WebResourceResponse {
        val name = path.removePrefix("/phone-plugins/")
        val allowed = name.matches(Regex("[a-f0-9]{64}\\.js")) && entries.keys().asSequence().any {
            val item = entries.getJSONObject(it); item.optBoolean("available") && item.getString("sha256") + ".js" == name
        }
        val file = File(root, name)
        return if (allowed && file.isFile) WebResourceResponse("text/javascript", "UTF-8", 200, "OK",
            mapOf("Cache-Control" to "no-store", "X-Content-Type-Options" to "nosniff"), file.inputStream())
        else WebResourceResponse("text/plain", "UTF-8", 404, "Not found", emptyMap(), ByteArray(0).inputStream())
    }
}
