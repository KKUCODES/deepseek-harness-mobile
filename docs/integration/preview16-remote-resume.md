# preview.16 Remote 回前台恢复与最近会话

维护角色为 DSHM 手机端维护者，最近核验日期为 2026-11-13。本地候选从 `v0.1.0-preview.15`（`38646b5`）分支开发，版本 `0.1.0-preview.16`（code26）。

## 回到前台

Remote 原生活动恢复时通知当前页面。已连的页面通过现有只读 `remote.negotiate` 检查电脑能否回应，健康时保留原载体、会话和订阅。探测超时或载体已断开时，立即尝试现有恢复流程，之后继续沿用有退避的重试。重连快照若只含最新消息，原会话补读当前阅读锚点所需的历史。取消连接和权限失效仍结束恢复意图。Android 后台存活由系统管理。

入口见 [RemoteActivity](../../android/app/src/main/java/dev/dshmobile/validation/RemoteActivity.kt)、[RemoteApp](../../src/RemoteApp.jsx) 和 [RemoteTransport](../../src/remote-transport.mjs)。

## 再次打开会话

主视图离开时最多保存 3 个最近会话，每个最多 24 组且序列化上限为 512 KiB，有效期 10 分钟。缓存随绑定运行环境释放，或由删除会话、权限清理和清理缓存事件移除。快照只保存消息渲染数据和阅读锚点，不持有 Session 引用、审批、待发送动作或附件字节。临时显示阶段只读，原会话就绪后插件和操作仍由原 Session 驱动。

重进时先呈现可用快照，同时重新建立官方 `session.follow`。如果读者正在查阅更早记录，原会话通过 `loadThrough` 补齐该位置所需的历史，再交接给同一虚拟列表。跟随最新时自动跟到新内容。冷读、超大记录、过期和进程重启继续沿用正常加载。

入口见 [会话选择](../../src/remote-session-view.mjs)、[最近会话缓存](../../src/remote-recent-chat.mjs) 和 [历史列表](../../src/ui/RemoteHistoryList.jsx)。

## 验证范围

- `node scripts/verify-preview15-history.mjs --recent-chat` 及 `--alpha2` 通过。真实列表和原 Session 服务接收合成协议，覆盖冷读、缓存优先显示、最新回合接入、旧锚点、草稿保持及 follow 断线重建。
- `node scripts/verify-remote-app-recovery.mjs` 覆盖健康连接、探测失败、载体断开及撤权。原历史终页、连续 24 次历史分页与返回优先级回归通过。Node 583 项、Android release 构建和 lint 通过。
- MuMu 主实例原签名覆盖安装后 UID 与首次安装时间保持。连现有官方 DSH `0.2.1-alpha.2`，实际验证后台返回原会话、返回列表再次进入、电脑关闭后保留可见消息、电脑重启后同进程恢复。缓存先于网络展示的时序由受控浏览器用例验证。
- 本轮未在反馈用户的小米设备实测。MuMu 现有电脑插件为 `0.1.81-latest.0`，较大的合成历史在该组合仍返回 `response_too_large`，改用能正常读取的现有测试会话完成实机验证。

## 隔离工作区的 Lexical 构建修复

从独立工作区借用 DSH 编辑器源码时，编辑器和草稿恢复函数曾分别载入原目录与工作区的 Lexical，导致普通草稿也能触发引用恢复提示。[构建规则](../../scripts/mobile-lexical.mjs)将这组依赖统一从手机工作区解析，[Web 构建](../../scripts/build-web.mjs)要求产物只包含一份运行时。

签名 APK 内的 Remote 资源已逐字节匹配构建产物。MuMu 原签名覆盖安装后 UID 和首次安装时间保持，回到同一工作区的同一条 `Greeting (1)` 后提示消失，编辑区显示空草稿。设备草稿未清理或重写，未从 App 私有存储读取原始记录。非空文字、引用恢复和异常草稿仍由双 SDK 重进回归与原编辑器专项覆盖。
