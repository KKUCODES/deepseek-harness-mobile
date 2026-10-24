package dev.dshmobile.validation

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent

internal object ExternalLinkChecks {
    fun run() {
        for (url in listOf("http://example.com/a", "https://example.com/a%20b?q=中文#part", "https://例子.测试/path"))
            check(ExternalLinks.uri(url).toString() == url)
        for (value in listOf(null, 42, "", "https://", "https:example.com", "file:///data/a", "content://private/a", "intent://example", "javascript:alert(1)", "data:text/html,test", "mailto:a@example.com",
            "https://user:pass@example.com", "https://@example.com", "https://example.com:99999", "https://example.com\\@evil.example", " https://example.com", "https://example.com/\npath", "https://[broken", "https://example.com/" + "x".repeat(8192))) {
            val failure = runCatching { ExternalLinks.uri(value) }.exceptionOrNull()
            check(failure is ExternalLinks.Failure && failure.code == "invalid_link") { "Expected invalid_link for a rejected URL" }
        }
        val activity = object : Activity() {
            var received: Intent? = null
            var failure: Exception? = null
            override fun startActivity(intent: Intent) { failure?.let { throw it }; received = intent }
        }
        ExternalLinks.open(activity, "https://example.com/path")
        val intent = checkNotNull(activity.received)
        check(intent.action == Intent.ACTION_VIEW && intent.dataString == "https://example.com/path")
        check(intent.hasCategory(Intent.CATEGORY_BROWSABLE) && intent.component == null && intent.selector == null && intent.extras == null && intent.flags == 0)
        for ((exception, code) in listOf(ActivityNotFoundException() to "browser_unavailable", SecurityException() to "link_open_failed")) {
            activity.failure = exception
            check((runCatching { ExternalLinks.open(activity, "https://example.com/path") }.exceptionOrNull() as? ExternalLinks.Failure)?.code == code)
        }
    }
}
