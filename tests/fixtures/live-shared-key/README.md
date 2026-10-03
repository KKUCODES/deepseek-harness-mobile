# 共享 Key 与搜索请求验收夹具

此夹具只用于本机正式 App 验收，不进入产品构建。用手机原插件管理安装生成的 tarball、立即启用。主入口 `index.js` 的 `prepare` 仅在官方/搜索引用都是默认继承且搜索地址没有用户覆盖时生效；临时将两个原设置指向同一个随机新凭据引用，不读取、复制或替换原 Key。

控制文件为项目 `artifacts/shared-key-command.json`，字段来自本轮 `shared-key-host.json`：`id`、唯一 `sequence`、`action`。动作仅有 `prepare`、`inspect`、`search`、`cleanup`；不要重放结果未知的写入。安装后先核对 `fixtureVersion=0.0.3`，再准备。

1. 手机网页搜索原生密码窗口保存 `dshmsharedtestfirst`（公开测试值，不是有效凭据）。手机保存报告里的唯一 loopback 地址；`search` 触发原 `ctx.web.search`，本机端点校验 HTTP 后返回 401。
2. 手机官方 DeepSeek Key 窗口显示已配置；替换为 `dshmsharedtestsecond`，再次搜索验证新值即时使用。
3. 手机移除 Key；搜索在 HTTP 前以 `WEB_PROVIDER_CREDENTIAL_MISSING` 失败。
4. 手机搜索地址恢复默认；`cleanup` 恢复引用的默认继承、移除测试凭据。手机检查原 Key 重新显示已配置。
5. 卸载夹具，确认 `disposed/cleaned`，收回管理权限、重连原聊天、核对草稿与拒绝入口。

脚本只记录公开测试输入及布尔值，不记录请求头的实际值。端点固定拒绝，不伪造网页或模型回复。此用例证明正式设置写入和原服务真实 HTTP 路径，不能证明外部搜索成功或模型自然调用工具。

发生并发设置变化时，清理会拒绝覆盖；应先核对状态。正常卸载自动尝试清理并关闭端点。若 DSH 意外终止，需按本轮报告的唯一引用检查恢复，不应重新安装另一个夹具覆盖原证据。首次两版断言失败保留在 artifacts 的 first/second-run 报告；0.0.3 使用独立包名且报告明确运行版本，不能把同名包再次安装等同 Host 模块已经刷新。
