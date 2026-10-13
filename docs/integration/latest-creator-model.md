# 新版模式创作实际验收

- 状态：固定源码和 npm 发布入口的真实模型生成、手机单次安装审批、新聊天选择并使用、历史重入和 Host 重启恢复均通过；两个临时模式/文件已清理，原聊天历史与其他模式目录保持。其他完整管理范围继续。
- 维护角色：DSH Mobile 项目协作 Agent；核验日期：2026-10-06。
- 目标：DSH `0.2.1-alpha.1`、源码 `5badb15009ae1756c3afe0ae0cef1faafc290ccc`、候选插件 `0.1.76-latest.0`。沿用 `.latesttest` App、原绑定和独立测试 home；不改日常 DSH/App，不读取 Key。
- 来源：[原组合 skill](../../../plugin/artifacts/latest-source-check/packages/preset/agent-preset/skills/editing-cordis-compositions/SKILL.md)、[原模式声明](../../../plugin/artifacts/latest-source-check/packages/preset/agent-preset/src/index.ts)、[persona](../../../plugin/artifacts/latest-source-check/packages/preset/persona/src/index.ts)、[原安装工具](../../../plugin/artifacts/latest-source-check/packages/boot/plugin-manager/src/tools.ts)、[实际 Android 驱动](../../scripts/verify-latest-live-creator-android.mjs)。

## 边界与实际链路

从手机电脑设置的“让 Agent 帮我创建预设模式”进入原 Creator 模式。只在已有测试工作区生成最小 bundle：真实模型加载原 skill，写入 `package.json` 和 `cordis.patch.yml`，再调用原 `plugin_manager install_bundle`。验收器不代写文件、不制造工具事件，不替换安装器；批准前核对恰好两文件、无链接、无依赖或脚本、单个 preset 和内置 persona 声明。

电脑设置入口只在准备时临时授予设备管理权限，进入 Creator 后立即收回。后续工具安装走会话中的单次审批，设备管理保持 false；会话保持 workspace-write，没有全局 Full access 或脚本豁免。新模式不是默认模式，只在手机新建的专项会话选择使用。

## 固定源码实际结果

| 阶段 | 证据 |
| --- | --- |
| Creator 着陆及原历史保护 | [prepare](../../../plugin/artifacts/latest-runtime-check/latest-live-source-creator-prepare-reconnect-reuse.json)：原空白 bootstrap 会话被 Creator 复用，模式 cordis；原主测试会话旧事件完全不变，临时管理已收回。 |
| 唯一真实请求 | [start](../../../plugin/artifacts/latest-runtime-check/latest-live-source-creator-start.json)：从手机实际输入框发送一次；记录请求前的原序号，未知发送不自动重试。 |
| 单次审批 | [approve-recover](../../../plugin/artifacts/latest-runtime-check/latest-live-source-creator-approve-recover.json)：原调用 `call_00_ET_R7gd8jjRRPRBzEGi5iBm5123`，手机“允许一次”；只有一个审批决定。 |
| 实际安装 | [observe-poll-1](../../../plugin/artifacts/latest-runtime-check/latest-live-source-creator-observe-poll-1.json)：原 seq38 返回 `applied`、包版本 1.0.0、pnpm 退出0。工具序列仅 skill/write/write/plugin_manager；四个结果均成功。 |
| 新聊天实际选用 | [use-start](../../../plugin/artifacts/latest-runtime-check/latest-live-source-creator-use-start.json)、[use-observe](../../../plugin/artifacts/latest-runtime-check/latest-live-source-creator-use-observe.json)：原会话 `session-e930f0c6-485c-4230-bedc-26869a2e4144`，手机选择新模式，电脑投影一致；实际回复完整中文/emoji标记，无工具调用、无重复用户消息。 |
| 历史重入 | [replay](../../../plugin/artifacts/latest-runtime-check/latest-live-source-creator-replay.json)：退出后重入，创作与使用会话逐事件不变，手机显示同一回复、输入框空。 |
| 实际 Host 重启 | [baseline](../../../plugin/artifacts/latest-runtime-check/latest-live-source-creator-cold-baseline.json)、[cold-replay](../../../plugin/artifacts/latest-runtime-check/latest-live-source-creator-cold-replay.json)：18140 正常停止后从实际 pnpm 入口恢复为24932；46/18条完整原事件及全部投影值保持，各只追加一个原 `session/end-seed` 空恢复标记，模式目录和回复保持。 |

## 保留的失败与驱动修正

准备期间管理权限变化会使手机明确断开，必须核对绑定指纹后点击原“重新连接”。首次等待页面超时及后续原 bootstrap 身份验证过严分别记录在 [首次准备](../../../plugin/artifacts/latest-runtime-check/latest-live-source-creator-prepare.json)、[重连准备](../../../plugin/artifacts/latest-runtime-check/latest-live-source-creator-prepare-reconnect.json)；均已收回管理权限，没有发送模型请求。

发送前导航又暴露三处驱动问题：空白会话被最近列表隐藏；“新聊天”实际创建新会话，不能用它复用已登记 Creator 会话；React 导航提交期间暂时没有祖先模型 fiber。当时两个误建空白会话都没有发送消息；发布验收随后由原 Creator 入口复用其中一个，另一个无消息空会话保留作为失败现场。最终对已核对的空白 Creator 使用手机同一 `RemoteModel.select` 原选择接口恢复，最终身份/标题仍严格核对；真正 Creator 入口、模式选择和发送由实际手机 UI 验证。这不是用户通过最近列表打开空白会话的证据。

