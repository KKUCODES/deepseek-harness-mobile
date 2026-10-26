package dev.dshmobile.validation

import android.animation.ValueAnimator
import android.app.Activity
import android.graphics.drawable.ColorDrawable
import android.os.Build
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.animation.PathInterpolator
import android.webkit.WebView
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature

/** 启动封面只等待本地首屏；不等待模型、Remote连接或网络数据。 */
internal class StartupScreen(private val activity: Activity, private val webView: WebView, private val page: Page = Page.ORDINARY,
    private val reopen: (() -> Unit)? = null) {
    enum class Page(val origin: String, val entry: String) {
        ORDINARY("https://appassets.androidplatform.net", "mobile.html"),
        REMOTE(RemoteBridge.ORIGIN, "remote.html");
        val url get() = "$origin/assets/web/$entry"
    }
    private val content = activity.findViewById<ViewGroup>(android.R.id.content)
    private val cover = FrameLayout(activity)
    private val logo = ImageView(activity).apply {
        setImageResource(R.drawable.ic_launcher_foreground)
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
    }
    private val error = LinearLayout(activity).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER
        visibility = View.GONE
    }
    private var splash: View? = null
    private var removeSplash: (() -> Unit)? = null
    private var phase = "loading"
    private var generation = 0L
    private val timeout = Runnable { fail() }
    private val pageUpdates get() = (activity.application as DshmApplication).webUpdates

    init {
        cover.isClickable = true
        cover.isFocusable = true
        cover.contentDescription = "DSHM"
        webView.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
        cover.addView(logo, FrameLayout.LayoutParams(dp(240), dp(240), Gravity.CENTER))
        val appearance = (activity.application as DshmApplication).appearance
        val context = appearance.dialogContext(activity)
        val color = TypedValue().also { context.theme.resolveAttribute(android.R.attr.colorBackground, it, true) }.data
        cover.setBackgroundColor(color)
        webView.setBackgroundColor(color)
        activity.window.setBackgroundDrawable(ColorDrawable(color))
        val english = appearance.language() == "en"
        error.addView(TextView(context).apply {
            text = if (english) "Could not load this page. Please try again." else "界面加载失败，请重试。"
            textSize = 16f
            gravity = Gravity.CENTER
            setPadding(dp(24), 0, dp(24), dp(12))
        })
        error.addView(Button(context).apply {
            text = if (english) "Try again" else "重新打开"
            setOnClickListener { if (rendererGone && reopen != null) reopen.invoke() else { loading(); webView.reload() } }
        })
        error.addView(Button(context).apply {
            text = if (english) "Restore bundled pages" else "恢复内置页面"
            setOnClickListener { pageUpdates.recovery(activity, preparePages = false) }
        })
        cover.addView(error, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER))
        content.addView(cover, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) WebViewCompat.addWebMessageListener(webView, "DSHMStartup", setOf(page.origin)) { _, message, source, main, _ ->
            // 每个容器只接受自己的固定主页面；插件iframe和另一模式不能撤掉封面。
            if (main && source.toString() == page.origin && webView.url == page.url) when (message.data) {
                "ready" -> ready()
                "failed" -> fail()
            }
        }
        if (Build.VERSION.SDK_INT >= 31) activity.splashScreen.setOnExitAnimationListener { view ->
            if (phase == "loading" || phase == "drawing") {
                splash = view
                removeSplash = { view.remove() }
                cover.visibility = View.INVISIBLE
            } else view.remove()
        }
        cover.postDelayed(timeout, 30_000)
        pageUpdates.started(page.entry)
    }

    private fun dp(value: Int) = (value * activity.resources.displayMetrics.density).toInt()

    fun loading() {
        if (phase == "closed") return
        pageUpdates.started(page.entry)
        generation++
        if (phase == "revealing") {
            splash?.animate()?.cancel()
            removeSplash?.invoke()
            splash = null
            removeSplash = null
        }
        phase = "loading"
        webView.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
        cover.animate().cancel()
        cover.alpha = 1f
        cover.visibility = if (splash == null) View.VISIBLE else View.INVISIBLE
        logo.visibility = View.VISIBLE
        error.visibility = View.GONE
        if (cover.parent == null) content.addView(cover)
        cover.removeCallbacks(timeout)
        cover.postDelayed(timeout, 30_000)
    }

    private fun ready() {
        if (phase != "loading") return
        phase = "drawing"
        val current = generation
        // onPageFinished并不表示React已绘制；屏障确认移除网页占位后的下一帧能显示。
        webView.postVisualStateCallback(current, object : WebView.VisualStateCallback() {
            override fun onComplete(requestId: Long) {
                if (phase != "drawing" || generation != requestId) return
                phase = "revealing"
                cover.removeCallbacks(timeout)
                val target: View = splash ?: cover
                if (splash != null) content.removeView(cover)
                val finish = Runnable {
                    if (phase != "revealing" || generation != current) return@Runnable
                    removeSplash?.invoke()
                    splash = null
                    removeSplash = null
                    content.removeView(cover)
                    webView.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_AUTO
                    phase = "ready"
                    pageUpdates.ready(page.entry)
                }
                if (!ValueAnimator.areAnimatorsEnabled()) finish.run()
                else target.animate().alpha(0f).setDuration(220)
                    .setInterpolator(PathInterpolator(.2f, 0f, 0f, 1f)).withEndAction(finish).start()
            }
        })
    }

    fun fail() {
        if (phase != "loading" && phase != "drawing") return
        phase = "failed"
        pageUpdates.failed()
        cover.removeCallbacks(timeout)
        cover.visibility = View.VISIBLE
        logo.visibility = View.GONE
        error.visibility = View.VISIBLE
        removeSplash?.invoke()
        splash = null
        removeSplash = null
    }

    fun rendererFailed() {
        if (phase == "closed") return
        phase = "loading"
        if (cover.parent == null) content.addView(cover)
        cover.alpha = 1f
        rendererGone = true
        (error.getChildAt(1) as? Button)?.isEnabled = reopen != null
        fail()
    }

    private var rendererGone = false

    fun close() {
        phase = "closed"
        cover.removeCallbacks(timeout)
        cover.animate().cancel()
        splash?.animate()?.cancel()
        removeSplash?.invoke()
        splash = null
        removeSplash = null
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) runCatching { WebViewCompat.removeWebMessageListener(webView, "DSHMStartup") }
        content.removeView(cover)
        webView.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_AUTO
    }

}
