package dev.dshmobile.validation

import android.app.Activity
import android.app.Instrumentation
import android.os.Bundle
import java.io.File

/** 默认用独立别名和文件测试Keystore；只有显式noticeEpochSession专项连接已有电脑，不读取或改写凭据。 */
class OrdinarySecurityInstrumentation : Instrumentation() {
    private var noticeEpochSession: String? = null
    private var noticeEpochRevoke = false
    private var noticeQueueOverflow = false
    private var offlineSpeechProbe = false
    private var notificationsOnly = false
    private var appearanceOnly = false
    private var computerKeyOnly = false
    private var resourcesOnly = false
    private var saveOnly = false
    private var saveWriteOnly = false
    private var saveDeathOnly = false
    private var shareDeathOnly = false
    private var shareOnly = false
    override fun onCreate(arguments: Bundle?) {
        noticeEpochRevoke = arguments?.getString("noticeEpochRevoke") == "true"
        noticeQueueOverflow = arguments?.getString("noticeQueueOverflow") == "true"
        offlineSpeechProbe = arguments?.getString("offlineSpeechProbe") == "true"
        super.onCreate(arguments); noticeEpochSession = arguments?.getString("noticeEpochSession"); notificationsOnly = arguments?.getString("notificationsOnly") == "true"; appearanceOnly = arguments?.getString("appearanceOnly") == "true"; computerKeyOnly = arguments?.getString("computerKeyOnly") == "true"; resourcesOnly = arguments?.getString("resourcesOnly") == "true"; saveOnly = arguments?.getString("saveOnly") == "true"; saveWriteOnly = arguments?.getString("saveWriteOnly") == "true"; saveDeathOnly = arguments?.getString("saveDeathOnly") == "true"; shareDeathOnly = arguments?.getString("shareDeathOnly") == "true"; shareOnly = arguments?.getString("shareOnly") == "true"; start()
    }
    override fun onStart() {
        if (offlineSpeechProbe) {
            try { finish(Activity.RESULT_OK, OfflineSpeechProbe.run(this)) }
            catch (error: Exception) { finish(Activity.RESULT_CANCELED, Bundle().apply { putString("error", error.javaClass.simpleName) }) }
            return
        }
        noticeEpochSession?.let { session ->
            val result = Bundle()
            try { RemoteNoticeEpochLiveChecks.run(this, session, noticeEpochRevoke, noticeQueueOverflow); result.putString("stage", RemoteNoticeEpochLiveChecks.stage); result.putString("result", if (noticeQueueOverflow) "PASS: real Host frame replay, 256 queued/257 cancelled, automatic authenticated reconnect, dedup and fresh notification" else if (noticeEpochRevoke) "PASS: actual desktop revocation during held Host outcome, late frame discarded, authenticated reconnect rejected" else "PASS: actual Host outcome queued before pause, old callback isolation after authenticated reconnect, and fresh system notification"); finish(Activity.RESULT_OK, result) }
            catch (error: Exception) { result.putString("result", "FAIL: live notice epoch"); result.putString("stage", RemoteNoticeEpochLiveChecks.stage); result.putString("location", error.stackTrace.firstOrNull { it.className.contains("RemoteNoticeEpochLiveChecks") }?.toString()); finish(Activity.RESULT_CANCELED, result) }
            return
        }
        if (shareDeathOnly) { RemoteShareDeathChecks.run(this); return }
        if (shareOnly) {
            val result = Bundle()
            try { RemoteShareChecks.run(targetContext); result.putString("result", "PASS: share atomic publication, same-process preparation, exact bytes, read-only provider, expiry, capacity and cancellation"); finish(Activity.RESULT_OK, result) }
            catch (error: Exception) { result.putString("result", "FAIL: share snapshots"); result.putString("location", error.stackTrace.firstOrNull { it.className.contains("RemoteShareChecks") }?.toString()); finish(Activity.RESULT_CANCELED, result) }
            return
        }
        if (saveDeathOnly) { RemoteSaveDeathChecks.run(this); return }
        if (saveWriteOnly) {
            val result = Bundle()
            try { RemoteSaveWriteChecks.run(this); result.putString("result", "PASS: real native save writes, complete bytes, disconnect/abort/close during blocked write, partial document cleanup, single reply and next connection"); finish(Activity.RESULT_OK, result) }
            catch (error: Exception) { result.putString("result", "FAIL: native save write lifecycle"); result.putString("stage", RemoteSaveWriteChecks.stage); result.putString("location", error.stackTrace.firstOrNull { it.className.contains("RemoteSaveWriteChecks") }?.toString()); finish(Activity.RESULT_CANCELED, result) }
            return
        }
        if (saveOnly) {
            val result = Bundle()
            try { RemoteSaveChecks.run(this); result.putString("result", "PASS: save disconnect, abort, close, late document cleanup, busy isolation and single reply"); finish(Activity.RESULT_OK, result) }
            catch (error: Exception) { result.putString("result", "FAIL: native save lifecycle"); result.putString("location", error.stackTrace.firstOrNull { it.className.contains("RemoteSaveChecks") }?.toString()); finish(Activity.RESULT_CANCELED, result) }
            return
        }
        if (resourcesOnly) {
            val result = Bundle()
            try { RemoteResourceChecks.run(targetContext); result.putString("result", "PASS: native resource streaming, persistent cache, HEAD revalidation, updates, deletion, identity, corruption, clearing and cancellation"); finish(Activity.RESULT_OK, result) }
            catch (error: Exception) {
                result.putString("result", "FAIL: native resources")
                result.putString("location", error.stackTrace.firstOrNull { it.className.contains("RemoteResourceChecks") }?.toString())
                finish(Activity.RESULT_CANCELED, result)
            }
            return
        }
        if (computerKeyOnly) {
            val result = Bundle()
            try { RemoteComputerKeyChecks.run(this); result.putString("result", "PASS: native computer Key language, draft, validation, confirmation, busy lock and original isolated transport checks"); finish(Activity.RESULT_OK, result) }
            catch (error: Exception) {
                result.putString("result", "FAIL: native computer Key")
                result.putString("stage", RemoteComputerKeyChecks.stage)
                result.putString("location", error.stackTrace.firstOrNull { it.className.contains("RemoteComputerKeyChecks") }?.toString())
                finish(Activity.RESULT_CANCELED, result)
            }
            return
        }
        if (appearanceOnly) {
            val result = Bundle()
            try { PhoneAppearanceChecks.run(targetContext); result.putString("result", "PASS: native appearance whitelist, persistence, invalid input rejection and listener cleanup"); finish(Activity.RESULT_OK, result) }
            catch (error: Exception) { result.putString("result", "FAIL: native appearance"); result.putString("location", error.stackTrace.firstOrNull { it.className.contains("PhoneAppearanceChecks") }?.toString()); finish(Activity.RESULT_CANCELED, result) }
            return
        }
        if (notificationsOnly) {
            val result = Bundle()
            try {
                RemoteNoticeChecks.run()
                RemoteNotificationRestoreChecks.run(this)
                result.putString("result", "PASS: native notification ledger and actual system notification restore, no replay, binding/setting validation, baseline, dismissal and terminal cleanup")
                finish(Activity.RESULT_OK, result)
            } catch (error: Exception) {
                result.putString("result", "FAIL: native notification ledger")
                result.putString("stage", RemoteNotificationRestoreChecks.stage)
                result.putString("location", error.stackTrace.firstOrNull { it.className.contains("RemoteNoticeChecks") || it.className.contains("RemoteNotificationRestoreChecks") }?.toString())
                finish(Activity.RESULT_CANCELED, result)
            }
            return
        }
        val name = "dshm.test.credential-roundtrip"
        val credentials = OrdinaryCredentials(targetContext, name)
        val file = File(targetContext.noBackupFilesDir, "$name.encrypted")
        val result = Bundle()
        try {
            credentials.clear()
            check(!credentials.configured())
            val fixture = "non-secret-test-value-not-an-api-key"
            credentials.save(fixture)
            val first = file.readBytes()
            check(credentials.configured() && credentials.read() == fixture)
            check(!first.toString(Charsets.UTF_8).contains(fixture))
            credentials.save(fixture)
            check(!first.copyOfRange(1, 13).contentEquals(file.readBytes().copyOfRange(1, 13)))
            check(OrdinaryCredentials(targetContext, name).read() == fixture)
            val tampered = file.readBytes().also { it[it.lastIndex] = (it.last().toInt() xor 1).toByte() }
            file.writeBytes(tampered)
            check(runCatching { credentials.read() }.isFailure)
            credentials.clear()
            check(!file.exists() && !credentials.configured())
            RemoteResourceChecks.run(targetContext)
            RemoteDownloadChecks.run(targetContext)
            RemoteShareChecks.run(targetContext)
            RemoteHtmlChecks.run(targetContext)
            RemotePairLinkChecks.run()
            RemotePairQrChecks.run()
            RemoteComputerKeyChecks.run(this)
            result.putBoolean("computerKeyChecks", true)
            result.putBoolean("pairingQrChecks", true)
            result.putString("result", "PASS: encrypted roundtrip, random IV, reopen, tamper rejection, removal; Remote resources; download names, ordered chunks, exact bytes, incomplete finish, generation expiry, stale-id isolation and cleanup; share snapshot, MIME, read-only intent, provider scope, capacity, cancellation and expiry; HTML origin, method, main-frame rejection, CSP, exact bytes, close, generation and stale-id isolation; pairing HTTP/HTTPS/IPv6/custom links, invalid input rejection, one-time in-memory handoff; independent fixtures; no network")
            finish(Activity.RESULT_OK, result)
        } catch (error: Exception) {
            result.putString("computerKeyStage", RemoteComputerKeyChecks.stage)
            result.putString("failureType", error.javaClass.simpleName)
            result.putString("failureLocation", error.stackTrace.firstOrNull { it.className.startsWith("dev.dshmobile.validation.RemoteComputerKeyChecks") }?.toString())
            result.putString("result", "FAIL: native credential test; no exception or secret logged")
            finish(Activity.RESULT_CANCELED, result)
        } finally { credentials.clear() }
    }
}
