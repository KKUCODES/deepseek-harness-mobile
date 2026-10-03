package dev.dshmobile.validation

import android.os.SystemClock
import java.util.UUID

/** 单个、短暂的进程内交接；目标任务的 Intent 只持有随机编号，不保存 key。 */
internal object RemotePairHandoff {
    private class Pending(val id: String, val link: String, val created: Long)
    private var pending: Pending? = null
    fun offer(link: RemotePairLink): String {
        val value = Pending(UUID.randomUUID().toString(), link.canonical, SystemClock.elapsedRealtime())
        pending = value
        return value.id
    }
    fun take(id: String?): String? {
        val value = pending ?: return null
        if (SystemClock.elapsedRealtime() - value.created > 300_000) { pending = null; return null }
        if (value.id != id) return null
        pending = null
        return value.link
    }
}
