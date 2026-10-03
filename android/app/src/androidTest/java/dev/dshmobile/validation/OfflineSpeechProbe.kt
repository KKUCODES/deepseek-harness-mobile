package dev.dshmobile.validation

import android.app.Instrumentation
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

/** 仅诊断模拟器的离线引擎；合成固定测试文字，不读取聊天，也不作为TalkBack全流程证明。 */
internal object OfflineSpeechProbe {
    fun run(instrumentation: Instrumentation): Bundle {
        val result = Bundle()
        val initialized = CountDownLatch(1)
        val initStatus = AtomicInteger(-99)
        var engine: TextToSpeech? = null
        try {
            instrumentation.runOnMainSync {
                engine = TextToSpeech(instrumentation.targetContext, { status ->
                    initStatus.set(status); initialized.countDown()
                }, "com.google.android.tts")
            }
            result.putBoolean("initialized", initialized.await(20, TimeUnit.SECONDS))
            result.putInt("initStatus", initStatus.get())
            if (initStatus.get() != TextToSpeech.SUCCESS) return result
            val tts = checkNotNull(engine)
            val voices = tts.voices.orEmpty()
            result.putInt("voiceCount", voices.size)
            for ((language, text) in listOf("zh" to "选择模型，当前模型。关闭窗口。", "en" to "Choose model. Close window.")) {
                val declared = voices.filter { it.locale.language == language && !it.isNetworkConnectionRequired }
                result.putInt("declaredOfflineVoices_$language", declared.size)
                result.putInt("missingVoiceData_$language", declared.count { TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED in it.features.orEmpty() })
                // “不要求网络”不保证语音包已安装；setVoice可能触发下载，诊断只选择已安装数据。
                val available = declared.filter { TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED !in it.features.orEmpty() }
                    .filter { it.locale.country == if (language == "zh") "CN" else "US" }
                result.putInt("installedMatchingVoices_$language", available.size)
                val voice = available.firstOrNull() ?: continue
                result.putString("voice_$language", voice.name)
                result.putInt("setVoice_$language", tts.setVoice(voice))
                val finished = CountDownLatch(1)
                val status = AtomicInteger(-99)
                val id = "dshm-offline-$language"
                tts.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                    override fun onStart(utteranceId: String?) = Unit
                    override fun onDone(utteranceId: String?) { if (utteranceId == id) { status.set(0); finished.countDown() } }
                    @Deprecated("Platform callback")
                    override fun onError(utteranceId: String?) { if (utteranceId == id) { status.set(-1); finished.countDown() } }
                    override fun onError(utteranceId: String?, code: Int) { if (utteranceId == id) { status.set(code); finished.countDown() } }
                })
                val file = File(instrumentation.targetContext.cacheDir, "$id.wav")
                check(!file.exists()) { "do_not_overwrite_existing_probe" }
                try {
                    result.putInt("enqueue_$language", tts.synthesizeToFile(text, Bundle(), file, id))
                    result.putBoolean("finished_$language", finished.await(25, TimeUnit.SECONDS))
                    result.putInt("status_$language", status.get())
                    result.putLong("audioBytes_$language", file.length())
                } finally { tts.stop(); file.delete() }
            }
            return result
        } finally { engine?.shutdown() }
    }
}
