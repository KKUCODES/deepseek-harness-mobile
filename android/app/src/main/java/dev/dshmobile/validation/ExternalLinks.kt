package dev.dshmobile.validation

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull

/** 仅交给系统处理普通网页；不携带凭据、文件权限或回到DSHM的Intent目标。 */
internal object ExternalLinks {
    class Failure(val code: String) : Exception(code)

    fun uri(value: Any?): Uri {
        if (value !is String || value.length !in 1..8192 || value.any { it <= ' ' || it == '\\' || it == '\u007f' }) throw Failure("invalid_link")
        val uri = Uri.parse(value)
        val http = value.toHttpUrlOrNull()
        if (uri.scheme !in setOf("http", "https") || uri.host.isNullOrEmpty() || uri.userInfo != null || http == null) throw Failure("invalid_link")
        return uri
    }

    fun open(activity: Activity, value: Any?) {
        val intent = Intent(Intent.ACTION_VIEW, uri(value)).addCategory(Intent.CATEGORY_BROWSABLE)
        try { activity.startActivity(intent) }
        catch (_: ActivityNotFoundException) { throw Failure("browser_unavailable") }
        catch (_: SecurityException) { throw Failure("link_open_failed") }
    }
}
