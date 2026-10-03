# 电脑基础设置实时同步

- 状态：已实现并通过当前 MuMu 真实链路；完整 Remote 未完成。
- 维护角色：项目协作 Agent。
- 最近核验：2026-10-01。

## 行为与边界

### 保存失败后的草稿可见性（2026-10-02）

**重读失败补验（16:41 UTC）**：原修复保留保存失败草稿，但显式重新读取失败仍会隐藏表单。新增[回归先复现](../../artifacts/settings-read-error-before.log)，现统一保留最近显示的表单、保留草稿并依据服务快照失效状态禁止提交；首次没有成功读到值时仍不伪造表单。[专项](../../artifacts/settings-read-error-after.log)、[完整页面回归](../../artifacts/settings-read-error-full-web.log)通过；[设置服务检查](../../artifacts/settings-read-error-service.log)继续覆盖未知写入不重发、同连接重读不能解除未知结果限制。电脑接口、鉴权和自动重试策略未改。

[新版构建/lint](../../artifacts/settings-read-error-android-build.log)通过并覆盖安装MuMu；[16:41:24Z实际报告](../../artifacts/settings-error-android.json)重验正式入口本地无效输入、修正可提交及电脑原值读取，管理权限已收回。连续保存/读取失败由隔离协议页面回归证明，本轮没有在Android真实Host注入读取故障，不将正常重读冒充失败恢复验收。

原页面在非自动操作失败时调用setView(null)，连本地输入校验失败也会隐藏表单。现保存失败保留表单和本轮草稿；服务已使快照失效时禁用提交并要求重读，仅本地校验失败则允许修正后提交。用户明确重新读取仍采用电脑现值，不自动合并旧草稿，也不重试写入。来源：[正式组件](../../src/ui/RemoteComputerSettings.jsx)、[服务快照边界](../../src/remote-settings.mjs)。

- [修改前回归](../../artifacts/settings-error-before.log)实际断言表单数量0失败；[修改后专项](../../artifacts/settings-error-after.log)验证本地无效输入可修正、Host版本冲突仍显示草稿但禁止重复保存、重读电脑值及原同步行为。[完整页面回归](../../artifacts/settings-error-full-web.log)通过，为隔离协议回放，不冒充实际Host版本冲突。
- [Web构建](../../artifacts/settings-error-web-build.log)、[Android构建/lint](../../artifacts/settings-error-android-build.log)通过，新版已覆盖安装日常MuMu。
- [实际脚本](../../scripts/verify-settings-error-android.mjs)16:37:54Z从普通聊天进入真实Remote电脑设置，清空回复上限并点击保存，本地schema拒绝后输入框保留；填回原值后提交可用，但未点击有效保存，重新读取确认电脑原值未变。[Android报告](../../artifacts/settings-error-android.json)无页面错误，临时管理权限收回、聊天授权保持。
- 准备失败分别保留[首次欢迎声明遮挡](../../artifacts/settings-error-onboarding-first.json)和[已有Remote页面被误当新页面](../../artifacts/settings-error-existing-page.json)；均已收权。驱动补齐正常欢迎与已有页面/重连前置后通过，未强制点击穿透遮挡。本次真实Android不包含电脑版本冲突或写入结果未知的故障注入。

手机打开电脑设置时监听原 `settings/document-updated` 事件，重新读取受限的 DeepSeek 基础字段。读取期间再次变化会丢弃旧响应并补读。手机有未保存草稿时保留草稿、提示电脑已变化并禁用保存；用户明确点击重新读取后采用电脑最新值。事件本身不触发写入，不扩大管理权限或凭据接口。

采用原事件失效后重读，而不是新增轮询：复用现有协议，减少空请求；保留草稿而不自动合并，避免用户未确认的覆盖。当前事件范围较宽，其他设置变化也可能要求重新核对，这是一项保守限制。

## 验证

- [页面实现](../../src/ui/RemoteComputerSettings.jsx)、[翻译](../../src/ui/translations.mjs)。
- [页面回归](../../scripts/check-key-state-sync.mjs)覆盖自动刷新、草稿保留、禁止旧值保存、在途旧响应丢弃；[完整页面报告](../../artifacts/scalar-settings-sync-full-web.log)通过。这是隔离协议测试，不能替代真实 Host。
- Web 构建与 Android assembleDebug/lintDebug 通过，见[构建日志](../../artifacts/scalar-settings-sync-android-build.log)。新版 APK 已覆盖安装。
- 11:38 UTC 在 MuMu API32 正式 Remote 入口，通过[专用 Host 插件](../../tests/fixtures/live-scalar-settings-plugin/index.js)调用原设置服务，把等待输出超时从 300000 临时改为 301000/302000，手机不重开页面自动收到更新。手机草稿 303000 保留且保存被禁用，明确重新读取后显示 302000。
- [Android 验证脚本](../../scripts/verify-scalar-settings-android.mjs)、[实际结果](../../artifacts/scalar-settings-sync-android.json)证明自动刷新、草稿保护、手动核对、恢复及聊天草稿保留，无页面错误。
- 恢复为 300000 且移除用户覆盖，保持原默认继承；[Host 恢复结果](../../artifacts/scalar-settings-host.json)。测试插件已卸载，管理权限已收回，原聊天授权保留。没有操作用户 Key 或发起模型请求。

这证明基础设置同步，不代表原模型插件整页已兼容；该范围仍见[原模型设置差异](./model-settings-compatibility.md)。
