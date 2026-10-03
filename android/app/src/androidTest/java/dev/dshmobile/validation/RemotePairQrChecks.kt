package dev.dshmobile.validation

import android.graphics.Bitmap
import com.google.zxing.BarcodeFormat
import com.google.zxing.MultiFormatWriter
import java.io.ByteArrayOutputStream

object RemotePairQrChecks {
    private fun image(text: String, inverted: Boolean = false, transparent: Boolean = false): ByteArray {
        val matrix = MultiFormatWriter().encode(text, BarcodeFormat.QR_CODE, 480, 480)
        val bitmap = Bitmap.createBitmap(480, 480, Bitmap.Config.ARGB_8888)
        try {
            val pixels = IntArray(480 * 480) { index ->
                if (matrix[index % 480, index / 480] != inverted) 0xff000000.toInt()
                else if (transparent) 0x00ffffff else 0xffffffff.toInt()
            }
            bitmap.setPixels(pixels, 0, 480, 0, 0, 480, 480)
            return ByteArrayOutputStream().also { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }.toByteArray()
        } finally { bitmap.recycle() }
    }
    fun run() {
        val key = "A".repeat(43)
        val canonical = "http://127.0.0.1:8787/pair#key=$key"
        val app = "dshm://pair?server=http%3A%2F%2F127.0.0.1%3A8787#key=$key"
        listOf(image(canonical), image(app), image(app, inverted = true), image(app, transparent = true)).forEach {
            check(RemotePairQr.decode(it.inputStream()) == canonical)
        }
        fun rejected(bytes: ByteArray, expected: String) {
            val error = runCatching { RemotePairQr.decode(bytes.inputStream()) }.exceptionOrNull()
            check(error is RemotePairQr.Failure && error.code == expected)
        }
        rejected(image("https://example.com/"), "invalid_pair_link")
        rejected(image("file:///private#key=$key"), "invalid_pair_link")
        rejected(byteArrayOf(0, 1, 2), "scan_image_invalid")
        rejected(ByteArray(RemotePairQr.MAX_BYTES + 1), "scan_image_too_large")
        val blank = Bitmap.createBitmap(100, 100, Bitmap.Config.ARGB_8888)
        val bytes = ByteArrayOutputStream()
        blank.eraseColor(0xffffffff.toInt()); blank.compress(Bitmap.CompressFormat.PNG, 100, bytes); blank.recycle()
        rejected(bytes.toByteArray(), "scan_qr_not_found")
    }
}
