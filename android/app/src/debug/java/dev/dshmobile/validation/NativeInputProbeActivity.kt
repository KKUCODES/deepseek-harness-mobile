package dev.dshmobile.validation

import android.app.Activity
import android.graphics.Rect
import android.os.Bundle
import android.text.InputType
import android.view.inputmethod.InputMethodManager
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView

/** 仅 debug 包的原生对照，用于区分 WebView 输入问题和设备 IME 环境问题。 */
class NativeInputProbeActivity : Activity() {
    private lateinit var editor: EditText

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            val padding = (20 * resources.displayMetrics.density).toInt()
            setPadding(padding, padding, padding, padding)
        }
        content.addView(TextView(this).apply {
            setText(R.string.ime_probe_description)
            textSize = 18f
        })
        editor = EditText(this).apply {
            setHint(R.string.ime_probe_hint)
            contentDescription = getString(R.string.ime_probe_label)
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE
            minLines = 3
        }
        content.addView(editor)
        content.addView(Button(this).apply {
            setText(R.string.ime_probe_show)
            setOnClickListener { showKeyboard() }
        })
        val measurements = TextView(this)
        content.addView(measurements)
        content.viewTreeObserver.addOnGlobalLayoutListener {
            val visible = Rect()
            content.getWindowVisibleDisplayFrame(visible)
            val next = getString(R.string.ime_probe_measurements, visible.width(), visible.height(), content.height)
            if (measurements.text.toString() != next) measurements.text = next
        }
        setContentView(content)
        editor.requestFocus()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        // 按官方示例等窗口取得焦点后请求，避免把焦点竞态误诊为 IME 失效。
        if (hasFocus) editor.post { showKeyboard() }
    }

    private fun showKeyboard() {
        editor.requestFocus()
        getSystemService(InputMethodManager::class.java)
            .showSoftInput(editor, InputMethodManager.SHOW_IMPLICIT)
    }
}
