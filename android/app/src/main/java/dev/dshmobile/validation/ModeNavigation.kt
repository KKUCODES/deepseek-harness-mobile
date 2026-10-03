package dev.dshmobile.validation

import android.app.Activity
import android.content.Intent

/** 移到已有模式页面，不销毁另一模式的 WebView、草稿或进程内连接。 */
internal object ModeNavigation {
    fun remote(activity: Activity, pairHandoff: String? = null) {
        activity.startActivity(Intent(activity, RemoteActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            // 系统配对入口有独立 task；把页面送回应用 task，但不清除其中的普通聊天。
            if (activity is PairingEntryActivity) addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            if (pairHandoff != null) putExtra(RemoteActivity.PAIR_HANDOFF, pairHandoff)
        })
    }

    fun ordinary(activity: Activity, appearance: Boolean = false) {
        activity.startActivity(Intent(activity, ValidationActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra(ValidationActivity.OPEN_APPEARANCE, appearance))
    }
}
