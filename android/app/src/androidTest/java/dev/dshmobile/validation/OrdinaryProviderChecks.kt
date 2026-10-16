package dev.dshmobile.validation

import android.app.Instrumentation
import android.content.Intent
import android.webkit.WebView
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.UUID

/** 只在隔离 UID 使用一次性配置和非真实 Key，覆盖生产存储、加密隔离及请求字段边界。 */
object OrdinaryProviderChecks {
    fun run(instrumentation: Instrumentation) {
        val context = instrumentation.targetContext
        check(context.packageName.endsWith(".toolstyletest"))
        val fileName = "test-ordinary-providers-${UUID.randomUUID()}.json"
        val store = OrdinaryProviders(context, fileName)
        var providerId: String? = null
        val originalCredentials = OrdinaryCredentials(context)
        val seededLegacy = !originalCredentials.configured()
        if (seededLegacy) originalCredentials.save("owned-legacy-fixture-not-an-api-key")
        val legacy = File(context.noBackupFilesDir, "dshm.ordinary.deepseek.v1.encrypted")
        val legacyBefore = if (legacy.exists()) legacy.readBytes() else null
        val configuredBefore = OrdinaryCredentials(context).configured()
        val model = JSONObject().put("id", "vendor/model").put("label", "自定义模型").put("vision", false).put("thinking", "none").put("tokenField", "max_completion_tokens").put("sampling", false)
        val draft = JSONObject().put("name", "隔离测试").put("baseURL", "https://api.example.com/v1/").put("models", JSONArray().put(model))
        try {
            val created = store.save(draft)
            providerId = created.getString("id")
            check(created.getString("baseURL") == "https://api.example.com/v1")
            check(!created.getBoolean("configured"))
            check(OrdinaryProviders(context, fileName).get(providerId).getString("revision") == created.getString("revision"))
            val key = store.credentials(providerId)
            key.save("disposable-fixture-not-an-api-key")
            check(store.catalog().toString().contains("disposable-fixture").not())
            check(store.get(providerId).has("key").not())
            check(OrdinaryProviders(context, fileName).credentials(providerId).read() == "disposable-fixture-not-an-api-key")
            check(runCatching { store.save(JSONObject(draft.toString()).put("id", providerId).put("revision", created.getString("revision")).put("baseURL", "https://other.example.com")) }.exceptionOrNull().let { it is OrdinaryProviders.Failure && it.code == "provider_endpoint_locked" })
            check(runCatching { store.save(JSONObject(draft.toString()).put("id", providerId).put("revision", "stale")) }.isFailure)
            for (bad in listOf("http://api.example.com", "https://user:pass@api.example.com", "https://api.example.com?key=fixture", "https://api.example.com#fragment", "https://api.example.com/../other", "https://api.example.com/%2e%2e/other", "file:///tmp/test", "https://api.example.com/v1/chat/completions")) {
                check(runCatching { OrdinaryProviders.baseURL(bad) }.isFailure)
            }
            check(runCatching { store.save(JSONObject(draft.toString()).put("models", JSONArray().put(model).put(model))) }.isFailure)
            check(runCatching { store.save(JSONObject(draft.toString()).put("authorization", "fixture")) }.isFailure)
            store.defaultSelection(providerId, "vendor/model")
            check(store.catalog().getJSONObject("default").getString("provider") == providerId)
            check(runCatching { store.defaultSelection(providerId, "not-registered") }.isFailure)
            check(store.catalog().getJSONArray("providers").getJSONObject(0).getBoolean("configured") == configuredBefore)

            val activity = instrumentation.startActivitySync(Intent(context, ValidationActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            instrumentation.runOnMainSync {
                val view = WebView(activity)
                val bridge = OrdinaryBridge(activity, view)
                try {
                    val payload = OrdinaryBridge::class.java.getDeclaredMethod("payload", JSONObject::class.java, JSONObject::class.java).apply { isAccessible = true }
                    fun request(modelId: String) = JSONObject().put("requestId", "test-request").put("model", modelId).put("messages", JSONArray().put(JSONObject().put("role", "user").put("content", "test")))
                    fun body(data: JSONObject, provider: JSONObject) = JSONObject(payload.invoke(bridge, data, provider) as String)
                    val plain = body(request("vendor/model"), store.get(providerId!!))
                    check(plain.keys().asSequence().toSet() == setOf("model", "messages", "stream"))
                    val limited = body(request("vendor/model").put("requestOptions", JSONObject().put("maxTokens", 512)), store.get(providerId))
                    check(limited.getInt("max_completion_tokens") == 512 && !limited.has("max_tokens") && !limited.has("temperature"))
                    check(runCatching { body(request("vendor/model").put("url", "https://other.example.com"), store.get(providerId)) }.isFailure)
                    check(runCatching { body(request("vendor/model").put("thinking", true), store.get(providerId)) }.isFailure)
                    check(runCatching { body(request("unregistered"), store.get(providerId)) }.isFailure)
                    val legacyBody = body(request("deepseek-flash").put("thinking", true), OrdinaryProviders.builtin())
                    check(legacyBody.getJSONObject("thinking").getString("type") == "enabled" && legacyBody.getInt("max_tokens") == 16384)
                    check(legacyBody.getString("reasoning_effort") == "high")
                } finally { bridge.close(); view.destroy() }
            }
            key.clear()
            val updated = store.save(JSONObject(draft.toString()).put("id", providerId).put("revision", created.getString("revision")).put("baseURL", "https://new.example.com/v1"))
            check(updated.getBoolean("configured").not())
            store.remove(providerId, updated.getString("revision"))
            check(store.catalog().getJSONArray("providers").length() == 1 && !store.catalog().has("default"))
            check(runCatching { store.get(providerId) }.isFailure)
            check(OrdinaryCredentials(context).configured() == configuredBefore)
            check(if (legacyBefore == null) !legacy.exists() else legacy.readBytes().contentEquals(legacyBefore))
            if (seededLegacy) check(OrdinaryCredentials(context).read() == "owned-legacy-fixture-not-an-api-key")
        } finally {
            providerId?.let { store.credentials(it).clear() }
            File(context.noBackupFilesDir, fileName).delete()
            File(context.noBackupFilesDir, "$fileName.bak").delete()
            if (seededLegacy) { originalCredentials.clear(); check(!originalCredentials.configured()) }
        }
    }
}
