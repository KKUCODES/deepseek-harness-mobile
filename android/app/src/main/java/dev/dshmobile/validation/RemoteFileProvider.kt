package dev.dshmobile.validation

import androidx.core.content.FileProvider
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.system.Os
import java.io.FileNotFoundException

class RemoteFileProvider : FileProvider() {
    override fun openFile(uri: Uri, mode: String): ParcelFileDescriptor {
        if (mode != "r") throw FileNotFoundException("Read-only share")
        val descriptor = super.openFile(uri, mode) ?: throw FileNotFoundException("Share unavailable")
        try {
            val age = System.currentTimeMillis() - Os.fstat(descriptor.fileDescriptor).st_mtime * 1000
            if (age < 0 || age >= RemoteShareFiles.LIFETIME) throw FileNotFoundException("Share expired")
            return descriptor
        } catch (error: Exception) { descriptor.close(); throw error }
    }
}