[首轮 observe](../../../plugin/artifacts/latest-runtime-check/latest-live-source-creator-observe.json)因读取目录时误加 `request` 参数失败，真实模型已到审批；修正为原无参 list，不重发消息。[首轮 approve](../../../plugin/artifacts/latest-runtime-check/latest-live-source-creator-approve.json)误找不存在的“允许本次执行”超时；恢复前核对原审批没有决定、相同 callId 和内容，点击真实“允许一次”。失败报告不改为通过。

## npm 发布入口与清理

发布 Host18652 使用同一测试 home/网关/App，原设置 Creator 入口实际复用 `session-26466367-bee0-4fec-bf2c-48aeb6506b7f`。生成另一独立包 `@local/dshm-creator-15199d02-bcec-44b2-91ed-e61ec6517007`，工具调用仍严格为 skill/write/write/plugin_manager；[prepare](../../../plugin/artifacts/latest-runtime-check/latest-live-creator-prepare.json)、[start](../../../plugin/artifacts/latest-runtime-check/latest-live-creator-start.json)、[原调用观察](../../../plugin/artifacts/latest-runtime-check/latest-live-creator-observe.json)保留实际来源。

模型没有声明可选 `order`，首轮[批准验证失败](../../../plugin/artifacts/latest-runtime-check/latest-live-creator-approve.json)发生在授权之前。依据原 schema 改为允许缺省 order、仍拒绝未知字段；[同一待定审批恢复](../../../plugin/artifacts/latest-runtime-check/latest-live-creator-approve-recover.json)只决定原 `call_00_1X3uTa3p2UIJDgQJ23m76294` 一次，没有重发。原 seq37 返回 applied、1.0.0、pnpm退出0，见[安装与目录](../../../plugin/artifacts/latest-runtime-check/latest-live-creator-observe-poll-1.json)。

手机实际新建 `session-eb792d4a-7351-46dd-9cd0-5bf14b4be7b5` 并选用新模式，[use-start](../../../plugin/artifacts/latest-runtime-check/latest-live-creator-use-start.json)、[use-observe](../../../plugin/artifacts/latest-runtime-check/latest-live-creator-use-observe.json)证明单次用户消息、完整固定中文/emoji回复、工具0、原 completed 与空草稿。[replay](../../../plugin/artifacts/latest-runtime-check/latest-live-creator-replay.json)核对两段原历史；[baseline](../../../plugin/artifacts/latest-runtime-check/latest-live-creator-cold-baseline.json)后正常停止18652并恢复为36900，[cold-replay](../../../plugin/artifacts/latest-runtime-check/latest-live-creator-cold-replay.json)核对45/18条原事件与全部投影不变，各只增加一个原空恢复标记。原模式和手机回复保持。

两种模式最后通过真实手机“电脑插件 → 管理电脑插件 → 卸载”及原确认弹窗移除。临时授予管理后重新核对绑定；逐个核对模式目录消失、profile依赖已移除、四段原历史不变、其他模式目录严格相同。只删除与原模型 write 参数逐字节一致的两个文件，再以非递归 rmdir 移除已空的自有目录，不递归删工作区。

清理[首轮失败](../../../plugin/artifacts/latest-runtime-check/latest-live-creator-cleanup.json)是原分页请求漏传 throughSeq，发生在授管理/卸载之前；补齐原投影序号后[cleanup-recover](../../../plugin/artifacts/latest-runtime-check/latest-live-creator-cleanup-recover.json)通过。finally 收回管理权限，[finish](../../../plugin/artifacts/latest-runtime-check/latest-live-creator-finish.json)从手机原导航恢复主测试会话、workspace-write、空草稿和无iframe。测试聊天作为验收证据保留，日常 App/Key 不变。

独立只读 [audit creator-mode](../../../plugin/artifacts/latest-runtime-check/latest-live-original-files-audit-creator-mode.json)最后核对原工作区8对象的所有者、DACL/保护/Low标签及字节仍与原完整快照一致；正常发布 Host在线。本核对不是31源码文件/355资源的最终恢复证明。

## 复验与剩余范围

在手机项目执行，必须连接指定 `emulator-5554`，且配套独立 Host 状态与实际 PID 在线：

```text
node scripts/verify-latest-live-creator-android.mjs prepare
node scripts/verify-latest-live-creator-android.mjs start
node scripts/verify-latest-live-creator-android.mjs observe
node scripts/verify-latest-live-creator-android.mjs approve
node scripts/verify-latest-live-creator-android.mjs use-start
node scripts/verify-latest-live-creator-android.mjs use-observe
node scripts/verify-latest-live-creator-android.mjs replay
node scripts/verify-latest-live-creator-android.mjs cold-baseline
```

准备前设置 `DSHM_ANDROID_SERIAL=emulator-5554`。报告独占创建，原发送/审批标记阻止未知结果重发；只读追加观察可以使用 `observe --poll-N`。正常停止和恢复原测试 Host 后执行 `cold-replay`，检查实际新 PID、原事件前缀及唯一允许的恢复标记；不因等待超时重启 Host。

完成两种入口后再从手机执行 cleanup，失败需核对原阶段及实际授权/目录状态，不能盲目重发操作；本轮只因第一轮在修改之前失败而使用 cleanup-recover。finish 负责恢复主测试聊天。

当前不能据此勾选 KKC-24 整个“完整模型/预设/电脑管理”标准：其他安装/升级/取消/重启未知结果及剩余管理契约还需核对。31源码文件及355客户端资源最终精确恢复亦继续，日常旧版支持声明保持。
