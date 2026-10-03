package dev.dshmobile.validation

import android.content.Context
import java.io.File
import java.util.UUID

object RemoteSaveJournalChecks {
    fun run(context: Context) {
        val directory = File(context.cacheDir, "save-journal-test-${UUID.randomUUID()}")
        try {
            val first = RemoteSaveJournal(directory)
            check(!first.hasRecovered())
            val complete = first.begin()
            check(complete.readBytes().contentEquals(byteArrayOf(1)))
            first.settled(complete)
            check(!RemoteSaveJournal(directory).hasRecovered())
            val interrupted = first.begin()
            val reopened = RemoteSaveJournal(directory)
            check(reopened.hasRecovered())
            val active = reopened.begin()
            reopened.acknowledge()
            check(!interrupted.exists() && active.exists() && !reopened.hasRecovered())
            check(RemoteSaveJournal(directory).hasRecovered())
            reopened.settled(active)
            check(!RemoteSaveJournal(directory).hasRecovered())
        } finally { directory.listFiles().orEmpty().forEach { it.delete() }; directory.delete() }
    }
}
