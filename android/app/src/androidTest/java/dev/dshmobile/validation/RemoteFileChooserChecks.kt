package dev.dshmobile.validation

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.webkit.WebChromeClient

internal object RemoteFileChooserChecks {
    fun run() {
        val activity = object : Activity() { override fun getPackageName() = "dev.dshmobile.validation" }
        val params = object : WebChromeClient.FileChooserParams() {
            override fun getMode() = MODE_OPEN
            override fun getAcceptTypes() = arrayOf("image/*")
            override fun isCaptureEnabled() = false
            override fun getTitle(): CharSequence? = null
            override fun getFilenameHint(): String? = null
            override fun createIntent() = Intent(Intent.ACTION_OPEN_DOCUMENT)
        }
        var generation: Int? = 1
        var notices = 0
        var launches = 0
        val chooser = RemoteFileChooser(activity, { generation }, { intent, request ->
            check(intent.type == "image/*" && request == RemoteFileChooser.REQUEST)
            launches++
        }, { notices++ })
        val uri = Uri.parse("content://external.provider/image.png")
        val selected = Intent().setData(uri)
        val results = mutableListOf<List<Uri>?>()
        fun open() { check(chooser.open({ results.add(it?.toList()) }, params)) }
        fun finish(result: Int, data: Intent?) { check(chooser.onResult(RemoteFileChooser.REQUEST, result, data)) }

        open()
        finish(Activity.RESULT_OK, selected)
        check(results == listOf(listOf(uri)) && notices == 0)

        open()
        generation = 2
        finish(Activity.RESULT_OK, selected)
        check(results.size == 2 && results.last() == null && notices == 1)

        open()
        generation = null
        finish(Activity.RESULT_CANCELED, null)
        check(results.size == 3 && results.last() == null && notices == 1)

        generation = 3
        open()
        chooser.cancel()
        open()
        finish(Activity.RESULT_OK, selected)
        check(launches == 4 && results.size == 5 && results.takeLast(2).all { it == null } && notices == 2)

        open()
        chooser.cancel()
        finish(Activity.RESULT_CANCELED, null)
        check(results.size == 6 && results.last() == null && notices == 2)

        open()
        finish(Activity.RESULT_OK, selected)
        check(results.size == 7 && results.last() == listOf(uri) && notices == 2)

        finish(Activity.RESULT_CANCELED, null)
        check(results.size == 7 && notices == 2)
        finish(Activity.RESULT_OK, selected)
        check(results.size == 7 && notices == 3)
    }
}
