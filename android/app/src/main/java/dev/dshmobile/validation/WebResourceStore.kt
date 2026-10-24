package dev.dshmobile.validation

import android.util.AtomicFile
import org.json.JSONObject
import java.io.File

/** 只管理noBackupFilesDir/web-updates；从不读写聊天数据库、Keystore或配对存储。 */
internal class WebResourceStore(private val root: File, private val trust: JSONObject,
    private val applicationId: String, private val apkCode: Long, private val sdk: String) {
    private val record = AtomicFile(File(root, "state.json"))
    private val packages = File(root, "packages")
    private var state = JSONObject()
    private var opened = false
    private var selected: WebResourceManifest? = null
    private var selectedDirectory: File? = null
    init { check(root.mkdirs() || root.isDirectory); check(packages.mkdirs() || packages.isDirectory) }
    private fun save() {
        val stream = record.startWrite()
        try { stream.write(state.toString().toByteArray()); record.finishWrite(stream) }
        catch (failure: Exception) { record.failWrite(stream); throw failure }
    }
    private fun packageDirectory(name: String): File {
        require(name.matches(Regex("r[1-9][0-9]*-[a-f0-9]{16}"))) { "web_storage_failed" }
        return File(packages, name)
    }
    fun parse(bytes: ByteArray) = WebResourceManifest.parse(bytes, trust, applicationId, apkCode, sdk)
    private fun read(name: String): Pair<WebResourceManifest, File>? = runCatching {
        val folder = packageDirectory(name)
        val envelope = File(folder, "manifest.json")
        require(envelope.length() in 1..WebResourceManifest.MAX_MANIFEST.toLong())
        val manifest = parse(envelope.readBytes()); require(manifest.directoryName == name)
        val content = File(folder, "content"); manifest.verifyDirectory(content)
        Pair(manifest, content)
    }.getOrNull()
    private fun superseded(name: String): Boolean = runCatching {
        val envelope = File(packageDirectory(name), "manifest.json")
        require(envelope.length() in 1..WebResourceManifest.MAX_MANIFEST.toLong())
        parse(envelope.readBytes())
    }.exceptionOrNull()?.message == "web_resource_superseded"
    /** 每个Application进程只选一次；后续Activity和资源请求都沿同一不可变世代。 */
    @Synchronized fun beginProcess() {
        check(!opened); opened = true
        state = runCatching { JSONObject(record.openRead().use { it.readBytes().toString(Charsets.UTF_8) }) }.getOrDefault(JSONObject())
        val failed = state.optBoolean("recover") || state.optJSONObject("launching")?.length()?.let { it > 0 } == true
        if (failed) rollback("web_rolled_back")
        else {
            val pending = state.optString("pending")
            if (pending.isNotEmpty()) {
                if (read(pending) != null) {
                    if (healthy()) state.put("previous", state.optString("active"))
                    state.put("active", pending).put("healthy", JSONObject()).put("pending", "").put("pendingRevision", 0)
                } else {
                    if (!superseded(pending)) state.put("notice", "web_file_invalid")
                    state.put("pending", "").put("pendingRevision", 0)
                }
            }
        }

        var active = state.optString("active")
        // 新APK已超出旧资源的有效范围时直接使用新版内置页，不误报为启动崩溃。
        if (active.isNotEmpty() && superseded(active)) {
            state.put("active", "").put("previous", "").put("healthy", JSONObject())
            active = ""
        }
        var loaded = if (active.isNotEmpty()) read(active) else null
        if (active.isNotEmpty() && loaded == null) {
            rollback("web_rolled_back"); active = state.optString("active"); loaded = if (active.isNotEmpty()) read(active) else null
        }
        if (loaded == null) state.put("active", "")
        selected = loaded?.first; selectedDirectory = loaded?.second
        state.put("launching", JSONObject()).put("recover", false)
        save()
        val keep = setOf(state.optString("active"), state.optString("pending"), state.optString("previous"))
        packages.listFiles()?.filter { it.name !in keep && it.name.matches(Regex("r[1-9][0-9]*-[a-f0-9]{16}")) }?.forEach { it.deleteRecursively() }
        File(root, "staging").deleteRecursively(); File(root, "download.part").delete()
    }
    private fun healthy(): Boolean {
        val flags = state.optJSONObject("healthy") ?: return false
        return flags.optBoolean("mobile.html") && flags.optBoolean("remote.html")
    }
    private fun rollback(reason: String) {
        val restored = state.optString("previous")
        state.put("active", state.optString("previous")).put("previous", "").put("pending", "").put("pendingRevision", 0)
            .put("healthy", if (restored.isNotEmpty()) JSONObject().put("mobile.html", true).put("remote.html", true) else JSONObject())
            .put("launching", JSONObject()).put("notice", reason).put("recover", false)
    }
    @Synchronized fun started(page: String) {
        require(page in setOf("mobile.html", "remote.html")); check(opened)
        if (selected == null || state.optBoolean("recover")) return
        val launching = state.optJSONObject("launching") ?: JSONObject()
        state.put("launching", launching.put(page, true)); save()
    }
    @Synchronized fun ready(page: String) {
        if (selected == null || state.optBoolean("recover")) return
        state.optJSONObject("launching")?.remove(page)
        val healthy = state.optJSONObject("healthy") ?: JSONObject()
        state.put("healthy", healthy.put(page, true)); save()
    }
    @Synchronized fun failed() {
        if (selected == null) return
        state.put("recover", true).put("notice", "web_recovery_pending"); save()
    }
    @Synchronized fun recoverBundled() {
        state.put("previous", "").put("recover", true).put("notice", "web_recovery_pending"); save()
    }
    @Synchronized fun snapshot(): JSONObject = JSONObject().put("currentRevision", selected?.revision ?: 0)
        .put("pendingRevision", state.optLong("pendingRevision", 0))
        .put("highestRevision", state.optLong("highestRevision", 0)).put("notice", state.optString("notice").takeIf { it.isNotEmpty() } ?: JSONObject.NULL)
        .put("recoveryPending", state.optBoolean("recover"))
    fun stage(input: WebResourceManifest, archive: File, cancelled: () -> Boolean = { false }) {
        val manifest = parse(input.envelope)
        synchronized(this) {
            check(opened)
            require(manifest.revision > state.optLong("highestRevision", 0)) { "web_version_not_newer" }
            require(!state.optBoolean("recover")) { "web_recovery_pending" }
        }
        require(archive.length() == manifest.archive.bytes && WebResourceManifest.hashFile(archive) == manifest.archive.sha256) { "web_archive_invalid" }
        val temporary = File(root, "staging")
        temporary.deleteRecursively(); require(temporary.mkdirs()) { "web_storage_failed" }
        var promoted: File? = null
        var committed = false
        try {
            manifest.unpack(archive, File(temporary, "content"), cancelled)
            File(temporary, "manifest.json").writeBytes(manifest.envelope)
            if (cancelled()) throw java.io.IOException("update_cancelled")
            val target = packageDirectory(manifest.directoryName)
            require(!target.exists() && temporary.renameTo(target)) { "web_storage_failed" }
            promoted = target
            synchronized(this) {
                if (cancelled()) throw java.io.IOException("update_cancelled")
                require(!state.optBoolean("recover")) { "web_recovery_pending" }
                val previous = JSONObject(state.toString())
                state.put("pending", manifest.directoryName).put("pendingRevision", manifest.revision).put("highestRevision", manifest.revision).remove("notice")
                try { save() } catch (failure: Exception) { state = previous; throw failure }
                committed = true
            }
        } finally { temporary.deleteRecursively(); if (!committed) promoted?.deleteRecursively() }
    }
    /** 活动包缺文件时返回404；禁止从APK兜单个文件而混用两代模块。 */
    @Synchronized fun resource(path: String): File? {
        val directory = selectedDirectory ?: return null
        if (!WebResourceManifest.validPath(path)) return null
        return File(directory, path).takeIf { it.canonicalPath.startsWith(directory.canonicalPath + File.separator) && it.isFile }
    }
    fun usesDownloadedResources() = selectedDirectory != null
}
