package dev.dshmobile.validation

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import com.nimbusds.jose.JOSEObjectType
import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.JWSHeader
import com.nimbusds.jose.crypto.ECDSASigner
import com.nimbusds.jose.jwk.Curve
import com.nimbusds.jose.jwk.ECKey
import com.nimbusds.jose.util.Base64URL
import com.nimbusds.jwt.JWTClaimsSet
import com.nimbusds.jwt.SignedJWT
import org.json.JSONObject
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.MessageDigest
import java.security.PrivateKey
import java.security.interfaces.ECPublicKey
import java.security.spec.ECGenParameterSpec
import java.util.Date
import java.util.UUID

/** Remote 独立密钥域；设备私钥不可导出，设备 token 不返回 WebView。 */
class RemoteIdentity(context: Context) {
    private val alias = "dshm.remote.device.p256.v1"
    private val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    private val token = OrdinaryCredentials(context, "dshm.remote.token.v1")
    private val metadata = context.getSharedPreferences("dshm.remote.binding.v1", Context.MODE_PRIVATE)
    val origin: String get() = metadata.getString("origin", null) ?: error("remote_not_paired")
    fun paired() = token.configured() && metadata.contains("origin") && store.containsAlias(alias)

    fun prepare() {
        check(!paired()) { "remote_already_paired" }
        if (!store.containsAlias(alias)) KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore").apply {
            initialize(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_SIGN)
                .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
                .setDigests(KeyProperties.DIGEST_SHA256).build())
        }.generateKeyPair()
    }
    private fun publicKey() = ECKey.Builder(Curve.P_256, store.getCertificate(alias).publicKey as ECPublicKey).build()
    fun fingerprint() = publicKey().computeThumbprint().toString()
    fun info() = JSONObject().put("paired", paired()).apply {
        if (paired()) put("origin", origin).put("deviceId", metadata.getString("deviceId", ""))
            .put("fingerprint", fingerprint())
    }
    fun save(origin: String, value: JSONObject) {
        val secret = value.getString("token")
        require(secret.matches(Regex("[A-Za-z0-9_-]{43}")))
        require(value.getString("status") == "pending")
        val deviceId = UUID.fromString(value.getString("deviceId")).toString()
        token.save(secret)
        check(metadata.edit().putString("origin", origin).putString("deviceId", deviceId).commit())
    }
    fun authorization() = "DPoP ${token.read()}"
    fun proof(origin: String, path: String, method: String, authenticated: Boolean): String {
        val claims = JWTClaimsSet.Builder().issueTime(Date()).jwtID(UUID.randomUUID().toString())
            .claim("htu", origin + path).claim("htm", method)
        if (authenticated) claims.claim("ath", Base64URL.encode(MessageDigest.getInstance("SHA-256")
            .digest(token.read().toByteArray(Charsets.US_ASCII))).toString())
        val jwt = SignedJWT(JWSHeader.Builder(JWSAlgorithm.ES256).type(JOSEObjectType("dpop+jwt"))
            .jwk(publicKey()).build(), claims.build())
        // Nimbus 的 PrivateKey 构造器支持不可导出的 Keystore key；由库处理 JOSE 签名编码。
        jwt.sign(ECDSASigner(store.getKey(alias, null) as PrivateKey, Curve.P_256))
        return jwt.serialize()
    }
    fun clear() {
        token.clear(); check(metadata.edit().clear().commit())
        if (store.containsAlias(alias)) store.deleteEntry(alias)
    }
}
