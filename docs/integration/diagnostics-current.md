# 正式问题诊断入口

2026-10-25：本地新版 Remote 已增加[连接诊断与最近记录](./remote-diagnostics-current.md)，原本页说明的版本报告迁到其中「应用与兼容信息」。普通聊天原入口保持。以下为既有功能的历史验收依据，不表示新 Remote 菜单仍直接显示此报告。

- 状态：已实现、安装；MuMu 三个正式入口通过。完整 A06 与 Remote 未完成。
- 维护角色：项目协作 Agent；核验日期：2026-09-27。
- 来源：[共享窗口](../../src/ui/SupportDiagnostics.jsx)、[字段投影](../../src/support-diagnostics.mjs)、[原生公开版本](../../android/app/src/main/java/dev/dshmobile/validation/AppInfo.kt)、[实际入口脚本](../../scripts/verify-support-diagnostics-android.mjs)。

## 用户入口与范围

普通聊天「设置 → 问题诊断」；Remote 在线时「Remote 选项 → 电脑连接 → 问题诊断」，未连接时「连接选项 → 问题诊断」。先查看快照，可重新读取或主动复制；不会自动上传、分享给别人或调用模型。复制的是显示的 JSON 报告，本次不提供文件保存或直接发送功能。

App 版本/版本代码、Android API 与 WebView 版本来自原生只读 `app.info`。两个桥沿用原主框架/origin 检查，并限定正式页面 URL、空参数；Remote HTML 预览活动时拒绝。原生实现不读取账户、身份、设置、日志或凭据。Remote 报告额外读取当前页面已有连接阶段、是否绑定、已协商协议/DSH版本/管理授权以及插件状态计数，不触发电脑数据请求。

采用逐字段白名单而非导出整个状态再正则脱敏。插件名称/依赖错误、地址、指纹、设备/Host ID、路径、异常正文、聊天/草稿、Key/token 均不进入报告。未知信息保留 null/unknown，离线不会把旧能力冒充当前协商结果。普通模式不读取 Remote 状态。诊断信息是读取时快照，刷新前不会随聊天输出变化。

## 验证与修复

- [3 项字段测试](../../tests/support-diagnostics.test.mjs)覆盖敏感哨兵排除、普通模式不输出传入的 Remote 信息、未知/错误字段不原样透传及实际五段 WebView 版本。完整 Node 408 项通过，见[日志](../../artifacts/support-diagnostics-node.log)。Web 构建、Android assembleDebug/lintDebug 通过。
- 第一轮实际入口发现 MuMu WebView 为 `110.0.5481.154.1`，四段限制误丢版本。按系统包元数据修复有界数字版本解析，[原失败](../../artifacts/support-diagnostics-version-before.json)保留。
- 第二轮普通和在线报告通过，但 Android 返回只处理会话自己的窗口，导致诊断窗口未关闭、底层聊天被返回。现 [RemoteActivity](../../android/app/src/main/java/dev/dshmobile/validation/RemoteActivity.kt)先沿顶层原生 dialog.cancel 契约关闭窗口；嵌套菜单保留先关闭菜单的处理。没有对所有插件弹窗另造关闭协议。[原失败报告](../../artifacts/support-diagnostics-back-before.json)保留。
- 15:03 UTC [最终实际报告](../../artifacts/support-diagnostics-android.json)三组均通过：原生版本真实、普通报告不含 Remote、在线为 transport2/DSH0.1.6-alpha.2/management=false/插件29 active+24 mobile+6 waiting；主动断开仍能取得本机版本，电脑能力为 null、插件为 unknown。每组复制、刷新、Android返回通过；重新连接后原空草稿保留、errors为空。[在线截图](../../artifacts/diagnostics-remote-connected.png)已检查，无横向溢出。
- 本轮不访问或修改 Key，不发送模型消息、不启用管理授权、不改变电脑服务。最终设备 active、management=false。复制会按用户动作写入剪贴板；没有读取旧剪贴板内容。

## 限制

实际测试环境为 MuMu Android12/API32；未覆盖所有 Android/WebView 版本、桥不可用时的实际设备故障和完整读屏。原生拒绝条件由源码核对，不能冒充本次已重新跑全部 origin/HTML 隔离攻击用例。报告版本不包含构建哈希或第三方插件清单，不能单凭相同版本号证明字节相同。A06 的其他迁移/恢复要求仍按收尾表处理。
