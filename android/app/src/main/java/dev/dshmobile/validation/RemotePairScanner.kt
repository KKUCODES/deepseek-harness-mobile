package dev.dshmobile.validation

import android.app.Activity
import android.content.Intent
import android.os.Handler
import android.os.Looper
import com.google.zxing.client.android.Intents
import com.journeyapps.barcodescanner.ScanOptions
import org.json.JSONObject
import java.io.InputStream
import java.util.concurrent.Executors
import java.util.concurrent.Future

/** 扫描只交还规范链接，不联网/领取；回调必须属于当前页面和未绑定身份。 */
internal class RemotePairScanner(private val activity: Activity, private val allowed: () -> Boolean) {
    private class Scan(val code: Int, val source: String, val reply: (JSONObject?, String?) -> Unit) {
        var job: Future<*>? = null
        @Volatile var input: InputStream? = null
    }
    private var pending: Scan? = null
    private var nextCode = 4200
    private var closed = false
    private val worker = Executors.newSingleThreadExecutor()
    private val handler = Handler(Looper.getMainLooper())
    private val timeout = Runnable { cancel("scan_timeout") }

    fun open(source: String, reply: (JSONObject?, String?) -> Unit) {
        if (closed || !allowed()) { reply(null, "scan_unavailable"); return }
        if (pending != null) { reply(null, "scan_busy"); return }
        if (source !in setOf("camera", "image") || nextCode >= 65535) { reply(null, "invalid_request"); return }
        val scan = Scan(nextCode++, source, reply)
        pending = scan
        try {
            val intent = if (source == "camera") ScanOptions()
                .setDesiredBarcodeFormats(ScanOptions.QR_CODE).setBeepEnabled(false).setBarcodeImageEnabled(false)
                .setPrompt((activity.application as DshmApplication).appearance.localizedResources(activity)
                    .getString(R.string.remote_pair_scan_prompt)).setTimeout(120_000)
                .addExtra(Intents.Scan.SHOW_MISSING_CAMERA_PERMISSION_DIALOG, false).createScanIntent(activity)
            else Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE); type = "image/*"
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            activity.startActivityForResult(intent, scan.code)
            handler.postDelayed(timeout, 120_000)
        } catch (_: Exception) { finish(scan, null, "scan_unavailable") }
    }

    fun onResult(requestCode: Int, resultCode: Int, data: Intent?): Boolean {
        if (requestCode !in 4200 until nextCode) return false
        val scan = pending?.takeIf { it.code == requestCode } ?: return true
        if (!allowed()) { finish(scan, null, "scan_unavailable"); return true }
        if (scan.source == "camera") {
            val failure = when {
                data?.getBooleanExtra(Intents.Scan.MISSING_CAMERA_PERMISSION, false) == true -> "scan_camera_permission"
                data?.getBooleanExtra(Intents.Scan.TIMEOUT, false) == true -> "scan_timeout"
                else -> null
            }
            if (failure != null) finish(scan, null, failure)
            else if (resultCode != Activity.RESULT_OK) finish(scan, null)
            else {
                val raw = data?.getStringExtra(Intents.Scan.RESULT)
                data?.removeExtra(Intents.Scan.RESULT)
                val link = raw?.let { RemotePairLink.parse(it)?.canonical }
                finish(scan, link, if (link == null) "invalid_pair_link" else null)
            }
            return true
        }
        if (resultCode != Activity.RESULT_OK) { finish(scan, null); return true }
        val uri = data?.data
        if (uri?.scheme != "content" || uri.authority.orEmpty().startsWith(activity.packageName)) {
            finish(scan, null, "scan_image_invalid"); return true
        }
        scan.job = worker.submit {
            var link: String? = null; var failure: String? = null
            try {
                activity.contentResolver.openInputStream(uri)?.use { input ->
                    scan.input = input
                    if (Thread.currentThread().isInterrupted) throw RemotePairQr.Failure("scan_cancelled")
                    link = RemotePairQr.decode(input)
                } ?: throw RemotePairQr.Failure("scan_image_invalid")
            } catch (error: Exception) { failure = (error as? RemotePairQr.Failure)?.code ?: "scan_image_invalid" }
            finally { scan.input = null }
            activity.runOnUiThread { finish(scan, link, failure) }
        }
        return true
    }

    private fun finish(scan: Scan, link: String?, failure: String? = null) {
        if (pending !== scan) return
        pending = null; handler.removeCallbacks(timeout)
        if (closed) return
        if (!allowed()) scan.reply(null, "scan_unavailable")
        else if (failure != null) scan.reply(null, failure)
        else scan.reply(JSONObject().apply { if (link != null) put("link", link) else put("cancelled", true) }, null)
    }

    fun cancel(failure: String = "scan_cancelled") {
        val scan = pending ?: return
        scan.job?.cancel(true)
        runCatching { scan.input?.close() }
        finish(scan, null, failure)
        runCatching { activity.finishActivity(scan.code) }
    }
    fun close() { cancel(); closed = true; worker.shutdownNow() }
}
