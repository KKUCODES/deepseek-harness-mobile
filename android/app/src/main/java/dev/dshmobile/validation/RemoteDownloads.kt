package dev.dshmobile.validation

import android.app.Activity
import android.content.Intent
import android.provider.DocumentsContract
import org.json.JSONObject
import java.io.File
import java.util.concurrent.Executors

/** 仅在字节完整校验后打开系统保存窗口；不接受网页提交的 URI。 */
class RemoteDownloads(private val activity: Activity, private val generation: () -> Int?) {
    private val store = RemoteDownloadStore(File(activity.cacheDir, "remote-downloads"), generation = generation)
    private val shares = RemoteShareFiles(activity.applicationContext)
    private val journal = (activity.application as DshmApplication).saveJournal
    private val worker = Executors.newSingleThreadExecutor()
    private class Save(val entry: RemoteDownloadStore.Entry, private var reply: ((JSONObject?, String?) -> Unit)?) {
        var canceled = false
        fun respond(value: JSONObject?, failure: String?) {
            val callback = reply ?: return
            reply = null
            callback(value, failure)
        }
    }
    private var save: Save? = null
    private var pickerOutstanding = false
    private var closed = false
    private var pendingOperations = 0

    fun dispatch(op: String, data: JSONObject, reply: (JSONObject?, String?) -> Unit) {
        if (closed) { reply(null, "download_expired"); return }
        if (op == "file.abort") {
            val id = data.optString("downloadId")
            store.abort(id)
            if (save?.entry?.id == id) cancelPicker()
            reply(JSONObject(), null); return
        }
        if (op == "file.save") {
            if (pickerOutstanding) { reply(null, "picker_busy"); return }
            try {
                val entry = store.entry(data.getString("downloadId"))
                if (!entry.complete) throw RemoteDownloadStore.Failure("download_incomplete")
                save = Save(entry, reply); pickerOutstanding = true
                activity.startActivityForResult(Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE); type = "application/octet-stream"
                    putExtra(Intent.EXTRA_TITLE, entry.name)
                }, SAVE_REQUEST)
            } catch (error: Exception) { save = null; pickerOutstanding = false; reply(null, code(error)) }
            return
        }
        if (pendingOperations >= 4) { reply(null, "download_busy"); return }
        pendingOperations++
        val owner = generation()
        worker.execute {
            var value: JSONObject? = null; var failure: String? = null
            var sharing: RemoteShareFiles.Snapshot? = null
            try {
                if (owner == null || generation() != owner) throw RemoteDownloadStore.Failure("download_expired")
                value = when (op) {
                    "file.begin" -> JSONObject().put("downloadId", store.begin(data.getString("name"), owner).id)
                    "file.chunk" -> JSONObject().put("bytes", store.append(data.getString("downloadId"), data.getLong("offset"), data.getString("data")))
                    "file.finish" -> { store.finish(data.getString("downloadId"), data.getLong("bytes")); JSONObject() }
                    "file.share" -> {
                        val entry = store.entry(data.getString("downloadId"))
                        sharing = shares.prepare(entry) { !entry.canceled && generation() == entry.owner }
                        JSONObject()
                    }
                    else -> throw RemoteDownloadStore.Failure("unsupported_operation")
                }
            } catch (error: Exception) { failure = code(error) }
            activity.runOnUiThread {
                pendingOperations--
                if (sharing != null) {
                    val snapshot = sharing
                    try {
                        if (closed || generation() != owner) throw RemoteDownloadStore.Failure("download_expired")
                        store.entry(data.getString("downloadId"))
                        val title = (activity.application as DshmApplication).appearance.localizedResources(activity)
                            .getString(R.string.remote_share_title)
                        activity.startActivity(Intent.createChooser(shares.intent(snapshot), title))
                        shares.handedOff(snapshot)
                        reply(JSONObject().put("opened", true), null)
                    } catch (error: Exception) { shares.remove(snapshot); if (!closed) reply(null, code(error)) }
                    return@runOnUiThread
                }
                if (generation() != owner) {
                    value?.optString("downloadId")?.takeIf { it.isNotEmpty() }?.let { store.abort(it) }
                    if (!closed) reply(null, "download_expired")
                } else if (!closed) reply(value, failure)
            }
        }
    }

    fun onResult(requestCode: Int, resultCode: Int, data: Intent?): Boolean {
        if (requestCode != SAVE_REQUEST) return false
        pickerOutstanding = false
        val pending = save ?: return true
        save = null
        val uri = data?.data
        if (pending.canceled || closed) {
            // 取消可能晚于系统创建文档；保留待办到回调，才能清理迟到的新文档。
            if (resultCode == Activity.RESULT_OK && uri?.scheme == "content") {
                // Activity 关闭后下载 worker 已停止，清理不能再提交到它。
                Thread({ runCatching { DocumentsContract.deleteDocument(activity.contentResolver, uri) } }, "dshm-canceled-save").start()
            }
            store.abort(pending.entry.id)
            return true
        }
        if (resultCode != Activity.RESULT_OK || uri == null) {
            store.abort(pending.entry.id); pending.respond(null, "download_canceled"); return true
        }
        worker.execute {
            var failure: String? = null
            var marker: File? = null
            try {
                if (uri.scheme != "content") throw RemoteDownloadStore.Failure("download_destination_invalid")
                val entry = store.entry(pending.entry.id)
                marker = journal.begin()
                activity.contentResolver.openOutputStream(uri, "w")?.use { output ->
                    entry.file.inputStream().use { input ->
                        val buffer = ByteArray(65536)
                        while (true) {
                            if (entry.canceled || generation() != entry.owner) throw RemoteDownloadStore.Failure("download_expired")
                            val size = input.read(buffer); if (size < 0) break
                            output.write(buffer, 0, size)
                        }
                    }
                    output.flush()
                } ?: throw RemoteDownloadStore.Failure("download_write_failed")
                if (entry.canceled || generation() != entry.owner) throw RemoteDownloadStore.Failure("download_expired")
            } catch (error: Exception) {
                failure = code(error)
                // ACTION_CREATE_DOCUMENT 创建的新文档若写入失败，尽力移除半成品。
                if (uri.scheme == "content" && !runCatching {
                    DocumentsContract.deleteDocument(activity.contentResolver, uri)
                }.getOrDefault(false)) failure = "download_cleanup_failed"
            } finally {
                store.abort(pending.entry.id)
                marker?.let(journal::settled)
            }
            activity.runOnUiThread { if (!closed) pending.respond(if (failure == null) JSONObject().put("saved", true) else null, failure) }
        }
        return true
    }
    private fun cancelPicker() {
        val pending = save ?: return
        if (pending.canceled) return
        pending.canceled = true
        pending.respond(null, "download_canceled")
        // 等系统回调再释放 pickerOutstanding，避免旧窗口结果落到新的保存操作。
        if (pickerOutstanding) runCatching { activity.finishActivity(SAVE_REQUEST) }
    }
    fun cancel() { store.abort(); cancelPicker() }
    fun close() { closed = true; cancel(); worker.shutdown() }
    private fun code(error: Exception) = if (error is RemoteDownloadStore.Failure) error.code else "download_failed"
    companion object { const val SAVE_REQUEST = 4104 }
}
