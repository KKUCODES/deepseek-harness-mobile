package dev.dshmobile.validation

import android.content.Context
import android.content.res.Configuration
import android.util.TypedValue
import org.json.JSONObject

internal object PhoneAppearanceChecks {
    fun run(context: Context) {
        val name = "dshm.test.appearance"
        val prefs = context.getSharedPreferences(name, Context.MODE_PRIVATE)
        check(prefs.edit().clear().commit())
        try {
            val appearance = PhoneAppearance(context, name)
            check(appearance.read().getString("preference") == "system")
            check(appearance.read().getString("language") == "zh")
            val systemLanguage = context.resources.configuration.locales.toLanguageTags()
            check(appearance.localizedResources(context).getString(R.string.notice_completed) == "电脑任务已完成")
            check(appearance.localizedResources(context).getString(R.string.remote_pair_invalid_title) == "配对链接无效")
            check(appearance.localizedResources(context).getString(R.string.remote_share_title) == "分享完整文件")
            var events = 0
            val off = appearance.subscribe { events++ }
            val valid = JSONObject().put("preference", "dark").put("fontSize", 17).put("enabled", true).put("language", "en")
            appearance.write(valid)
            check(events == 1)
            check(appearance.localizedResources(context).getString(R.string.notice_completed) == "Computer task completed")
            check(appearance.localizedResources(context).getString(R.string.remote_pair_invalid_title) == "Invalid pairing link")
            check(appearance.localizedResources(context).getString(R.string.remote_pair_bound_title) == "Computer already paired")
            check(appearance.localizedResources(context).getString(R.string.remote_pair_scan_prompt).startsWith("Scan the pairing QR code"))
            check(appearance.localizedResources(context).getString(R.string.remote_share_title) == "Share complete file")
            check(appearance.localizedResources(context).getString(R.string.notice_open, "test") == "test. Tap to open the chat")
            check(appearance.localizedResources(context).getString(R.string.notice_settings_title, "Connected") == "Remote alerts · Connected")
            check(context.resources.configuration.locales.toLanguageTags() == systemLanguage)
            appearance.write(valid); check(events == 1)
            check(PhoneAppearance(context, name).read().toString() == valid.toString())
            check(PhoneAppearance(context, name).localizedResources(context).getString(R.string.notice_public) == "New Remote alert")
            val legacy = JSONObject(valid.toString()).apply { remove("language") }
            appearance.write(legacy); check(events == 1)
            check(appearance.read().getString("language") == "en")
            for (bad in listOf(JSONObject(valid.toString()).put("fontSize", "17"), JSONObject(valid.toString()).put("fontSize", 18),
                JSONObject(valid.toString()).put("fontSize", 14.5), JSONObject(valid.toString()).put("preference", "custom"),
                JSONObject(valid.toString()).put("enabled", 1), JSONObject(valid.toString()).put("tokens", JSONObject()),
                JSONObject(valid.toString()).put("language", "fr"), JSONObject(valid.toString()).put("language", JSONObject.NULL))) {
                check(runCatching { appearance.write(bad) }.isFailure)
                check(appearance.read().toString() == valid.toString())
            }
            off(); appearance.write(JSONObject(valid.toString()).put("enabled", false)); check(events == 1)
            for (systemNight in listOf(Configuration.UI_MODE_NIGHT_NO, Configuration.UI_MODE_NIGHT_YES)) {
                val host = context.createConfigurationContext(Configuration(context.resources.configuration).apply {
                    uiMode = (uiMode and Configuration.UI_MODE_NIGHT_MASK.inv()) or systemNight
                })
                val before = Configuration(host.resources.configuration)
                for (enabled in listOf(true, false)) for (preference in listOf("light", "dark", "system")) {
                    appearance.write(JSONObject(valid.toString()).put("enabled", enabled).put("preference", preference))
                    val wrapped = appearance.dialogContext(host)
                    val expected = if (!enabled || preference == "system") systemNight else
                        if (preference == "dark") Configuration.UI_MODE_NIGHT_YES else Configuration.UI_MODE_NIGHT_NO
                    check(wrapped.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK == expected)
                    val light = TypedValue()
                    check(wrapped.theme.resolveAttribute(android.R.attr.isLightTheme, light, true))
                    check((light.data != 0) == (expected == Configuration.UI_MODE_NIGHT_NO))
                    check(wrapped.getString(R.string.remote_pair_invalid_title) == "Invalid pairing link")
                    check(host.resources.configuration == before)
                    check(wrapped.getSystemService(Context.WINDOW_SERVICE) === host.getSystemService(Context.WINDOW_SERVICE))
                }
            }
        } finally { check(prefs.edit().clear().commit()) }
    }
}
