package dev.dshmobile.validation

import android.os.Build
import android.webkit.WebView
import org.json.JSONObject

/** 两个来源只共享公开运行版本，不读取身份、设置、日志或凭据存储。 */
internal object AppInfo {
    fun read(): JSONObject = JSONObject()
        .put("appVersion", BuildConfig.VERSION_NAME)
        .put("appVersionCode", BuildConfig.VERSION_CODE)
        .put("androidApi", Build.VERSION.SDK_INT)
        .put("webViewVersion", WebView.getCurrentWebViewPackage()?.versionName ?: JSONObject.NULL)
}
