package dev.dshmobile.validation

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import android.os.Bundle
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewAssetLoader
import java.io.ByteArrayInputStream

/** 原生导航进入 Remote；普通聊天的 WebView 与凭据桥不会进入此页面。 */
class RemoteActivity : Activity() {
    companion object { const val PAIR_HANDOFF = "dshm.private.pairHandoff" }
    private lateinit var webView: WebView
    private lateinit var bridge: RemoteBridge
    private lateinit var updates: AppUpdateBridge
    private lateinit var mobilePlugins: MobilePluginBridge
    private lateinit var files: RemoteFileChooser
    private var stopWindowAppearance: (() -> Unit)? = null
    private var startup: StartupScreen? = null
    private val rendererRecovery by lazy { RendererRecovery(this) }
    private var rendererGone = false
    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        val assets = WebViewAssetLoader.Builder().setDomain("remote.dshm.invalid")
            .addPathHandler("/phone-plugins/") { (application as DshmApplication).phonePluginPackages.resource("/phone-plugins/$it") }
            .addPathHandler("/assets/", (application as DshmApplication).webUpdates.pathHandler()).build()
        webView = WebView(this).apply {
            settings.javaScriptEnabled = true; settings.domStorageEnabled = true
            settings.allowFileAccess = false; settings.allowContentAccess = false
            webViewClient = object : WebViewClient() {
                override fun onRenderProcessGone(view: WebView, detail: android.webkit.RenderProcessGoneDetail): Boolean {
                    android.util.Log.w("DSHMRenderer", if (detail.didCrash()) "Remote renderer crashed" else "Remote renderer reclaimed")
                    rendererGone = true
                    if (::files.isInitialized) files.cancel()
                    if (::updates.isInitialized) updates.close()
                    if (::mobilePlugins.isInitialized) mobilePlugins.close()
                    if (::bridge.isInitialized) bridge.close()
                    startup?.rendererFailed()
                    (view.parent as? android.view.ViewGroup)?.removeView(view)
                    view.destroy()
                    rendererRecovery.rendererGone()
                    return true
                }
                override fun onPageStarted(view: WebView, url: String?, favicon: android.graphics.Bitmap?) {
                    startup?.loading()
                    if (::files.isInitialized) files.cancel()
                    if (::bridge.isInitialized) bridge.disconnect()
                }
                override fun onReceivedError(view: WebView, request: WebResourceRequest, error: android.webkit.WebResourceError) {
                    if (request.isForMainFrame) startup?.fail()
                }
                override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, response: WebResourceResponse) {
                    if (request.isForMainFrame) startup?.fail()
                }
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest) = !bridge.allowsHtmlNavigation(request)
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse =
                    bridge.htmlResource(request) ?: assets.shouldInterceptRequest(request.url) ?: bridge.resource(request) ?: WebResourceResponse("text/plain", "UTF-8", 403,
                        "Blocked", emptyMap(), ByteArrayInputStream(ByteArray(0)))
            }
            webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(view: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
                    if (view.url != RemoteBridge.ORIGIN + "/assets/web/remote.html" || bridge.hasHtmlPreview()) {
                        callback.onReceiveValue(null)
                        return true
                    }
                    return files.open(callback, params)
                }
            }
        }
        bridge = RemoteBridge(this, webView) { appearance -> ModeNavigation.ordinary(this, appearance) }; bridge.install()
        if (intent.getBooleanExtra("dshm.private.restoreReading", false)) bridge.offerReadingRecovery()
        intent.removeExtra("dshm.private.restoreReading")
        updates = AppUpdateBridge(this, webView, RemoteBridge.ORIGIN, "remote.html").also { it.install() }
        mobilePlugins = MobilePluginBridge(this, webView, RemoteBridge.ORIGIN, "remote.html").also { it.install() }
        (application as DshmApplication).notices.accept(intent)
        acceptPairLink(intent)
        files = RemoteFileChooser(this, bridge::connectionGeneration)
        if (!MobileWebWindow.install(this, webView)) setContentView(webView)
        stopWindowAppearance = MobileWebWindow.observeAppearance(this)
        startup = StartupScreen(this, webView, StartupScreen.Page.REMOTE) { rendererRecovery.reopen() }
        webView.loadUrl(RemoteBridge.ORIGIN + "/assets/web/remote.html")
    }
    override fun onConfigurationChanged(newConfig: Configuration) {
        // 系统配色变化不能销毁Remote会话、在途操作或未发送草稿。
        theme.applyStyle(R.style.Theme_DSHM, true)
        super.onConfigurationChanged(newConfig)
        MobileWebWindow.updateAppearance(this)
    }

    override fun onResume() { super.onResume(); rendererRecovery.onResume() }
    override fun onPause() { rendererRecovery.onPause(); super.onPause() }
    override fun onDestroy() {
        startup?.close(); stopWindowAppearance?.invoke()
        if (!rendererGone) { files.cancel(); updates.close(); mobilePlugins.close(); bridge.close(); webView.destroy() }
        super.onDestroy()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        acceptPairLink(intent)
        if (!rendererGone) webView.evaluateJavascript("window.dispatchEvent(new Event('dshm-pair-link'))", null)
        (application as DshmApplication).notices.accept(intent)
        if (!rendererGone) webView.evaluateJavascript("window.dispatchEvent(new Event('dshm-notification-open'))", null)
    }

    private fun acceptPairLink(incoming: Intent) {
        val raw = RemotePairHandoff.take(incoming.getStringExtra(PAIR_HANDOFF))
        incoming.removeExtra(PAIR_HANDOFF)
        if (raw != null) bridge.offerPairLink(raw)
    }

    private fun returnToOrdinary() {
        ModeNavigation.ordinary(this)
    }

    @Deprecated("Platform back bridge")
    override fun onBackPressed() {
        if (rendererGone) { returnToOrdinary(); return }
        // 自有页面先关闭预览/面板，再退回会话列表；页面未接管时才离开 Remote。
        // 连接页的窗口不属于会话组件；先沿 dialog.cancel 关闭当前可见窗口，避免退掉底层聊天。
        webView.evaluateJavascript("""(() => {
            const portal = [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')]
                .findLast(node => node.tagName !== 'DIALOG' && node.getClientRects().length);
            if (portal) {
                if ([...document.querySelectorAll('[role="menu"]')].some(node => node.getClientRects().length))
                    document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
                else portal.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
                return true;
            }
            const dialog = [...document.querySelectorAll('dialog[open]')].findLast(node => node.getClientRects().length);
            if (dialog) {
                if ([...document.querySelectorAll('[role="menu"]')].some(node => node.getClientRects().length)) {
                    document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
                    return true;
                }
                if (dialog.dispatchEvent(new Event('cancel', { cancelable: true }))) dialog.close();
                return true;
            }
            return window.dshmHandleBack ? window.dshmHandleBack() : false;
        })()""") { handled ->
            if (handled != "true" && !isFinishing && !isDestroyed) returnToOrdinary()
        }
    }

    @Deprecated("Platform activity result bridge")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (!files.onResult(requestCode, resultCode, data) && !bridge.onActivityResult(requestCode, resultCode, data)) super.onActivityResult(requestCode, resultCode, data)
    }
}
