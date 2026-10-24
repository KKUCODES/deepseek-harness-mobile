# 统一软件更新与一键重启

- 状态：本地实现及独立Android验收通过；用户已授权提交推送并发布 `0.1.0-preview.11` / code14，发布核验完成前以[发行说明](../releases.md#已核验范围)实际证据为准。MuMu本地候选为 `0.1.0-preview.11-dev` / code13，原包名和签名保持。
- 维护：手机端维护者；最近核验：2026-10-24。[KKC-85](https://linear.app/kkcodes/issue/KKC-85)。
- 用户最新授权发布APK，仍不发布r2。公共资源通道保留原r1；MuMu另设独立「DSHM 更新验收」入口，使用本地签名r2，不是线上r2。[实现 KKC-85](https://linear.app/kkcodes/issue/KKC-85) · [发布 KKC-86](https://linear.app/kkcodes/issue/KKC-86)。

## 界面与选择规则

普通设置、Remote菜单及启动提示使用[同一个面板](../../src/ui/AppUpdates.jsx)。APK与页面资源不再分列：主区域显示状态、目标版本和大小；底部保留当前主动作，说明、技术信息和恢复入口折叠。下载可关闭窗口继续使用；保存及重启期间不能关闭，避免确认落盘后继续输入。

[选择规则](../../src/update-presentation.mjs)先完成正在进行或已就绪的任务，再优先新版APK。下载资源后主按钮变为「重启并应用」，不需要去系统设置。原生恢复确认后也会自动重启。旧桥没有 `restartSupported` 时不调用新操作，仅提示下次启动应用；不放宽原APK安装授权。

## 重启与数据边界

[更新桥](../../android/app/src/main/java/dev/dshmobile/validation/AppUpdateBridge.kt)只接受精确自有主页面的空参数操作。所有存活页面通过[保存屏障](../../src/update-preparation.mjs)确认落盘，每页每次尝试使用独立随机编号；旧回复和重复回复不能放行。普通聊天等待写入队列并再存当前草稿，生成中拒绝重启；Remote保存文本/编辑器/附件草稿，正在发送或转移时拒绝。任一失败或10秒超时，保留旧进程和pending。

保存成功后，非导出的[接力Activity](../../android/app/src/main/java/dev/dshmobile/validation/UpdateRestartActivity.kt)在独立 `:updateRestart` 进程运行，只结束本包同UID旧主进程；等待退出后自动打开原普通/Remote模式，再结束接力进程。不接受页面提供PID或Intent，不申请闹钟权限、不清数据。Application在接力进程跳过资源/服务初始化，避免提前激活或并发写入。新主进程仍执行原验签、完整性、兼容及健康/回退检查。

正常更新面板恢复先保存页面，损坏页面的原生恢复不依赖已失效的JS。新APK已超出旧签名资源的最大APK版本时，该包视为过期：跳过远端候选、放弃过期pending/活动引用并使用新内置页，不误报为崩溃；最高接受序号仍保留。签名、包名、SDK、桥和数据等拒绝条件不放宽。

## 验收矩阵

| 范围 | 已验证结果 |
| --- | --- |
| 普通/Remote实际页面入口 | 同一主动作；APK优先、资源下载/取消/待重启、保存失败重试、旧桥、APK授权、具体校验错误、Markdown安全渲染和受限外链通过 |
| 布局 | 360×800、320×568无横向溢出，底部按钮可见，保存期间关闭与系统返回不会离开面板；MuMu补充不支持color-mix时的背景回退 |
| Node | 550项通过，覆盖选择顺序、保存失败传播、刚输入草稿落盘及旧功能回归 |
| Android真实重启 | 独立API36通过实际UI调用原生下载器，下载/验签/解压真实签名资源；隐藏普通页面拒绝保存时取消重启，PID不变；重试后新主进程打开Remote并启用r1，实际聊天草稿保留；恢复内置页面也自动重启 |
| 原生校验回归 | Node/Android ECDSA互通、兼容、安全解压、健康/回退及APK升级跳过过期资源通过 |
| 构建和安装包 | rc.2页面、Debug/AndroidTest/Release构建及lint通过；原证书/原包名、code13、Android9、非调试、包内资源和公钥核验通过，Debug回放类/路径及私钥不在Release中 |
| MuMu用户入口 | officialtest从code12覆盖code13，UID10196及首次安装时间保持；实际新面板公网检查通过，过期r1跳过。仅安装及检查，不代表MuMu已下载/启用r2 |
| MuMu独立验收入口 | `.updaterestarttest`、显示名「DSHM 更新验收」，独立UID/数据；本地HTTP回放的签名r2通过实际UI下载、验签、解压，一键重启后新进程激活r2。供用户再走流程时仅重置该新建验收UID，不清日常officialtest |

原生全流程在独立Debug UID使用本地资源HTTP响应回放，签名、下载、解压、桥和接力进程保持真实实现。APK查询在页面层回放为最新版，避免公开APK包名与测试UID不符；没有模型调用或电脑授权操作。Release源码集不含Debug Application/回放入口。测试不外推所有厂商、物理手机或公网资源安装。

MuMu验收包由 `-PupdateRestartDemo=true` 构建Debug变体，包名与名称隔离，资源回放只接受两个明确的测试UID；其APK查询返回空列表，不冒充公开APK兼容。`DshmApplication`和`AppUpdates`提供默认保持原行为的构造工厂，Debug重载仅存在于Debug源码集。r2由本地私钥签名、目标为独立验收UID/code13，文件放入该UID的cache，不捆绑私钥或上传GitHub。日常App安装的是原签名非调试Release，资源仍只从原固定公开来源检查。

复验：`node scripts/check-unified-updates-web.mjs`；独立API36使用 `node scripts/verify-update-restart-android.mjs`，仅允许emulator-5556/rc21test，先把签名测试资源放入该Debug UID的 `cache/web-restart-fixture`。历史两个页面脚本统一转到此检查。原生校验使用 `webUpdatesOnly` instrumentation。证据在忽略目录 `artifacts/unified-updates/`。

早期长驻instrumentation会在目标进程退出时连带清理同包接力进程，失败不计通过；改用不附着instrumentation的实际页面驱动后通过。一次并发启动instrumentation打断驱动、系统UI卡顿及lint缩进失败保留日志，不计通过，最终顺序复验通过。

本地code13未公开；本次公开版使用code14以支持覆盖此候选。用户此前为MuMu接入的电脑HTTP代理及ADB20809映射仍保持，体验结束后按前次记录恢复。本轮不投放r2。
