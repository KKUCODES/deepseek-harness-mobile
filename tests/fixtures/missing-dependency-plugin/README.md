# 缺少插件依赖的实际验证

- 状态：2026-09-26 在本机 DSH 与 MuMu 通过，临时包已卸载；维护角色：项目协作 Agent。
- `client.js` 声明一个未提供的服务，原 Cordis 加载器应保持 waiting，不能调用 apply。它不伪造认证、模型或远端协议。
- 验证入口为手机「Remote 选项 → 电脑插件」：显示处理建议，展开后列出实际缺少的服务，关闭后保留聊天草稿。
- 验证脚本：[verify-plugin-dependencies-android.mjs](../../../scripts/verify-plugin-dependencies-android.mjs)。需要 `DSHM_RUN_LIVE=1`、`DSHM_ANDROID_SERIAL`，并从已授权的专用 Remote 聊天启动；卸载后使用 `--removed` 核对入口消失。
- 完整证据及边界：[当前验收](../../../docs/integration/remote-current.md#插件依赖诊断2026-09-26)。本夹具通过不代表任意第三方插件兼容。
