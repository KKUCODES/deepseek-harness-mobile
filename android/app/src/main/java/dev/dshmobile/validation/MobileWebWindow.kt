package dev.dshmobile.validation

import android.app.Activity
import android.os.Build
import android.view.ViewGroup
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.View
import android.content.res.Configuration
import android.util.TypedValue
import android.webkit.WebView
import android.widget.FrameLayout

/** Android 15起强制边到边；由原生容器让出系统栏和键盘，使网页得到真实可用高度。 */
internal object MobileWebWindow {
    fun observeAppearance(activity: Activity): () -> Unit {
        updateAppearance(activity)
        return (activity.application as DshmApplication).appearance.subscribe {
            activity.runOnUiThread { updateAppearance(activity) }
        }
    }

    /** 只更新系统栏，不改变Activity主题或WebView媒体查询，保留显式手机主题。 */
    @Suppress("DEPRECATION")
    fun updateAppearance(activity: Activity) {
        val context = (activity.application as DshmApplication).appearance.dialogContext(activity)
        val dark = context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES
        val background = TypedValue().also { context.theme.resolveAttribute(android.R.attr.colorBackground, it, true) }.data
        val window = activity.window
        window.decorView.setBackgroundColor(background)
        window.statusBarColor = background
        window.navigationBarColor = background
        if (Build.VERSION.SDK_INT >= 30) {
            val mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS or WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
            window.insetsController?.setSystemBarsAppearance(if (dark) 0 else mask, mask)
        } else {
            val mask = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
            window.decorView.systemUiVisibility = (window.decorView.systemUiVisibility and mask.inv()) or (if (dark) 0 else mask)
        }
    }

    fun install(activity: Activity, webView: WebView): Boolean {
        if (Build.VERSION.SDK_INT < 35) return false
        val container = FrameLayout(activity)
        container.addView(webView, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        container.setOnApplyWindowInsetsListener { view, insets ->
            val available = insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout() or WindowInsets.Type.ime())
            view.setPadding(available.left, available.top, available.right, available.bottom)
            WindowInsets.CONSUMED
        }
        activity.setContentView(container)
        container.requestApplyInsets()
        return true
    }
}
