package dev.dshmobile.validation

import android.util.Base64
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

/** 下载只写本 App 的暂存目录。网页不能指定本机路径；一代连接最多暂存一个文件。 */
class RemoteDownloadStore(private val directory: File, private val limit: Long = LIMIT, private val generation: () -> Int?) {
    class Failure(val code: String) : Exception()
    class Entry(val id: String, val name: String, val owner: Int, val file: File, val output: FileOutputStream) {
        var bytes = 0L
        var complete = false
        @Volatile var canceled = false
    }
    private var current: Entry? = null
    init {
        directory.mkdirs()
        // 清理上次进程被结束留下的私有暂存，不触碰用户保存的文件。
        directory.listFiles()?.filter { it.isFile && it.name.startsWith("remote-") && it.name.endsWith(".part") }?.forEach { it.delete() }
    }
    @Synchronized fun begin(name: String, expectedOwner: Int? = generation()): Entry {
        if (current != null) throw Failure("download_busy")
        val owner = generation() ?: throw Failure("remote_not_connected")
        if (owner != expectedOwner) throw Failure("download_expired")
        if (name.isBlank() || name.length > 180 || name in setOf(".", "..") || name.any { it == '/' || it == '\\' || it.code < 32 }) throw Failure("download_name_invalid")
        val file = File.createTempFile("remote-", ".part", directory)
        val output = try { FileOutputStream(file) } catch (error: Exception) { file.delete(); throw error }
        return Entry(UUID.randomUUID().toString(), name, owner, file, output).also { current = it }
    }
    @Synchronized fun entry(id: String): Entry {
        val entry = current ?: throw Failure("download_expired")
        if (entry.id != id || entry.canceled || generation() != entry.owner) throw Failure("download_expired")
        return entry
    }
    @Synchronized fun append(id: String, offset: Long, encoded: String): Long {
        val entry = entry(id)
        if (entry.complete || offset != entry.bytes || encoded.length > 87384 || !BASE64.matches(encoded)) throw Failure("download_chunk_invalid")
        val bytes = Base64.decode(encoded, Base64.NO_WRAP)
        if (bytes.isEmpty() || bytes.size > 65536) throw Failure("download_chunk_invalid")
        if (entry.bytes + bytes.size > limit) throw Failure("download_too_large")
        entry.output.write(bytes)
        entry.bytes += bytes.size
        return entry.bytes
    }
    @Synchronized fun finish(id: String, bytes: Long) {
        val entry = entry(id)
        if (entry.complete || bytes != entry.bytes) throw Failure("download_incomplete")
        entry.output.flush(); entry.output.fd.sync(); entry.output.close()
        entry.complete = true
    }
    @Synchronized fun abort(id: String? = null) {
        val entry = current ?: return
        if (id != null && entry.id != id) return
        entry.canceled = true
        runCatching { entry.output.close() }
        entry.file.delete()
        current = null
    }
    companion object {
        const val LIMIT = 256L * 1024 * 1024
        private val BASE64 = Regex("(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?")
    }
}
