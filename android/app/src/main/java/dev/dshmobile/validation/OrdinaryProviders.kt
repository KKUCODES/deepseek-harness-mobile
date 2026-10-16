package dev.dshmobile.validation

import android.content.Context
import android.util.AtomicFile
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.URI
import java.util.UUID

/** 原生层持有请求目标与凭据对应关系；网页发送供应商 ID，不能在单次请求中指定目标或认证头。 */
class OrdinaryProviders(private val context: Context, name: String = "ordinary-providers-v1.json") {
    class Failure(val code: String) : Exception()
    private val file = AtomicFile(File(context.noBackupFilesDir, name))
    private fun fail(code: String): Nothing = throw Failure(code)
    private fun record(): JSONObject = if (!file.baseFile.exists()) JSONObject().put("providers", JSONArray()) else
        JSONObject(file.readFully().toString(Charsets.UTF_8)).also {
            if (it.optInt("version") != 1 || it.getJSONArray("providers").length() > 30) fail("provider_store_invalid")
        }
    private fun write(value: JSONObject) {
        value.put("version", 1)
        val output = file.startWrite()
        try { output.write(value.toString().toByteArray(Charsets.UTF_8)); file.finishWrite(output) }
        catch (error: Exception) { file.failWrite(output); throw error }
    }
    fun credentials(id: String): OrdinaryCredentials {
        if (!validId(id)) fail("invalid_provider")
        return OrdinaryCredentials(context, if (id == "deepseek") "dshm.ordinary.deepseek.v1" else "dshm.ordinary.$id.v1")
    }
    @Synchronized fun get(id: String): JSONObject {
        if (id == "deepseek") return builtin()
        if (!validId(id)) fail("invalid_provider")
        val values = record().getJSONArray("providers")
        return (0 until values.length()).map { values.getJSONObject(it) }.find { it.getString("id") == id }
            ?: fail("provider_missing")
    }
    @Synchronized fun catalog(): JSONObject {
        val state = record()
        val values = JSONArray().put(public(builtin()))
        val custom = state.getJSONArray("providers")
        for (index in 0 until custom.length()) values.put(public(custom.getJSONObject(index)))
        return JSONObject().put("providers", values).also { if (state.has("default")) it.put("default", state.getJSONObject("default")) }
    }
    private fun public(provider: JSONObject) = JSONObject(provider.toString()).put("configured", credentials(provider.getString("id")).configured())
    @Synchronized fun save(input: JSONObject): JSONObject {
        val fields = input.keys().asSequence().toSet()
        if (!fields.containsAll(setOf("name", "baseURL", "models")) || !setOf("id", "revision", "name", "baseURL", "models").containsAll(fields)) fail("invalid_provider")
        val id = if (input.has("id")) input.getString("id") else "p-${UUID.randomUUID()}"
        if (!validId(id) || id == "deepseek") fail("invalid_provider")
        val state = record()
        val oldValues = state.getJSONArray("providers")
        val previous = (0 until oldValues.length()).map { oldValues.getJSONObject(it) }.find { it.getString("id") == id }
        if (input.has("id") && (previous == null || input.optString("revision") != previous.getString("revision"))) fail("provider_stale")
        if (previous == null && oldValues.length() >= 30) fail("provider_limit")
        val name = input.getString("name").trim()
        if (name.length !in 1..80) fail("invalid_provider")
        val base = baseURL(input.getString("baseURL"))
        // 更换目标前必须显式移除旧 Key，不能把一个站点的凭据静默发给另一个站点。
        if (previous != null && previous.getString("baseURL") != base && credentials(id).configured()) fail("provider_endpoint_locked")
        val models = input.getJSONArray("models")
        if (models.length() !in 1..50) fail("invalid_provider")
        val cleanModels = JSONArray()
        val ids = mutableSetOf<String>()
        for (index in 0 until models.length()) {
            val model = models.getJSONObject(index)
            if (model.keys().asSequence().toSet() != setOf("id", "label", "vision", "thinking", "tokenField", "sampling")) fail("invalid_provider")
            val modelId = model.getString("id").trim()
            val label = model.getString("label").trim()
            if (!validModel(modelId) || !ids.add(modelId) || label.length !in 1..80 || model.get("vision") !is Boolean || model.get("sampling") !is Boolean ||
                model.getString("thinking") !in setOf("none", "thinking", "reasoning_effort") || model.getString("tokenField") !in setOf("max_tokens", "max_completion_tokens")) fail("invalid_provider")
            cleanModels.put(JSONObject(model.toString()).put("id", modelId).put("label", label))
        }
        val provider = JSONObject().put("id", id).put("name", name).put("baseURL", base).put("models", cleanModels).put("builtin", false).put("revision", UUID.randomUUID().toString())
        val values = JSONArray()
        for (index in 0 until oldValues.length()) if (oldValues.getJSONObject(index).getString("id") != id) values.put(oldValues.getJSONObject(index))
        values.put(provider)
        state.put("providers", values)
        write(state)
        return public(provider)
    }
    @Synchronized fun remove(id: String, revision: String) {
        val provider = get(id)
        if (id == "deepseek" || provider.getString("revision") != revision) fail("provider_stale")
        val state = record()
        val old = state.getJSONArray("providers")
        val values = JSONArray()
        for (index in 0 until old.length()) if (old.getJSONObject(index).getString("id") != id) values.put(old.getJSONObject(index))
        state.put("providers", values)
        if (state.optJSONObject("default")?.optString("provider") == id) state.remove("default")
        write(state)
        credentials(id).clear()
    }
    @Synchronized fun defaultSelection(providerId: String, modelId: String) {
        val provider = get(providerId)
        model(provider, modelId)
        val state = record().put("default", JSONObject().put("provider", providerId).put("model", modelId))
        write(state)
    }
    companion object {
        fun validId(value: String) = value == "deepseek" || Regex("p-[a-f0-9-]{36}").matches(value)
        fun validModel(value: String) = Regex("[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,199}").matches(value)
        fun baseURL(value: String): String {
            val uri = try { URI(value) } catch (_: Exception) { throw Failure("invalid_api_address") }
            if (value.length > 2048 || uri.scheme != "https" || uri.host.isNullOrEmpty() || uri.rawUserInfo != null || uri.rawQuery != null || uri.rawFragment != null || uri.port !in -1..65535 ||
                uri.rawPath.orEmpty().contains(Regex("%2[fFeE]|%5[cC]", RegexOption.IGNORE_CASE)) || uri.path.orEmpty().split('/').any { it == "." || it == ".." } || value.contains('\\')) throw Failure("invalid_api_address")
            val result = uri.toASCIIString().trimEnd('/')
            if (result.endsWith("/chat/completions")) throw Failure("api_base_required")
            return result
        }
        fun model(provider: JSONObject, id: String): JSONObject {
            val models = provider.getJSONArray("models")
            return (0 until models.length()).map { models.getJSONObject(it) }.find { it.getString("id") == id } ?: throw Failure("unsupported_model")
        }
        fun builtin() = JSONObject().put("id", "deepseek").put("name", "DeepSeek").put("baseURL", "https://api.deepseek.com").put("revision", "builtin-1").put("builtin", true)
            .put("models", JSONArray().put(JSONObject().put("id", "deepseek-flash").put("label", "DeepSeek Flash").put("vision", true).put("thinking", "deepseek").put("tokenField", "max_tokens").put("sampling", true))
                .put(JSONObject().put("id", "deepseek-v4-pro").put("label", "DeepSeek Pro").put("vision", false).put("thinking", "deepseek").put("tokenField", "max_tokens").put("sampling", true)))
    }
}
