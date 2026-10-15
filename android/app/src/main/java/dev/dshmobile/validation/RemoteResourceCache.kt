package dev.dshmobile.validation

import java.io.File
import java.io.DataInputStream
import java.io.DataOutputStream
import java.security.MessageDigest
import java.util.UUID

/** 私有临时资源缓存。每次命中仍由已认证连接 HEAD 确认内容，不提供离线执行回退。 */
internal class RemoteResourceCache(private val root: File) {
    data class Entry(val etag: String, val bytes: ByteArray)
    fun read(scope: String, path: String): Entry? = synchronized(lock) {
        val file = File(root, key(scope, path))
        try {
            if (!file.isFile || file.length() > MAX_ENTRY + 1024) return@synchronized null
            val entry = DataInputStream(file.inputStream().buffered()).use { input ->
                require(input.readInt() == 1)
                val etag = input.readUTF()
                val length = input.readInt(); require(length in 0..MAX_ENTRY)
                val bytes = ByteArray(length); input.readFully(bytes); require(input.read() == -1)
                require(etag == "\"sha256-${hash(bytes)}\"")
                Entry(etag, bytes)
            }
            file.setLastModified(System.currentTimeMillis()); entry
        } catch (_: Exception) { file.delete(); null }
    }
    fun stamp(): Long = synchronized(lock) { epoch }
    fun write(scope: String, path: String, entry: Entry, stamp: Long) = synchronized(lock) {
        if (stamp != epoch || entry.bytes.size > MAX_ENTRY || entry.etag != "\"sha256-${hash(entry.bytes)}\"") return@synchronized
        var temporary: File? = null
        try {
            root.mkdirs()
            temporary = File(root, "${UUID.randomUUID()}.tmp")
            DataOutputStream(temporary.outputStream().buffered()).use { output ->
                output.writeInt(1); output.writeUTF(entry.etag); output.writeInt(entry.bytes.size); output.write(entry.bytes)
            }
            val target = File(root, key(scope, path))
            if (!temporary.renameTo(target)) return@synchronized
            val files = root.listFiles()?.filter { it.isFile }?.sortedByDescending { it.lastModified() }.orEmpty()
            var bytes = 0L
            for ((index, file) in files.withIndex()) {
                bytes += file.length()
                if (index >= 256 || bytes > 64L * 1024 * 1024) file.delete()
            }
        } catch (_: Exception) { /* 磁盘不足时继续使用已下载的内容。 */ }
        finally { temporary?.delete() }
    }
    fun remove(scope: String, path: String) = synchronized(lock) { File(root, key(scope, path)).delete() }
    companion object {
        const val MAX_ENTRY = 16 * 1024 * 1024
        private val lock = Any()
        private var epoch = 0L
        private fun hash(bytes: ByteArray) = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
        private fun key(scope: String, path: String) = hash("$scope\u0000$path".toByteArray(Charsets.UTF_8)) + ".cache"
        fun clear(root: File) = synchronized(lock) { epoch++; root.deleteRecursively(); Unit }
    }
}
