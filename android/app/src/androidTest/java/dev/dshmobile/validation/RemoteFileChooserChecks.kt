package dev.dshmobile.validation

import android.app.Activity
import android.content.ClipData
import android.content.Intent
import android.net.Uri
import android.webkit.WebChromeClient

internal object RemoteFileChooserChecks {
    fun run() {
        val activity = object : Activity() { override fun getPackageName() = "dev.dshmobile.validation" }
        var mode = WebChromeClient.FileChooserParams.MODE_OPEN
        val params = object : WebChromeClient.FileChooserParams() {
            override fun getMode() = mode
            override fun getAcceptTypes() = arrayOf("image/*")
            override fun isCaptureEnabled() = false
            override fun getTitle(): CharSequence? = null
            override fun getFilenameHint(): String? = null
            override fun createIntent() = Intent(Intent.ACTION_OPEN_DOCUMENT)
        }
        var generation: Int? = 1
        var notices = 0
        var launches = 0
        val events = mutableListOf<Pair<String, Int?>>()
        val chooser = RemoteFileChooser(activity, { generation }, { intent, request ->
            check(intent.type == "image/*" && request == RemoteFileChooser.REQUEST)
            launches++
        }, { notices++ }) { event, count -> events.add(event to count) }
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

        mode = WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE
        val other = Uri.parse("content://external.provider/other.png")
        fun clip(vararg uris: Uri) = Intent().apply {
            clipData = ClipData.newRawUri("images", uris.first()).apply {
                uris.drop(1).forEach { addItem(ClipData.Item(it)) }
            }
        }
        open()
        finish(Activity.RESULT_OK, clip(uri))
        check(results.size == 8 && results.last() == listOf(uri) && notices == 3)

        open()
        finish(Activity.RESULT_OK, clip(uri, other))
        check(results.size == 9 && results.last() == listOf(uri, other) && notices == 3)
        check(events.takeLast(3) == listOf("picker_open" to null, "picker_clipdata" to 2, "picker_returned" to 2))

        open()
        finish(Activity.RESULT_OK, clip(uri, other).setData(uri))
        check(results.size == 10 && results.last() == listOf(uri, other) && notices == 3)

        open()
        generation = 4
        finish(Activity.RESULT_OK, clip(uri, other))
        check(results.size == 11 && results.last() == null && notices == 4)
        check(events.last() == ("picker_expired" to 2))

        open()
        finish(Activity.RESULT_CANCELED, clip(uri))
        check(results.size == 12 && results.last() == null && notices == 4)
        check(events.last() == ("picker_canceled" to null))

        open()
        finish(Activity.RESULT_OK, clip(uri, Uri.parse("file:///unsafe.png")).setData(uri))
        check(results.size == 13 && results.last() == null && notices == 4)

        open()
        finish(Activity.RESULT_OK, clip(*Array(11) { Uri.parse("content://external.provider/$it.png") }))
        check(results.size == 14 && results.last() == null && notices == 4)
    }
}
