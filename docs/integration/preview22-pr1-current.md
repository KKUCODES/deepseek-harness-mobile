# preview.22：接入 PR #1 与兼容修复

- 状态：preview.22/code32已公开，Actions44578968831构建、lint、原签名与发行成功，公开附件及MuMu覆盖安装已核验；维护：DSHM 手机端维护者；核验：2026-11-20。发行详情见[构建与下载](../releases.md#已核验范围)。
- 任务：[KKC-132](https://linear.app/kkcodes/issue/KKC-132)；历史审查：[PR #1 对照](./pr1-rc3-review-2026-11-19.md)。
- 来源：[PR #1](https://github.com/KKUCODES/deepseek-harness-mobile/pull/1)、下列源码、回归脚本和本机验收证据。

## 分支与边界

`feature/preview22-pr1` 从 rc.3 分支 `e08cdbc` 创建，包含 preview.21 的 `7567430`。保留贡献者 `c5fa95c` 原提交，本地合并提交为 `30ecfc0`；没有把 PR 的 preview.20 整树替换当前代码。旧插件适配分支未纳入，不修改 DSH、桌面插件或中转。

版本元数据为 preview.22/code32，配套插件仍为0.1.88。本轮仅回归当前官方 DSH 0.2.2-rc.3；旧版本尽量维持代码兼容，不准备旧运行环境。本地接入保留PR原提交，不单独执行GitHub默认分支合并；本地阶段与后续云端发行分别验收。[发行任务KKC-133](https://linear.app/kkcodes/issue/KKC-133)。

修复提交`0e6a349`及发行文档提交`f5fc3b4`已沿独立分支推送，标签`v0.1.0-preview.22`固定`f5fc3b4097a1fc3e8dbdda643e3004ad5d2ba1af`；没有推进main或原rc.3分支。

## 三个兼容缺口

1. [正文图片预取](../../src/remote-markdown-images.mjs)直接使用当前 DSH 的 `parseGfmWithMath`、`parseFileLink`，与原 Markdown 渲染器共用语法及解码语义。含空格、Windows 反斜杠和编码 `#` 的本地路径均有真实正文入口回归；已解码路径不再次截断。会话文件授权、外链拒绝及图片预算不变。
2. 临时读取失败提供明确的“重试加载图片”入口；恢复连接或连接世代变化后受控重试。离线排队、并发去重、释放订阅/URL 均保留；格式、超限或权限拒绝不自动重读。正常重画不触发无限请求，旧世代错误晚于重连返回也能恢复。
3. [最近会话缓存](../../src/remote-recent-chat.mjs)恢复工具参数时优先使用官方 `PartialArguments`，保留流式未闭合 JSON 中已经完成的字段和子调用。旧 SDK 没有该类时才沿用原只读适配，未改公开 Session。

比较了继续维护自建语法/参数视图与复用原实现；选择后者以减少两端语义差异。首页分组是 API v1 的可选新增投影/动作，[SDK 类型](../../packages/plugin-sdk/index.d.ts)与[公开接口说明](../plugins/remote-home-api.md)同步，旧首页插件仍可使用平铺字段。

## 最早页定位根因

原 .21 和组合 PR 各重复5次均有3次失败，不应归责于 PR。进一步隔离跟踪确认：新前插组估算约240px，实际约2170px；原锚点暂时不在虚拟挂载范围内，单帧恢复找不到它，随后错误采集中间布局。高度测量和末页按钮移除又使列表起点改变，最终跳回前一组，偏差约1930px。

[RemoteHistoryList](../../src/ui/RemoteHistoryList.jsx)现在额外挂载正在恢复的一个原锚点，等待实际高度和列表起点连续稳定后才重新采样；恢复期间不让虚拟器独立补偿。可见锚点由实际 DOM 判定，避免使用滞后一帧的虚拟位置。读者的触摸、滚轮和按键立即取消旧恢复，继续由原 `ScrollFollow` 控制跟随。

仍为官方 Session 连续历史、仅 DOM 虚拟化，不引入双向数据窗口、触顶自动分页或新操作栏。已读取数据的内存仍随历史增长。该根因解释本轮可复现的最早页失败，不代表已取得用户那条偶发长会话和发送失败的完整现场；[KKC-129](https://linear.app/kkcodes/issue/KKC-129)继续保留现场复验范围。

## 验收矩阵

| 入口 | 实际结果 |
| --- | --- |
| Node | 616/616通过；图片路径/重试、rc.3原参数实例及原有用例保持 |
| 正式主聊天/旁栏，原 Session＋受控协议 | 各24批连续历史；主聊天16次往更早滚动、6种等待期滚动，偏差0；sending、缓存重进/重连通过 |
| 最早页重复回归 | 连续6次通过，锚点偏差均0；覆盖末页按钮移除、200条记录、草稿、读者主动滚动及有界DOM |
| 正式 Markdown 主聊天/旁栏 | 三种路径实际显示；原预览放大和系统返回通过；主聊天显式重试、离线/重连恢复通过 |
| 首页与公开插件入口 | 浅/深色、320/390px、分组折叠/搜索、会话进入与返回通过；默认/插件首页的总览选区和区内直接新建通过 |
| Web / Android | 当前 rc.3 CI Web构建、release/debug构建、lintRelease通过 |
| MuMu 原正式包 | 原签名从code30覆盖至code32，原1条本地聊天、Key配置状态及电脑配对保留；没有清数据 |
| MuMu RemoteActivity 回放 | 主/旁栏图片、预览返回、失败恢复通过；最早页两次分页偏差0和约0.27px，草稿及有界DOM保持 |
| MuMu 真实电脑连接 | 现有rc.3验收包保留配对、连接6条会话，实际点击发送并收到新的OK回复；系统文件选择器安装首页0.7.1，通过信任确认，真实工作区分组可展开 |
| MuMu 插件管理真实入口 | 手机插件页停用后回退默认首页，再启用恢复独立首页，原分组偏好保持；最终保持插件启用与真实电脑连接 |

浏览器和原生受控回放使用实际组件及官方模型，数据为合成；真实电脑发送另行核验，二者不混称。原正式包的另一台配对电脑当前离线，未替换其配对；真实连接使用已有的 `rc3test` 验收包，没有新增 App 身份。

旧 `verify-129-native.mjs` 本轮叠加普通聊天 Activity，导致 Remote 在后台而自动点击超时，不能记为六次后台回归通过。本轮另用可见 RemoteActivity 的原生按钮点击验证实际发送；保留旧脚本局限，不把自动化超时直接判定为产品回归。

## 本机证据与复验

忽略目录 `artifacts/preview22/` 保存 `node-tests.txt`、`build-web.txt`、`build-android.txt`、`terminal-fixed-{1..6}.txt`、`history-main.txt`、`history-aside.txt`、`markdown-{main,aside}.txt`、`home-design.txt`、`workspace-create.txt`、`sending.txt`、`recent-web.txt`、`native/*.json`、`real-reply.json`、`real-home.json`、`real-fallback.json` 及截图。调试跟踪仅存忽略目录，未进入产品代码。

主要入口：[终页回归](../../scripts/check-remote-terminal-history.mjs)、[图片真实入口回归](../../scripts/check-remote-markdown-images.mjs)、[历史页面载体](../../scripts/verify-preview15-history.mjs)、[MuMu回放](../../scripts/verify-preview22-android.mjs)。Android回放默认使用现有 `rc3test` 包；不用于改写用户正式包的配对。

本地阶段原签名 APK：`F:/dshm-rc3-validation/DSHM-0.1.0-preview.22.apk`，SHA256 `e05dccf785dce21e1a80a6f8d2ff2201b64e900e6770bb9f3da30dbd4b5959f3`；证书SHA256 `d97f5b68c6a327f4ae455834ba30f23ce7b64f2eeafd8a222e0e74b0a998e51e`。这是本轮产品工作树构建的本地候选；后续Actions从发行提交重新构建，云端APK摘要与匿名下载结果另记入发行文档，不混用本地候选摘要。
