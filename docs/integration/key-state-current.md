# Remote 电脑 Key 状态同步

- 状态：共享设置组件已修复；新版 MuMu 通过独立提供方的真实电脑事件验证。
- 维护角色：项目协作 Agent；核验日期：2026-09-28（香港时间）。
- 来源：[设置组件](../../src/ui/RemoteComputerKey.jsx)、[受限 Key 服务](../../src/remote-key.mjs)、原[凭据契约](../../../deepseek-harness/packages/credentials/credentials/src/index.ts)。

## 行为与取舍

此前组件只在挂载、手动重读和原生操作后读取状态。电脑另一入口修改凭据时，手机可能一直显示旧的“已配置”。现订阅原 settings/document-updated、credentials/reference-updated、llm/adapters-updated 事件，失效后清除旧状态并通过既有只读接口重新核对。官方 DeepSeek、网页搜索和其他提供方共用此组件。

相比定时轮询，原服务事件可避免持续请求，并与现有提供方卡片使用同一失效依据。事件不携带 Key 值，也不触发原生写入。读取中发生变化时丢弃旧结果并合并重读；原生操作中的变化等操作结束后只读核对，不自动重复写入。切换连接/服务时取消旧操作，等待释放锁后再读；断线和收权不发起新读取。

## 验证与限制

| 范围 | 证据 |
| --- | --- |
| 生产页面回归 | [修改前失败](../../artifacts/key-state-red.log)，[完整回归通过](../../artifacts/key-state-full-web.log)。[检查脚本](../../scripts/check-key-state-sync.mjs)覆盖外部失效、迟到读取、原生操作中合并重读、无自动写入和收权卸载。浏览器协议隔离回放不替代真实电脑验证。 |
| 服务与构建 | [5项服务测试](../../artifacts/key-state-unit.log)、[Web构建](../../artifacts/key-state-build-web.log)、[Android assemble/lint](../../artifacts/key-state-build-android.log)通过。新APK覆盖安装MuMu，未清数据。 |
| 实际电脑→手机 | [17:23 UTC报告](../../artifacts/key-state-live-android.json)：独立电脑插件通过原 ctx.credentials.set/unset 修改专用随机引用，手机在自有“电脑设置 → 其他模型提供方”自动更新两种状态，没有重新打开或点击手动刷新，原草稿保留、页面错误为空。 |
| 清理 | [17:24清理](../../artifacts/key-state-cleanup-android.json)确认测试Key不存在、专用提供方已移除；原CLI卸载插件，[Host最终状态](../../artifacts/key-state-host.json)为disposed/cleaned。临时管理权限收回，日常聊天授权保留。 |
| 收权后正式入口 | [17:25报告](../../artifacts/key-state-denied-android.json)确认重新连接后电脑设置拒绝访问、无Key操作入口、原草稿保留。 |

[Host验收插件](../../tests/fixtures/live-key-state-plugin/index.js)只操作本次随机创建的提供方/引用，命令文件固定在本项目 artifacts，没有网络接口或任意凭据目标。测试值在Host内生成，不读取用户Key，不发起模型请求。实际验证使用[Android驱动](../../scripts/verify-key-state-android.mjs)的live/cleanup/denied三个阶段。

前两次连接等待失败记录保留在[第一次](../../artifacts/key-state-first-connection-android.json)和[第二次](../../artifacts/key-state-second-connection-android.json)。当时adb reverse列表为空，网关未收到手机请求；恢复tcp:8787到电脑tcp:8787后正式用例通过。此映射仅用于本机MuMu联调，不是公网网页代理。收权脚本首次使用了另一个页面的提示文案，[选择器失败](../../artifacts/key-state-denied-selector-android.json)保留，按实际电脑设置文案修正后通过。

此次手机实际验收为独立提供方，不替换用户官方/共享Key；官方及网页搜索由共享组件和回归覆盖，不宣称真实Key替换已验。截图未滚动至Key区域，不作为状态变化的视觉证明，以实际入口定位断言为依据。完整Remote仍见[收尾验收表](./completion-audit.md)，localhost网页转发仍待定。
