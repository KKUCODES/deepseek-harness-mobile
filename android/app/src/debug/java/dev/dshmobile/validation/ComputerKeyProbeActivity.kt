package dev.dshmobile.validation

import android.app.Activity
import android.os.Bundle
import android.widget.TextView

/** 仅供 instrumentation 承载真实原生窗口；不连接网关或使用应用凭据。 */
class ComputerKeyProbeActivity : Activity() {
    override fun onCreate(state: Bundle?) {
        super.onCreate(state)
        setContentView(TextView(this).apply { text = "电脑 Key 原生窗口隔离验证" })
    }
}
