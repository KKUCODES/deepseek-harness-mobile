package dev.dshmobile.validation

import android.content.ClipData

/** 不解析 URI 内容，不返回普通文本；复用扫码、深链和领取入口的同一准入规则。 */
internal object RemotePairClipboard {
    fun read(clip: ClipData?): String? {
        if (clip == null || clip.itemCount != 1) return null
        val text = clip.getItemAt(0).text ?: return null
        if (text.length !in 1..4096) return null
        return RemotePairLink.parse(text.toString())?.canonical
    }
}
