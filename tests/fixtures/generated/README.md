# 原 DSH 接口定义回放样本

引用菜单回归挂载 [session-reference-remote.mjs](./session-reference-remote.mjs)，2026-09-28 原样复制自实际构建的 `F:/Program Files/deepseek-harness/packages/context/session-reference/lib/typert.remote-client.js`，SHA-256 `5AB606102843DDF2AEF316960CE925F738FEBBE32A9B26EA1B6C8D513E127420`。来源为原 [session-reference](../../../../deepseek-harness/packages/context/session-reference/src/index.ts)，只在测试中挂载，不进入产品包或替代已认证电脑接口。

文档差异回归挂载 [workspace-files-remote.mjs](./workspace-files-remote.mjs)，2026-09-26 原样复制自当前实际构建的 `F:/Program Files/deepseek-harness/packages/api/workspace-files/lib/typert.remote-client.js`，SHA-256 `8A60F11589668443B2D8A4CD4717E94771AB406E950BE9AE4BA5DE801E3CB6E9`。声明来自[原文件服务](../../../../deepseek-harness/packages/api/workspace-files/src/index.ts)，仅在显式 `--documents` 回放中挂载；不手写或改写原方法表，测试文件内容仍是隔离夹具。

子会话回归挂载 [subagents-remote.mjs](./subagents-remote.mjs)，原样复制自 `F:/Program Files/deepseek-harness/packages/subagent/subagent/lib/typert.remote-client.js`，SHA-256 `3e1fba793e0922f837c635d56a63677bacf5dad1256c5c7ad71b01eb4c629e91`。来源为同一基线的 [Subagent 控制声明](../../../../deepseek-harness/packages/subagent/subagent/src/index.ts)，仍仅用于回放；产品从已认证电脑加载实际接口。

- 状态：仅用于离线测试，不进入产品包。
- 维护角色：DSH Mobile 项目协作 Agent。
- 核验日期：2026-09-24。
- 反馈接口补充核验：2026-09-25，仍只用于离线测试。
- 来源：本机实际运行的 DSH `0.1.6-alpha.2` 构建，`F:/Program Files/deepseek-harness/packages/api/{session,workspace}-controller/lib/typert.remote-client.js`。复制生成文件，保留生成器声明，仅规范化文件换行。
- 源码基线：`ddefc45fbc7f8e46dd73185e68295696d1297887`；接口声明分别位于只读参考的 [session-controller](../../../../deepseek-harness/packages/api/session-controller/src/index.ts) 和 [workspace-controller](../../../../deepseek-harness/packages/api/workspace-controller/src/index.ts)，许可见 [MIT LICENSE](../../../../deepseek-harness/LICENSE)。

| 文件 | 本地样本 SHA-256 |
| --- | --- |
| [session-remote.mjs](./session-remote.mjs) | `faf56e023b2537b3e4c3ad10b394acca415b867e0bc5a82373716f01c78fd78b` |
| [workspace-remote.mjs](./workspace-remote.mjs) | `d2e8380a7bdd3a0d4c7ec1efe16db2a419ad404f7e9cdabdf359cc6187b448c2` |

[测试装配](../remote-core.mjs)把这两份真实生成贡献安装到原 Gateway，测试参数映射、命名空间、取消及会话操作。载体的消息和数据明确是测试夹具，不代表真实电脑联调。

技能目录回归另挂载 [commands-remote.mjs](./commands-remote.mjs)，原样复制自同一实际构建的 `packages/interaction/commands/lib/typert.remote-client.js`，SHA-256 `19783415466cb498a5dd560c6568716cad39223e2587fc0a16350b591fe051ab`。声明来源为原 [commands](../../../../deepseek-harness/packages/interaction/commands/src/index.ts)。该接口的 `list` 只有 Agent 参数，没有 AbortSignal 参数；测试使用原生成定义验证真实 wire 映射与参数数目，避免造假方法表。

产品从已认证电脑的模块图导入 `dsh-api-remotes/client`，不会读取本机安装路径，也不会使用本目录作为缺少接口定义时的兜底。升级基线时重新核验并更新样本，不手写或猜测 descriptor。

反馈回归另挂载 [message-feedback-remote.mjs](./message-feedback-remote.mjs) 和 [session-feedback-remote.mjs](./session-feedback-remote.mjs)，来自同一实际构建的 `packages/feedback/{message-feedback,command-feedback}/lib/typert.remote-client.js`。SHA-256分别为 `1107D440ECFEDC9540EF205C4574C1E87C1E724E5FF97B87759FDFD02D5E1DB7`、`87583D97B580E30DA529AD078A6AC14CB319F202A083A9133C51EECB2DC50AC7`。这些生成文件未改写协议，测试回放不连接真实遥测收集端，不作为真实提交/撤回的验收证据。

目标回归挂载 [goals-remote.mjs](./goals-remote.mjs)，复制自同一实际构建的 `packages/goal/goal/lib/typert.remote-client.js`，SHA-256 `35df09d652b62cc8a3edf5ed9a4f0e84fbfdffbf9c67f778024dfe97758bd7a9`。声明来源为原 [Goal](../../../../deepseek-harness/packages/goal/goal/src/index.ts)。这些方法没有取消参数；写入使用原 `{id,revision}` 身份，读取包含实时 activation，测试不手写方法定义。

权限目录回归挂载 [permission-presets-remote.mjs](./permission-presets-remote.mjs)，复制自同一实际构建的 `packages/interaction/permission-presets/lib/typert.remote-client.js`，SHA-256 `dfe760cb96266352939a8bf15e4ab6c638fd4f633a877789080e096b7d2a3d38`。声明来源为原 [permission-presets](../../../../deepseek-harness/packages/interaction/permission-presets/src/index.ts)。写入复用上面的 commands 生成接口，参数是 agentId、line、submittedAttachments，取消信号不进入 wire；保留原业务结果，不手写假接口。

Agent 模式回归挂载 [agent-presets-remote.mjs](./agent-presets-remote.mjs)，复制自同一实际构建的 `packages/preset/agent-presets/lib/typert.remote-client.js`，SHA-256 `64e83eee657f88e09a8f56848e85f7500266fec6ee9d449235e4833c257989a8`。声明来源为原 [agent-presets](../../../../deepseek-harness/packages/preset/agent-presets/src/index.ts)。原 `select` 只有 Agent 和模式 id，没有取消参数；产品只放行目录和当前空白会话选择，不开放预设文件管理。
