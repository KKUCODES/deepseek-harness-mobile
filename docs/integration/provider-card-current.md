# 模型设置卡片扩展

- 状态：已接入；官方、未配置内置、新自定义和已有提供方入口，以及配置/凭据状态更新均通过实际 Android 验证。不代表完整模型设置或任意第三方插件兼容。
- 维护角色：项目协作 Agent；核验日期：2026-09-27。
- 原契约：[slot-contract](../../../deepseek-harness/packages/client/ui-settings-models/src/client/slot-contract.ts)。`settings.models.provider-card` 按 settingsNs 分发，root 作用域，owner 为 provider/configured/keyConfigured。未保存的自定义草稿没有目录行，不分发扩展。

## 当前实现

手机 [RemoteProviderCard](../../src/ui/RemoteProviderCard.jsx)在官方设置、已有其他提供方和新增提供方页面使用同一组件；[根插槽](../../src/remote-plugin-slots.jsx)提供明确的无会话作用域，沿用外层缩放。无注册项、无管理权限、连接失效或未协商 providerCards 能力时不读取或显示卡片。配置、凭据状态或目录事件使旧投影失效，切换路由/连接和卸载取消旧请求。

采用 Host 只读投影，而非开放通用 settings/credentials：前者增加一个小型协议和生命周期校验，后者会扩大第三方界面的凭据与任意设置访问范围。当前方案保留原插槽 owner，但不伪装完整原设置包已可加载。

[Host 实现](../../../plugin/src/provider-card.ts)从原目录决定配置坐标，读取有效配置与凭据 describe，只返回公开目录和两个布尔状态；不读取或返回 Key 内容、凭据引用、headers 或完整配置。手机只能提交 provider 路由，网关和 Host 分别要求管理权限；异步读取前后核对服务、配置、目录与凭据版本，拒绝混合快照。原错误文本脱敏；注册凭据引用拒绝。

需要配套插件 **0.1.67**、新版网关和 APK。本机均已安装，DSH 已重启加载。源码参考检出保持只读。

## 实际证据

- 协议严格字段及真实 HTTP/WS/SQL 管理拒绝：[后端 3 项](../../../backend/artifacts/provider-card-gateway-tests.log)。Host 投影、保留引用保护、过期/取消和适配权限：[插件 36 项](../../../plugin/artifacts/provider-card-adapter-tests.log)。测试替身不替代下述实际服务。
- 完整浏览器回归：[报告](../../artifacts/provider-card-regression.log)，覆盖原 root 插槽、卡片显示、外层缩放、收权及卸载。Web 构建与 [Android assembleDebug/lintDebug](../../artifacts/provider-card-android-build.log)通过。
- 15:39 UTC MuMu 正式电脑设置，经真实电脑独立插件与模块通道：[实际报告](../../artifacts/provider-card-live-android.json)。官方卡片配置/Key布尔状态、llm-deepseek坐标、无会话作用域通过；内置 amazon-bedrock 草稿显示未配置和原 llm-pi-ai 路径，取消不保存；footer交互和600→372px缩放通过。Android返回后草稿保持，页面错误为空。
- 15:40 原 CLI 卸载临时插件：[卸载报告](../../artifacts/provider-card-removed-android.json)，footer与provider-card均消失，原表单保留。15:41收回管理权限后点击真实重新连接：[收尾报告](../../artifacts/provider-card-cleanup-android.json)，设置拒绝、扩展不显示、聊天授权和草稿保留。
- 前两次等待失败分别保留在 [重启前](../../artifacts/provider-card-before-host-restart.json)和[重启后](../../artifacts/provider-card-after-restart-failure.json)。后者再次检查时已在聊天页，稳定后重跑通过；未据此声称已证明具体竞态根因。本次不发送模型请求，不写入模型设置或 Key。

## 自定义提供方与实时状态补验

15:45 UTC 在当前 APK、真实网关与 DSH 上，使用同一独立扩展插件和临时自定义提供方完成[实际验证](../../artifacts/provider-card-state-run-android.json)。驱动复用[真实模型发现脚本](../../scripts/verify-model-http-discovery-android.mjs)的 `run --key --cards`，以独立报告/清理文件隔离既有证据：

- 自定义草稿尚未保存时没有扩展；保存后立即显示正确 root owner 和原 llm-pi-ai 路径。查看已有提供方设置、关闭后重新进入，卡片保持。
- 原生密码窗口仅写入本次随机测试值，电脑真实 HTTP 模型发现携带匹配值；插件卡片无需重开或手动刷新便更新为已配置 Key。原生移除后自动回到未配置，后续发现未复用旧凭据。
- 修改临时提供方显示名称并保存后，卡片自动显示新名称；[截图](../../artifacts/provider-card-state-updated-android.png)已核对。无模型推理请求，不操作日常 DeepSeek 配置。
- 临时 Key 和提供方已移除、测试 HTTP 服务关闭，[清理记录](../../artifacts/provider-card-state-live-seed.json)为 cleaned=true。独立扩展插件通过原 CLI 卸载，15:46 收回管理权限并真实重连，[设置拒绝报告](../../artifacts/provider-card-state-blocked-android.json)确认聊天及草稿保留，页面/资源错误为空。

本轮只增加实际验收断言，无产品源码或 APK 变化。完整 models/plugins 包的通用服务依赖继续按[兼容目录](./plugin-compatibility.md)跟踪；该独立扩展的通过不能外推其余第三方界面。网页转发仍暂缓、范围待确认。
