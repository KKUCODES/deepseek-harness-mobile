# 手机插件升级夹具

与 [第二版](../live-upgrade-v2/package.json)组成同名包 `@dsh-mobile/upgrade-verification` 的两个真实版本。仅注册 turnTail 局部卡片和内存按钮计数；不注册 Host 服务、不读写项目或发送消息。测试包不能作为应用依赖保留。

在各自目录运行 `npm.cmd pack --pack-destination ../../../artifacts --ignore-scripts`，生成 0.0.1、0.0.2 两份归档。临时授予测试手机管理权限后，从实际 App 的「Remote 选项 → 电脑插件 → 管理电脑插件 → 添加插件」依次安装两版。该入口支持提交同名包的新版本；不是电脑 CLI 升级。

每次安装后核对电脑返回的管理详情版本、卡片 `data-version` 和按钮点击结果。升级后应没有旧版卡片，卡片数量不重复，原聊天标题和草稿保持。安装完成弹窗的标题会变为「已安装」，不能继续用「添加插件」定位它。最后从同一手机管理页卸载、确认卡片消失，收回管理权限并重连，确认管理入口拒绝而原聊天仍可进入。

2026-10-03 正式 MuMu 已通过，详见[实际报告](../../../artifacts/plugin-upgrade-run-android.json)与[验收范围](../../../docs/integration/plugin-management-current.md#手机发起同名插件升级2026-10-03)。报告由实际 Playwright Android 会话逐步断言后生成；不是自动构造的协议响应。两个调试等待超时保留在报告 preparationNotes，不代表产品失败或重复安装。
