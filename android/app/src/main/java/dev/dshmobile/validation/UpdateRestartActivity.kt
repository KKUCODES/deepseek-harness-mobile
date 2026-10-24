package dev.dshmobile.validation

import android.app.Activity
import android.app.ActivityManager
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.Process
import android.view.Gravity
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ImageView

/** 用户在前台确认后由独立进程接力，不依赖闹钟权限，也不向页面开放任意Intent。 */
class UpdateRestartActivity : Activity() {
    companion object {
        fun launch(activity: Activity) {
            activity.startActivity(Intent(activity, UpdateRestartActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                .putExtra("previousPid", Process.myPid()).putExtra("remote", activity is RemoteActivity)
                .putExtra("english", (activity.application as DshmApplication).appearance.language() == "en"))
        }
    }
    private var resumed = false
    private val handler = Handler(Looper.getMainLooper())
    override fun onCreate(state: Bundle?) {
        super.onCreate(state)
        val content = FrameLayout(this)
        content.addView(ImageView(this).apply { setImageResource(R.drawable.ic_launcher_foreground) },
            FrameLayout.LayoutParams((240 * resources.displayMetrics.density).toInt(), (240 * resources.displayMetrics.density).toInt(), Gravity.CENTER))
        setContentView(content)
    }
    override fun onResume() {
        super.onResume()
        if (resumed) return
        resumed = true
        val previous = intent.getIntExtra("previousPid", -1)
        val manager = getSystemService(ActivityManager::class.java)
        val old = manager.runningAppProcesses?.find { it.pid == previous && it.uid == Process.myUid() && it.processName == packageName }
        if (old != null && old.pid != Process.myPid()) Process.killProcess(old.pid)
        fun reopen(attempt: Int) {
            val alive = manager.runningAppProcesses?.any { it.pid == previous && it.uid == Process.myUid() && it.processName == packageName } == true
            if (alive && attempt < 40) { handler.postDelayed({ reopen(attempt + 1) }, 50); return }
            try {
                check(!alive)
                startActivity(Intent(this, if (intent.getBooleanExtra("remote", false)) RemoteActivity::class.java else ValidationActivity::class.java)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK))
                finish()
                handler.postDelayed({ Process.killProcess(Process.myPid()) }, 250)
            } catch (_: Exception) {
                setContentView(Button(this).apply { text = if (intent.getBooleanExtra("english", false)) "Reopen DSHM" else "重新打开 DSHM"; setOnClickListener { reopen(0) } })
            }
        }
        handler.postDelayed({ reopen(0) }, 150)
    }
}
