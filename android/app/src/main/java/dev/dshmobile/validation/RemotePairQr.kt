package dev.dshmobile.validation

import android.graphics.BitmapFactory
import com.google.zxing.BinaryBitmap
import com.google.zxing.DecodeHintType
import com.google.zxing.RGBLuminanceSource
import com.google.zxing.common.HybridBinarizer
import com.google.zxing.qrcode.QRCodeReader
import java.io.ByteArrayOutputStream
import java.io.InputStream

/** 只读用户选择的图片，限制压缩字节和解码尺寸；内容必须再次通过既有配对解析器。 */
internal object RemotePairQr {
    class Failure(val code: String) : Exception()
    const val MAX_BYTES = 8 * 1024 * 1024

    fun decode(input: InputStream): String {
        val buffer = ByteArray(32 * 1024)
        val out = ByteArrayOutputStream()
        while (true) {
            if (Thread.currentThread().isInterrupted) throw Failure("scan_cancelled")
            val count = input.read(buffer)
            if (count < 0) break
            if (out.size() + count > MAX_BYTES) throw Failure("scan_image_too_large")
            out.write(buffer, 0, count)
        }
        val bytes = out.toByteArray()
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) throw Failure("scan_image_invalid")
        if (bounds.outWidth.toLong() * bounds.outHeight > 64_000_000L) throw Failure("scan_image_too_large")
        val options = BitmapFactory.Options().apply { inSampleSize = 1 }
        while (maxOf(bounds.outWidth, bounds.outHeight) / options.inSampleSize > 2048) options.inSampleSize *= 2
        val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options) ?: throw Failure("scan_image_invalid")
        try {
            val pixels = IntArray(bitmap.width * bitmap.height)
            bitmap.getPixels(pixels, 0, bitmap.width, 0, 0, bitmap.width, bitmap.height)
            // PNG 透明像素以白底读取，避免透明边缘被视为实心黑色。
            for (index in pixels.indices) {
                val color = pixels[index]; val alpha = color ushr 24
                if (alpha != 255) {
                    val r = ((color shr 16 and 255) * alpha + 255 * (255 - alpha)) / 255
                    val g = ((color shr 8 and 255) * alpha + 255 * (255 - alpha)) / 255
                    val b = ((color and 255) * alpha + 255 * (255 - alpha)) / 255
                    pixels[index] = (255 shl 24) or (r shl 16) or (g shl 8) or b
                }
            }
            val source = RGBLuminanceSource(bitmap.width, bitmap.height, pixels)
            val hints = mapOf(DecodeHintType.TRY_HARDER to true)
            val text = try { QRCodeReader().decode(BinaryBitmap(HybridBinarizer(source)), hints).text }
            catch (_: com.google.zxing.ReaderException) {
                try { QRCodeReader().decode(BinaryBitmap(HybridBinarizer(source.invert())), hints).text }
                catch (_: com.google.zxing.ReaderException) { throw Failure("scan_qr_not_found") }
            }
            return RemotePairLink.parse(text)?.canonical ?: throw Failure("invalid_pair_link")
        } finally { bitmap.recycle() }
    }
}
