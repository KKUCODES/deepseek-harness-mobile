package dev.dshmobile.validation

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.AtomicFile
import java.io.File
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Key 仅在原生请求层解密；文件不参与备份，WebView 只可查询是否已配置。 */
class OrdinaryCredentials(context: Context, private val alias: String = "dshm.ordinary.deepseek.v1") {
    private val file = AtomicFile(File(context.noBackupFilesDir, "$alias.encrypted"))
    private val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }

    @Synchronized fun configured() = file.baseFile.exists()

    private fun key(create: Boolean): SecretKey {
        (store.getKey(alias, null) as? SecretKey)?.let { return it }
        check(create) { "credential_unavailable" }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256).build())
        }.generateKey()
    }

    @Synchronized fun save(value: String) {
        require(value.length in 8..512 && value.all { it.code in 33..126 })
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key(true)) // 让平台生成新的随机 IV，不能复用。
        check(cipher.iv.size == 12)
        val plain = value.toByteArray(Charsets.UTF_8)
        val encrypted = try { cipher.doFinal(plain) } finally { plain.fill(0) }
        val output = file.startWrite()
        try {
            output.write(byteArrayOf(1) + cipher.iv + encrypted)
            file.finishWrite(output)
        } catch (error: Exception) { file.failWrite(output); throw error }
    }

    @Synchronized fun read(): String {
        val bytes = file.readFully()
        check(bytes.size in 30..1024 && bytes[0] == 1.toByte())
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key(false), GCMParameterSpec(128, bytes.copyOfRange(1, 13)))
        val plain = cipher.doFinal(bytes.copyOfRange(13, bytes.size))
        return try { plain.toString(Charsets.UTF_8) } finally { plain.fill(0) }
    }

    @Synchronized fun clear() { file.delete(); if (store.containsAlias(alias)) store.deleteEntry(alias) }
}
