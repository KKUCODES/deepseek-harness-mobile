package dev.dshmobile.validation

import android.content.Context
import android.util.Base64
import java.io.File

object RemoteDownloadChecks {
    fun run(context: Context) {
        val directory = File(context.cacheDir, "remote-download-test")
        var owner: Int? = 1
        val store = RemoteDownloadStore(directory) { owner }
        try {
            for (name in listOf("../escape", "a/b", "a\\b", "..", "", "bad\u0000name")) check(runCatching { store.begin(name) }.isFailure)
            val entry = store.begin("中文.bin")
            check(runCatching { store.begin("second.bin") }.isFailure)
            val bytes = ByteArray(65536) { (it % 251).toByte() }
            check(store.append(entry.id, 0, Base64.encodeToString(bytes, Base64.NO_WRAP)) == 65536L)
            check(runCatching { store.append(entry.id, 0, "eA==") }.isFailure)
            check(runCatching { store.finish(entry.id, 1) }.isFailure)
            store.finish(entry.id, 65536)
            check(entry.file.readBytes().contentEquals(bytes))
            check(runCatching { store.append(entry.id, 65536, "eA==") }.isFailure)
            owner = null
            check(runCatching { store.entry(entry.id) }.isFailure)
            store.abort(); check(!entry.file.exists())
            owner = 2
            check(runCatching { store.begin("stale.bin", 1) }.isFailure)
            val next = store.begin("empty.bin")
            store.abort(entry.id); check(store.entry(next.id) === next)
            check(runCatching { store.append(entry.id, 0, "eA==") }.isFailure)
            store.finish(next.id, 0); check(next.file.length() == 0L)
            store.abort(); check(!next.file.exists())
            File(directory, "remote-crash.part").writeText("temporary")
            RemoteDownloadStore(directory) { owner }
            check(!File(directory, "remote-crash.part").exists())
        } finally { store.abort(); directory.delete() }
    }
}
