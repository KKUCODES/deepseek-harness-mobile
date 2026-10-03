# 插件 Worker 实际验收包

仅用于已授权的本机电脑与 MuMu，验完卸载；不进入正式 APK。
不注册电脑服务，不增加协议权限，不读取 Key 或聊天，不执行安装脚本。

原 Host 模块表提供包身份与 rev，Worker 直接从原 package-local chunk 路由加载；线程再通过真实 fetch 读取自身入口脚本，页面只显示状态/字节数/固定标记是否命中，不回传源码或凭据。
Worker 生命周期由插件通过原 Cordis `ctx.effect(() => cleanup)` 终止；当前 Cordis 不提供通用 `dispose` 事件。验收覆盖停用、断开和卸载，不宣称宿主可强制修复任意插件遗漏的清理逻辑。

2026-09-26补充真实撤销：独立测试App启动Worker并读取自身资源，附件已写入私有暂存、原生回执暂缓时，从电脑设备页撤销授权。线程退出、暂存清理、旧授权重连拒绝通过，见[脚本](../../../scripts/verify-file-revocation-android.mjs)与[实际报告](../../../artifacts/file-revocation-android.json)。此项不是Worker资源fetch在途测试。临时包已通过电脑原CLI卸载；手机不需要管理权限。

同日补充[Worker资源在途脚本](../../../scripts/verify-worker-revocation-android.mjs)：仅独立验收App经本机代理，暂缓真实资源响应后从电脑撤销设备，线程退出、暂缓数据清除与重连拒绝通过。[实际报告](../../../artifacts/worker-revocation-android.json)为1个资源分片/4163字节，不泛化为大资源或任意插件；临时包/代理已清理，日常绑定保持。

从手机项目运行 `npm pack ./tests/fixtures/worker-lifecycle-plugin --pack-destination artifacts --ignore-scripts`。
通过手机原管理入口安装并启用，在专用联调聊天启动线程与读取自身资源，完成后从原入口卸载并收回临时管理权限。
