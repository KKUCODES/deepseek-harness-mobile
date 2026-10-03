package dev.dshmobile.validation

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.content.res.Configuration
import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewAssetLoader
import java.io.ByteArrayInputStream

/** 普通聊天独立容器；保留应用 ID 与来源，升级时继续使用原有 Key 和历史。 */
class ValidationActivity : Activity() {
    private var stopWindowAppearance: (() -> Unit)? = null
    companion object { const val OPEN_APPEARANCE = "dshm.private.openAppearance" }
    private lateinit var webView: WebView
    private lateinit var ordinary: OrdinaryBridge
    private var pendingAppearance = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        pendingAppearance = intent.getBooleanExtra(OPEN_APPEARANCE, false)
        intent.removeExtra(OPEN_APPEARANCE)
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        val assets = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            // 网页仍只能加载本地资源；模型联网由原生受限请求桥负责。
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView, url: String?) { deliverAppearanceNavigation() }
                override fun onPageStarted(view: WebView, url: String?, favicon: android.graphics.Bitmap?) {
                    if (::ordinary.isInitialized) ordinary.pageLeaving()
                }
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    val uri = request.url
                    return uri.scheme != "https" || uri.host != "appassets.androidplatform.net" ||
                        !uri.path.orEmpty().startsWith("/assets/web/")
                }

                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse {
                    return assets.shouldInterceptRequest(request.url)
                        ?: WebResourceResponse("text/plain", "UTF-8", 403, "Unavailable in validation",
                            emptyMap(), ByteArrayInputStream(ByteArray(0)))
                }
            }
            setOnApplyWindowInsetsListener { view, insets ->
                view.setPadding(insets.systemWindowInsetLeft, insets.systemWindowInsetTop,
                    insets.systemWindowInsetRight, insets.systemWindowInsetBottom)
                insets
            }
        }
        ordinary = OrdinaryBridge(this, webView)
        ordinary.install()
        if (!MobileWebWindow.install(this, webView)) setContentView(webView)
        stopWindowAppearance = MobileWebWindow.observeAppearance(this)
        val entry = if (BuildConfig.DEBUG && intent.getBooleanExtra("diagnostics", false)) "index.html" else "mobile.html"
        webView.loadUrl("https://appassets.androidplatform.net/assets/web/$entry")
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        // 先更新宿主主题，让WebView收到正确的系统媒体查询；不重建正在编辑的页面。
        theme.applyStyle(R.style.Theme_DSHM, true)
        super.onConfigurationChanged(newConfig)
        MobileWebWindow.updateAppearance(this)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        if (intent.getBooleanExtra(OPEN_APPEARANCE, false)) pendingAppearance = true
        intent.removeExtra(OPEN_APPEARANCE)
        if (webView.progress == 100) deliverAppearanceNavigation()
    }

    private fun deliverAppearanceNavigation() {
        if (!pendingAppearance || webView.url != "https://appassets.androidplatform.net/assets/web/mobile.html") return
        pendingAppearance = false
        // 冷启动时React可能尚未挂载；保留一次性标记，由同一设置入口消费，不重载聊天。
        webView.evaluateJavascript("window.dshmOpenAppearance = true; window.dispatchEvent(new Event('dshm-open-appearance'))", null)
    }

    override fun onDestroy() {
        stopWindowAppearance?.invoke()
        ordinary.close()
        webView.destroy()
        super.onDestroy()
    }

    @Deprecated("Platform activity result bridge")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (!ordinary.onActivityResult(requestCode, resultCode, data)) super.onActivityResult(requestCode, resultCode, data)
    }

    @Deprecated("Handled by the local page navigation stack")
    override fun onBackPressed() {
        webView.evaluateJavascript("window.dshmHandleBack ? window.dshmHandleBack() : false") { handled ->
            if (handled != "true") moveTaskToBack(true)
        }
    }
}
