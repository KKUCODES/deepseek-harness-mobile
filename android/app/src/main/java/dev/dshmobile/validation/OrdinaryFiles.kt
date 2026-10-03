package dev.dshmobile.validation

import android.app.Activity
import android.content.Intent
import android.graphics.BitmapFactory
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Base64
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.util.UUID
import java.util.concurrent.Executors

/** 只读取系统选择器返回的单个文件；网页不能提交路径、URI 或申请目录权限。 */
class OrdinaryFiles(private val activity: Activity) {
    private data class Selection(val kind: String, val content: String?, val reply: (JSONObject?, String?) -> Unit)
    private var pending: Selection? = null
    private var closed = false
    private val worker = Executors.newSingleThreadExecutor()

    fun pick(kind: String, content: String? = null, reply: (JSONObject?, String?) -> Unit) {
        if (pending != null) { reply(null, "picker_busy"); return }
        if (kind !in setOf("photo", "file", "backup", "export")) { reply(null, "invalid_request"); return }
        if (kind == "export" && (content == null || content.toByteArray().size > BACKUP_LIMIT)) {
            reply(null, "backup_too_large"); return
        }
        val intent = Intent(if (kind == "export") Intent.ACTION_CREATE_DOCUMENT else Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = when (kind) { "photo" -> "image/*"; "export" -> "application/json"; else -> "*/*" }
            if (kind == "export") putExtra(Intent.EXTRA_TITLE, "DSHM-chats-${System.currentTimeMillis()}.json")
            if (kind == "file") putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("image/*", "text/*", "application/json"))
        }
        pending = Selection(kind, content, reply)
        try { activity.startActivityForResult(intent, PICK_REQUEST) }
        catch (_: Exception) { pending = null; reply(null, "picker_unavailable") }
    }

    fun onResult(requestCode: Int, resultCode: Int, data: Intent?): Boolean {
        if (requestCode != PICK_REQUEST) return false
        val selection = pending ?: return true
        val uri = data?.data
        if (resultCode != Activity.RESULT_OK || uri == null) {
            pending = null; selection.reply(null, "picker_canceled"); return true
        }
        worker.execute {
            var result: JSONObject? = null
            var error: String? = null
            try {
                if (uri.scheme != "content") throw FileFailure("unsupported_file")
                result = if (selection.kind == "export") {
                    activity.contentResolver.openOutputStream(uri, "w")?.use { it.write(selection.content!!.toByteArray(Charsets.UTF_8)) }
                        ?: throw FileFailure("file_write_failed")
                    JSONObject().put("saved", true)
                } else read(uri, selection.kind)
            } catch (failure: Exception) { error = if (failure is FileFailure) failure.code else "file_operation_failed" }
            activity.runOnUiThread {
                if (pending === selection) pending = null
                if (!closed) selection.reply(result, error)
            }
        }
        return true
    }

    private fun read(uri: Uri, kind: String): JSONObject {
        val resolver = activity.contentResolver
        val limit = if (kind == "backup") BACKUP_LIMIT else IMAGE_LIMIT
        val bytes = resolver.openInputStream(uri)?.use { input ->
            val output = ByteArrayOutputStream()
            val buffer = ByteArray(8192)
            while (true) {
                val size = input.read(buffer)
                if (size < 0) break
                if (output.size() + size > limit) throw FileFailure("file_too_large")
                output.write(buffer, 0, size)
            }
            output.toByteArray()
        } ?: throw FileFailure("file_read_failed")
        if (kind == "backup") return JSONObject().put("content", utf8(bytes))
        var name = "附件"
        resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) name = cursor.getString(0).orEmpty().take(200)
        }
        val result = JSONObject().put("id", UUID.randomUUID().toString()).put("name", name.ifEmpty { "附件" })
            .put("size", bytes.size).put("source", if (kind == "photo") "photo" else "file")
        val image = imageType(bytes)
        if (image != null) {
            validateImage(bytes)
            return result.put("kind", "image").put("mime", image)
                .put("data", "data:$image;base64," + Base64.encodeToString(bytes, Base64.NO_WRAP))
        }
        if (kind == "photo") throw FileFailure("unsupported_file")
        val mime = resolver.getType(uri).orEmpty()
        if (!mime.startsWith("text/") && mime != "application/json" &&
            name.substringAfterLast('.', "").lowercase() !in setOf("txt", "md", "csv", "json", "log")) throw FileFailure("unsupported_file")
        val text = utf8(bytes)
        if (text.length > 100_000 || text.contains('\u0000')) throw FileFailure("file_too_large")
        return result.put("kind", "text").put("mime", "text/plain").put("text", text)
    }

    private fun utf8(bytes: ByteArray): String = try {
        Charsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
            .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString()
    } catch (_: Exception) { throw FileFailure("unsupported_encoding") }

    fun close() { closed = true; pending = null; worker.shutdown() }
    private class FileFailure(val code: String) : Exception()

    companion object {
        const val PICK_REQUEST = 4102
        const val IMAGE_LIMIT = 4 * 1024 * 1024
        const val BACKUP_LIMIT = 32 * 1024 * 1024
        fun imageType(bytes: ByteArray): String? {
            fun starts(vararg values: Int) = bytes.size >= values.size && values.indices.all { bytes[it].toInt() and 255 == values[it] }
            return when {
                starts(0xff, 0xd8, 0xff) -> "image/jpeg"
                starts(137, 80, 78, 71, 13, 10, 26, 10) -> "image/png"
                bytes.size >= 6 && String(bytes, 0, 6, Charsets.US_ASCII) in setOf("GIF87a", "GIF89a") -> "image/gif"
                bytes.size >= 12 && String(bytes, 0, 4, Charsets.US_ASCII) == "RIFF" && String(bytes, 8, 4, Charsets.US_ASCII) == "WEBP" -> "image/webp"
                else -> null
            }
        }
        fun validateImage(bytes: ByteArray) {
            if (bytes.size > IMAGE_LIMIT || imageType(bytes) == null) throw IllegalArgumentException("unsupported_image")
            val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options)
            if (options.outWidth !in 1..8192 || options.outHeight !in 1..8192) throw IllegalArgumentException("image_dimensions")
        }
    }
}
