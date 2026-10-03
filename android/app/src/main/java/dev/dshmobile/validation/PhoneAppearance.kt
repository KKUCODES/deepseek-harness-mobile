package dev.dshmobile.validation

import android.content.Context
import android.content.res.Configuration
import android.content.res.Resources
import android.view.ContextThemeWrapper
import org.json.JSONObject
import java.util.Locale

/** 普通聊天保存的手机外观与语言镜像；Remote只能读取，不接收电脑配置或任意CSS。 */
internal class PhoneAppearance(context: Context, name: String = "dshm.phone.appearance.v1") {
    private val preferences = context.getSharedPreferences(name, Context.MODE_PRIVATE)
    private val listeners = linkedSetOf<() -> Unit>()
    fun language(): String = preferences.getString("language", "zh") ?: "zh"
    /** 局部资源上下文，不修改系统语言、不重建Activity，也不清空正在输入的原生表单。 */
    fun localizedResources(context: Context): Resources = context.createConfigurationContext(
        Configuration(context.resources.configuration).apply { setLocale(if (language() == "en") Locale.ENGLISH else Locale.SIMPLIFIED_CHINESE) }
    ).resources
    /** 仅包装原生对话框；不能改Activity主题，否则会影响WebView对系统配色的判断。 */
    fun dialogContext(context: Context): Context {
        val preference = if (preferences.getBoolean("enabled", true)) preferences.getString("preference", "system") else "system"
        val night = when (preference) {
            "light" -> Configuration.UI_MODE_NIGHT_NO
            "dark" -> Configuration.UI_MODE_NIGHT_YES
            else -> context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK
        }
        val config = Configuration(context.resources.configuration).apply {
            uiMode = (uiMode and Configuration.UI_MODE_NIGHT_MASK.inv()) or night
            setLocale(if (language() == "en") Locale.ENGLISH else Locale.SIMPLIFIED_CHINESE)
        }
        // 以原Activity为base保留WindowManager的窗口归属，配置只覆盖包装资源。
        return ContextThemeWrapper(context,
            if (night == Configuration.UI_MODE_NIGHT_YES) android.R.style.Theme_Material_NoActionBar
            else android.R.style.Theme_Material_Light_NoActionBar).apply { applyOverrideConfiguration(config) }
    }
    fun read() = JSONObject().put("preference", preferences.getString("preference", "system"))
        .put("fontSize", preferences.getInt("fontSize", 14)).put("enabled", preferences.getBoolean("enabled", true))
        .put("language", preferences.getString("language", "zh"))
    fun write(value: JSONObject) {
        val keys = value.keys().asSequence().toSet()
        require(keys == setOf("preference", "fontSize", "enabled") || keys == setOf("preference", "fontSize", "enabled", "language"))
        val preference = value.get("preference")
        val size = value.get("fontSize")
        // 旧页面不含语言时保留原值；新安装默认中文，与普通聊天一致。
        val language = if (value.has("language")) value.get("language") else read().getString("language")
        require(preference is String && preference in setOf("light", "dark", "system"))
        require(language is String && language in setOf("zh", "en"))
        require(size is Int && size in 12..17 && value.get("enabled") is Boolean)
        val old = read()
        if (old.getString("preference") == preference && old.getInt("fontSize") == size && old.getBoolean("enabled") == value.getBoolean("enabled") && old.getString("language") == language) return
        check(preferences.edit().putString("preference", preference).putInt("fontSize", size)
            .putBoolean("enabled", value.getBoolean("enabled")).putString("language", language).commit())
        listeners.toList().forEach { it() }
    }
    fun subscribe(listener: () -> Unit): () -> Unit { listeners.add(listener); return { listeners.remove(listener) } }
}
