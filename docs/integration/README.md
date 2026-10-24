# 正式接入清单

preview.12已公开[双窗口预算、虚拟渲染、正文分段与原生恢复](./remote-history-window-current.md)及Remote网页外链修复；云端签名与[匿名下载核验](../releases.md#已核验范围)通过，连续历史回归和限制独立记录。

当前优先入口：[未修改官方 DSH 的真实 Android 核心链路](./official-plugin-only.md)。正常 Web 安装/重启、新手机菜单、真实回复、允许/拒绝审批、新建与重连通过；其他扩展继续按纯插件矩阵核验，下方补丁载体仅保留历史。

手机提问回答、完成命令结果和普通后台双流/重读也已有实际证据；[当前功能矩阵](../../../plugin/compatibility/latest-upstream/official-feature-matrix.md)是纯插件范围的逐项入口。

新版 [Electron 桌面与原 Android](../../../plugin/compatibility/latest-upstream/electron-runtime.md)已通过同一会话真实消息及原只读命令的实时双流/历史重入，无控制台编码问题在独立候选修复。原发布/App/会话及源码/完整构建/355 资源精确恢复归档；完整新版支持仍待其余有效验收。

当前收尾从[逐项验收与明确缺口](./completion-audit.md)进入；下方开工快照保留历史依据，不用于覆盖最新实现状态。

DSH `0.2.1-alpha.1` 的独立候选从[新版兼容验证](./latest-compatibility.md)进入，不以旧版验收代替新版全链路检查。

新版原管理器的[安装回执核对与退出恢复](./latest-install-recovery.md)补齐受限查询；两种入口的下载/脚本/修复中完整DSH树退出及修复中取消有实际手机证据。手机修复超时的原分类、失败详情和进程停止也已通过，未知结果、磁盘残留、清理与失败分别记录；普通安装脚本的手机超时主文案、原分类、失败回执及进程退出在两种入口另已通过。仅Host退出、手机安装摘要冷恢复及完整范围继续。

新版[真实模式创作](./latest-creator-model.md)已在固定源码和 npm 发布入口通过模型生成、手机审批安装、新聊天选用、历史重入和 Host 重启恢复；临时模式/文件已清理，其他完整管理范围继续。

- 状态：2026-09-23 用户确认页面并授权普通聊天完整真实接入。KKC-15/16 普通聊天功能已接入并本地验收，见[当前实现与证据](./ordinary-current.md)；其余批次继续推进。
- 维护角色：DSH Mobile 项目协作 Agent。
- 最近核验：2026-09-23。
- 需求基线：[架构与功能清单](../../../docs/project-knowledge/knowledge/decisions/2026-09-23-mobile-architecture-and-scope.md)、[页面地图](../design/页面地图与核心流程.md)、[页面预览](../design/ordinary-preview/README.md)。

## 实施方式

沿用 DSH 模块化派生 + TypeScript/React/Cordis + Kotlin/WebView。复用已有真实服务，将确认过的布局与共用视觉组件接到服务上；保留独立设计预览供对照。不要直接给预览的内存 reducer 加网络调用，也不要将普通聊天和 Remote 的运行上下文合并。

两种路径比较：直接改预览最快看到真实数据，但会把演示状态、伪造的设备/插件目录和单页模式切换带入产品，破坏双 origin 隔离；将确认的视觉组件接入真实模块稍多一些整合工作，但可复用原生命周期和测试。采用后者，避免第二套手写 DSH renderer。上游参考检出保持只读，移动适配留手机项目。

本阶段不重做界面风格、不恢复侧边栏新聊天/“电脑任务”副文案、不把开发说明加回正常页面；搜索维持独立页。尚无已审阅页面的完整功能（如工作流、预设高级项）随对应任务补齐必要交互，不因此默默删减首版范围。

## 实施前基础与差距（2026-09-23 开工快照）

| 能力 | 源码事实 | 需要接入或补齐 |
| --- | --- | --- |
| 原生 Key / 请求 | [OrdinaryBridge](../../android/app/src/main/java/dev/dshmobile/validation/OrdinaryBridge.kt)、[OrdinaryNative](../../src/ordinary-native.mjs)已有受限原生入口与真实请求 | 将正式设置/错误反馈接入；Key 不进页面。当前原生仅接受 requestId/model/messages，固定关闭 thinking；预览的模型名称、思考开关不能直接算真实支持 |
| 流与持久化 | [OrdinaryChat](../../src/ordinary-chat.jsx)、[流状态](../../src/ordinary-stream.mjs)、[历史](../../src/ordinary-history.mjs)已有真实多轮/停止、先存后发、事务写入、中断恢复 | 拆出可复用会话逻辑，接新布局、按会话模型、搜索/改名/分支、分页和备份。预览 messages 与真实 turns 结构不同，需显式映射和迁移，不能清库省事 |
| 普通插件 | [真实宿主](../../src/main.jsx)、[输入适配](../../src/ordinary-input.mjs)保留 Cordis/Slots，技术验证已包含主题、语言、输入生命周期 | 正式页面保留插槽、作用域、服务身份；安装源/管理、兼容目录和动态设置待补；不宣称任意插件已兼容 |
| Remote 基础 | [RemoteBridge](../../android/app/src/main/java/dev/dshmobile/validation/RemoteBridge.kt)、[客户端](../../src/remote-client.mjs)已有独立 origin/凭据桥、配对、六方法、基础重连 | 将真实身份、状态和原生导航接入新页面；保留普通聊天与 Remote 隔离 |
| Remote 完整通道 | [协议白名单](../../../backend/packages/protocol/src/index.ts)当前只有 list/page/follow/control/prompt/cancel；上游 [ClientTransportHooks](../../../deepseek-harness/packages/client/connection/src/client/index.ts)提供 rpc/fetch/openStream/loadBundle 边界 | 接入原 RPC/事件/资源/模块加载及能力协商；手机桥、共享协议、网关和电脑插件同步改造，核对真实 payload 后才编码 |
| 模型/审批/项目 | 目前主要存在于 [Remote 设计预览](../design/ordinary-preview/RemotePreview.jsx)和[聊天详情预览](../design/ordinary-preview/RemoteChatPreview.jsx) | 新建已有工作区聊天、模型双向同步、审批/提问、多端竞争等接真实 Host，不以示例状态代替 |
| 文件/终端/插件管理 | 预览文件是固定样本，管理权限及目录是内存状态；已有协议不含完整资源通道 | 路径与授权、实时输出、最新完整文件、独立管理权限、资源撤销、真实安装与插件图同步 |
| 设置/Android | 现有验证 APK 和基础安全/生命周期代码可复用 | 全局主题/语言、系统文件/分享、通知、返回与键盘、升级和完整恢复；当前预览的主题只影响设置页、语言只影响效果卡 |

模型、API 参数的产品接入前需重新核对官方当前能力；上表记录本地代码，不宣称这些模型或参数永远有效。下表后的初始拆分不代表当前进度；普通聊天的新实现和真实 API 验证见当前实现记录。

## 实施批次与 Linear

Remote 当前工作见[完整接入矩阵与源码边界](./remote-current.md)。KKC-17 已按[七项标准](./remote-channel-current.md)完成本地验收；基础通道测试与真实 Android 纵向证据分别登记。

| 顺序 | 任务 | 功能编号 | 完成判据 |
| --- | --- | --- | --- |
| 1 | [KKC-15 普通聊天真实接入](https://linear.app/kkcodes/issue/KKC-15) | L01–L05、A01 基础 | 从最终 App 入口配置 Key、新建/搜索/续聊/停止/恢复，保存失败、中断和模型能力处理正确；旧历史保留 |
| 2 | [KKC-16 本地插件、附件与备份](https://linear.app/kkcodes/issue/KKC-16) | L06–L08、A02、A06 本地部分 | 实际插件生命周期、附件支持/拒绝与备份导入导出；两种模式不串数据 |
| 3 | [KKC-17 完整 Remote 通道与权限](https://linear.app/kkcodes/issue/KKC-17) | R13、A01–A02 基础 | [七项标准](./remote-channel-current.md)通过本地验收；真实纵向接入、各资源/调用通道撤销及其测试层级分别记录 |
| 4 | [KKC-18 Remote 全操作接入](https://linear.app/kkcodes/issue/KKC-18) | R01–R09、R14–R15 | [八项标准对照](./remote-operations-current.md)按本地范围通过；反馈真实双向写入、冷只读记录、断线及冲突通过，测试数据和临时环境已恢复 |
| 5 | [KKC-19 文件与只读命令](https://linear.app/kkcodes/issue/KKC-19) | R10–R12、R16 | 已按[五项现行标准](./files-delivery-current.md)完成本地验收，任务Done；支持格式、完整文件和只读输出的实际边界见专项。localhost网站转发后续见[KKC-21](https://linear.app/kkcodes/issue/KKC-21) |
| 6 | [KKC-20 Android 设置和恢复](https://linear.app/kkcodes/issue/KKC-20) | A03–A06，整合 A01 | 已按[六项现行标准](./android-experience-current.md)通过本地验收；实际返回/键盘、系统操作、通知/重开恢复、包体/性能与升级的环境边界保留 |

所有 L01–L08、R01–R16、A01–A06 都有归属。批次表示顺序，不缩减首版。KKC-15/16 已完成功能接入，KKC-17/19/20 已完成本地验收；KKC-18 及整体KKC-10继续按[当前收尾表](./completion-audit.md)核对完整 Remote，不把任务建单、预览或单元测试当作正式入口验收。

Remote 门槛沿用已确认架构：真实配对 → 工作区 → 加载真实扩展 → 已有工作区新聊天 → 一次工具审批 → 上传并预览文件 → 撤销后所有通道失效。先以一个受控用例证明通道，再扩展各功能；不得为兼容而直接开放任意本地路由或原生权限。

## 验收与用户介入

[KKC-10](https://linear.app/kkcodes/issue/KKC-10)继续承接完整产品验收清单：每个功能编号列准备条件、操作、预期、证据和未验限制。现有[技术验证记录](../plugin-validation/results.md)与[预览核对](../design/ordinary-preview/flow-audit.md)可作回归输入，不能替代最终入口验收。

开发、构建、自动检查和现有权限范围内的本地验证可继续自主完成。真实 Key 由用户在原生界面配置；需要新设备授权、真实计费测试或无法由工具排查的软键盘问题时再具体说明。不会要求用户把 Key 发到聊天，也不默认延用已撤销的测试设备身份。

维持边界：首版 Android；单电脑；不创建工作区、不提供手机手动终端输入；普通聊天非 Agent。App 进程结束后无推送/唤醒，重开尝试重连，不重放未知写操作。验收以本地网关/MuMu 为主，公网部署和物理手机不增加为前置门槛；真实中文软键盘未通过仍如实记录。
