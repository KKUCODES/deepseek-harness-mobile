package dev.dshmobile.validation

import android.app.Instrumentation
import android.content.Intent
import android.content.Context
import android.view.View
import android.view.ViewGroup
import android.view.inspector.WindowInspector
import android.util.TypedValue
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import org.json.JSONObject
import java.util.UUID

/** 操作生产原生窗口，替换的只有传输；所有输入均是无价值哨兵，不访问真实电脑。 */
object RemoteComputerKeyChecks {
    var stage = "not-started"
        private set
    fun run(instrumentation: Instrumentation) {
        stage = "launch"
        val activity = instrumentation.startActivitySync(Intent(instrumentation.targetContext, ComputerKeyProbeActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        val frames = mutableListOf<JSONObject>()
        var generation = 1
        var result: JSONObject? = null
        var failure: String? = null
        lateinit var editor: RemoteComputerKey
        val preferenceName = "dshm.test.computer-key-language"
        val preferences = activity.getSharedPreferences(preferenceName, Context.MODE_PRIVATE)
        check(preferences.edit().clear().commit())
        val appearance = PhoneAppearance(activity, preferenceName)
        fun main(action: () -> Unit) { instrumentation.runOnMainSync(action); instrumentation.waitForIdleSync() }
        fun open(target: String? = null) = main {
            result = null; failure = null
            val request = JSONObject().put("snapshot", UUID.randomUUID().toString())
            if (target != null) request.put("target", target)
            editor.open(request) { value, error -> result = value; failure = error }
        }
        fun views(): List<View> {
            check(android.os.Build.VERSION.SDK_INT >= 29)
            fun walk(view: View): List<View> = listOf(view) + if (view is ViewGroup) (0 until view.childCount).flatMap { walk(view.getChildAt(it)) } else emptyList()
            return WindowInspector.getGlobalWindowViews().flatMap(::walk)
        }
        fun click(text: String) {
            main { check(views().filterIsInstance<Button>().single { it.text.toString() == text && it.isShown }.performClick()) }
        }
        fun fill() {
            main {
                val password = views().filterIsInstance<EditText>().single { it.isShown }
                check(password.transformationMethod is android.text.method.PasswordTransformationMethod)
                password.setText("TEST_NATIVE_ONLY")
            }
        }
        fun language(value: String) = main { appearance.write(appearance.read().put("language", value)) }
        fun text(value: String) = views().filterIsInstance<TextView>().any { it.isShown && it.text.toString().contains(value) }
        try {
            main { editor = RemoteComputerKey(activity, { generation }, { frame -> frames.add(frame); true }, { true }, appearance) }
            stage = "dialog-theme-cancel"
            for (preference in listOf("light", "dark")) {
                main { appearance.write(appearance.read().put("preference", preference)) }
                open()
                main {
                    val password = views().filterIsInstance<EditText>().single { it.isShown }
                    val light = TypedValue()
                    check(password.context.theme.resolveAttribute(android.R.attr.isLightTheme, light, true))
                    check((light.data != 0) == (preference == "light"))
                    check(password.text.isEmpty())
                }
                click("取消")
                check(result?.optBoolean("cancelled") == true && frames.isEmpty())
            }
            main { appearance.write(appearance.read().put("preference", "system")) }
            stage = "language-cancel"; open(); fill()
            lateinit var password: EditText
            main { password = views().filterIsInstance<EditText>().single { it.isShown }; password.setSelection(2, 5) }
            language("en")
            main {
                check(views().filterIsInstance<EditText>().single { it.isShown } === password)
                check(password.text.toString() == "TEST_NATIVE_ONLY" && password.selectionStart == 2 && password.selectionEnd == 5)
                check(text("Computer DeepSeek Key") && text("Key transmission is not encrypted."))
                check(password.importantForAutofill == View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS && !password.isSaveEnabled)
                check(WindowInspector.getGlobalWindowViews().any {
                    ((it.layoutParams as? android.view.WindowManager.LayoutParams)?.flags ?: 0) and android.view.WindowManager.LayoutParams.FLAG_SECURE != 0
                })
            }
            check(frames.isEmpty()); click("Cancel")
            check(result?.optBoolean("cancelled") == true && frames.isEmpty())
            check(password.text.isEmpty())
            stage = "invalid-language"; open(); click("Save to computer")
            main { check(views().filterIsInstance<EditText>().single { it.isShown }.error.toString() == "Enter a valid Key without spaces or line breaks") }
            language("zh")
            main { check(views().filterIsInstance<EditText>().single { it.isShown }.error.toString() == "请输入有效的 Key（不能包含空格或换行）") }
            click("取消"); check(frames.isEmpty())
            stage = "save"; open(); fill(); click("保存到电脑"); language("en")
            main {
                check(text("Saving to computer…"))
                check(views().filterIsInstance<Button>().filter { it.isShown }.all { !it.isEnabled })
                check(views().filterIsInstance<EditText>().single { it.isShown }.text.isEmpty())
            }
            val first = frames.single(); check(first.getJSONObject("operation").getJSONObject("change").getString("value") == "TEST_NATIVE_ONLY")
            main { check(editor.receive(JSONObject().put("type", "result").put("id", first.getString("id")).put("value",
                JSONObject().put("provider", "deepseek-official").put("configured", true).put("writable", true).put("secret", "TEST_LEAK_ONLY")))) }
            check(result?.optBoolean("configured") == true && !result.toString().contains("TEST_"))
            stage = "remove"; open(); click("Remove computer Key"); check(frames.size == 1); language("zh")
            main {
                check(text("再次点击“确认移除”才会提交。"))
                check(!views().filterIsInstance<Button>().single { it.isShown && it.text.toString() == "保存到电脑" }.isEnabled)
                check(!views().filterIsInstance<EditText>().single { it.isShown }.isEnabled)
            }
            check(frames.size == 1); click("确认移除")
            check(frames.last().getJSONObject("operation").getJSONObject("change").toString() == "{\"op\":\"unset\"}")
            main { editor.receive(JSONObject().put("type", "error").put("id", frames.last().getString("id")).put("code", "TEST_ERROR_SECRET")) }
            check(failure == "remote_key_write_unconfirmed")
            stage = "uncertain"; open(); check(failure == "remote_key_write_unconfirmed" && frames.size == 2)
            stage = "cancel-in-flight"; main { generation++ }; open(); fill(); click("保存到电脑")
            main { editor.cancel() }; check(failure == "remote_key_write_unconfirmed")
            check(frames.last().getString("type") == "cancel")
            stage = "generation"; main { generation++ }; open(); main { generation++; editor.cancel() }
            check(result?.optBoolean("cancelled") == true)
            stage = "search-target-cancel"; open("web-search-deepseek")
            main { check(text("电脑网页搜索 Key")) }
            val beforeSearch = frames.size; click("取消")
            check(result?.optBoolean("cancelled") == true && frames.size == beforeSearch)
            stage = "search-target-mismatch"; open("web-search-deepseek"); fill(); click("保存到电脑")
            check(frames.last().getJSONObject("operation").getString("target") == "web-search-deepseek")
            main { editor.receive(JSONObject().put("type", "result").put("id", frames.last().getString("id")).put("value",
                JSONObject().put("provider", "deepseek-official").put("configured", true).put("writable", true))) }
            check(failure == "remote_key_write_unconfirmed" && result == null)
            stage = "search-target-save"; main { generation++ }; open("web-search-deepseek"); fill(); click("保存到电脑")
            main { editor.receive(JSONObject().put("type", "result").put("id", frames.last().getString("id")).put("value",
                JSONObject().put("provider", "deepseek-search").put("configured", true).put("writable", true))) }
            check(result?.optBoolean("configured") == true && !result.toString().contains("TEST_"))
            stage = "passed"
        } finally { main { editor.cancel(); activity.finish() }; check(preferences.edit().clear().commit()) }
    }
}
