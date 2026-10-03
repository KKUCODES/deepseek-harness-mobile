# 手机外观在普通聊天与 Remote 之间同步

## 首版 A05 验收结论（2026-10-03）

状态：按已确认的本地 Android 范围通过；维护角色：项目协作 Agent。需求来自[原始 A05 条款](../../../docs/project-knowledge/knowledge/decisions/2026-09-23-mobile-architecture-and-scope.md)。以下逐项读取报告字段、驱动断言和当前入口核对，并非本次重跑全部历史场景。

| 条款 | 实际依据与边界 |
| --- | --- |
| 字体缩放 | [当前安装版](../../artifacts/appearance-shortcut-android.json)在正式 Remote 聊天核对 12px/17px 正文字号，同一页面及原草稿保持，恢复14px；手机设置权威，不写电脑偏好 |
| 深浅主题 | 当前安装版浅/深色与字号联合检查；[真实系统切换](../../artifacts/phone-appearance-system-android.json)核对两模式、显式偏好优先和恢复；[系统栏](../../artifacts/system-bars-android.json)、[原生窗口](../../artifacts/native-dialog-theme-entries.json)另有实证。冷通知入口报告含恢复失败，不算整轮通过，恢复依据为独立[恢复报告](../../artifacts/phone-appearance-restore-cold-android.json) |
| 触屏与窗口交互 | 正式 App 点击导航、关闭及主题选择；[原插件叠层](../../artifacts/global-panel-live-android.json)核对背景 inert、焦点与 Android 返回，[清理](../../artifacts/global-panel-cleanup-android.json)通过；下节 TalkBack 另有实际滑动/双击 |
| 键盘避让 | [普通聊天](../../artifacts/standard-ime-ordinary-android.json)、[配对页](../../artifacts/standard-ime-android.json)及[绑定聊天](../../artifacts/standard-remote-ime.json)实际键盘缩小可视区且输入框可见；[MuMu 中文候选](../../artifacts/mumu-chinese-input.json)真实提交“你好”，[清理报告](../../artifacts/mumu-chinese-input-cleanup.json)确认草稿清空、原搜狗恢复。普通/Remote 共用 MobileWebWindow |
| 可访问性 | 模型入口/关闭/模型选项、用户消息、模型回复、文本文件和审批理由有 TalkBack 自带输出记录；实际拒绝回传电脑通过，见[具体范围](#talkback聊天与审批理由2026-10-03)。原生朗读环境已恢复 |

上述具体条款不再作为开放的功能缺口。未观测到网页内联 composition、未录制扬声器音质、API28–29独立系统栏专项和任意第三方插件/所有文件格式读屏保留为环境与覆盖边界，不将其扩张为新首版门槛。出现具体缺陷再重开；这不代表 R01–R16 或完整产品已经交付。

### 手机外观入口不依赖电脑授权

核对当前正式入口发现：电脑设置的管理权限保护连带隐藏了原 general 页中的手机外观跳转。现由[共享 Remote 菜单](../../src/ui/RemoteWorkspace.jsx)直接提供“外观与语言”，使用已有 `appearance.settings` 原生入口打开同一手机设置页。没有放开电脑设置插槽、增加原生能力或复制配置表单；原 general 页中的跳转保持兼容。

[修复前页面检查](../../artifacts/appearance-shortcut-before.log)找不到入口；[修复后](../../artifacts/settings-access-web.json)覆盖聊天/离线/首页无需管理权限，以及原电脑设置拒绝、断线草稿/inert、收权移除。最初新测试提前保存了未准备的能力快照，导致后续旧断言缺少computerSettings；已修正测试准备顺序。三项外观状态测试、Web/APK构建和lint通过。

[真实 MuMu 报告](../../artifacts/appearance-shortcut-android.json)先确认电脑设置仍拒绝未授权访问，再直接打开手机设置、切浅色17px/深色12px并返回同一聊天；[浅色画面](../../artifacts/appearance-shortcut-light.png)与[深色画面](../../artifacts/appearance-shortcut-dark.png)已核对。原跟随系统14px、聊天和空草稿恢复，无页面alert；没有发送消息或改Key/管理授权。实际base.apk哈希与当前[交付产物](../../artifacts/delivery-artifacts-current.json)一致。本次未实际断开网关，离线路径由页面回归证明。

## TalkBack 聊天与审批理由（2026-10-03）

状态：正式 MuMu Remote 的消息、文本文件和审批操作已取得实际读屏输出；审批理由缺失已修复。维护角色：项目协作 Agent；最近核验：2026-10-03。

原审批组件的可聚焦区域仅命名为“审批详情”，TalkBack 跳过其中理由而直接进入拒绝按钮。首次补 `aria-describedby` 虽通过 Chromium 辅助树检查，实际 Android 仍只读名称，因此最终将原理由（缺省时为原工具升级说明）并入区域名称。采用[手机构建适配](../../scripts/mobile-approval-accessibility.mjs)，仅修改这一属性，保留原组件、工具详情及决定逻辑；参考检出不修改，上游匹配点变化会明确构建失败。正式主/旁栏使用同一原插件组件。

| 实际路径 | 证据 |
| --- | --- |
| 用户消息 | [TalkBack 滑动朗读受控会话的完整用户消息](../../artifacts/talkback-chat-user.png) |
| 模型历史回复 | [原测试会话回复的实际语音输出](../../artifacts/talkback-chat-reply-after-delay.png)；未新发模型请求 |
| 电脑文本文件 | [文件正文 DSHM_APPROVAL_OK 的实际语音输出](../../artifacts/talkback-file-content.png)，从工作区文件入口打开，返回聊天后草稿保持；未改文件或下载 |
| 审批理由 | [最终名称方案读出完整理由](../../artifacts/talkback-approval-name.png)；[首次 description 方案仍只读“审批详情”](../../artifacts/talkback-approval-fixed-reason.png)，失败证据保留 |
| 决策回传 | TalkBack 滑动选择拒绝并双击，卡片移除；[原 Host 服务结果](../../artifacts/talkback-approval-fixed-host.json)中最终请求 `e5bba539-7379-47ff-8365-6c2dc9d98560` 为 `rejected`。专用夹具调用原 ApprovalService，不执行模型或工具 |

[页面回归](../../artifacts/original-interactions-web.json)覆盖原插件辅助名称、批准/拒绝、提问优先级、会话隔离、取消、计划决定和草稿；[修复前断言失败](../../artifacts/approval-description-before.log)与 Android 首次方案失败分别保留。Web、APK 构建及 Android lint 通过；最终 APK 已覆盖安装，[产物报告](../../artifacts/delivery-artifacts-current.json)与[安装包核对](../../artifacts/talkback-chat-installed.json)一致。回复/文件截图来自修复前 APK，用户消息/最终审批来自新版；没有把旧截图当成新版全流程重跑。

[设备清理](../../artifacts/talkback-chat-cleanup-android.json)确认七项辅助设置恢复、临时 TalkBack/TTS 卸载、原搜狗输入法、原聊天、空草稿、原模型和无弹窗/错误；[电脑清理](../../artifacts/talkback-approval-cleaned-host.json)确认专用会话归档、工作区登记移除，夹具包已卸载。测试连接默认浅色覆盖已解除，页面恢复系统深色；没有修改手机主题偏好、Key 或设备授权。

以上是 TalkBack 自带输出层与真实手势/电脑结果证据，未录音或判断扬声器音质，不外推任意第三方插件、PDF 扫描图 OCR 或全部文件格式读屏。完整 Remote 仍按[收尾表](./completion-audit.md)核对。

## TalkBack 语音输出核验（2026-10-03）

状态：正式 MuMu Remote 模型入口、关闭按钮及模型名称已取得 TalkBack 自带语音输出记录；完整聊天读屏流程仍未验收。维护角色：项目协作 Agent。来源：[引擎诊断](../../android/app/src/androidTest/java/dev/dshmobile/validation/OfflineSpeechProbe.kt)、[诊断结果](../../artifacts/offline-speech-probe.log)、下列实际截图和[清理报告](../../artifacts/talkback-speech-cleanup-android.json)。

临时安装本机系统镜像提取的官方 TalkBack/TTS。引擎列出的离线语音不一定已安装：第一次中文候选返回网络超时，失败保留在[原始结果](../../artifacts/offline-speech-declared-before.log)。诊断改为排除 `KEY_FEATURE_NOT_INSTALLED` 并选择已安装的 zh-CN/en-US 语音，固定测试文字分别生成169724/107564字节音频，完成回调成功。临时音频已删除；该结果只证明引擎合成，不替代应用读屏验证。

通过系统设置打开 TalkBack 自带“显示语音输出”，[开关画面](../../artifacts/talkback-speech-enabled.png)已核对。在日常专用会话内，通过实际 Android Tab/Enter/Escape 按键聚焦、打开和退出模型弹窗：

| 实际位置 | TalkBack 输出与证据 |
| --- | --- |
| 聊天模型按钮 | [输出“选择模型，当前 DeepSeek-V4-Pro”](../../artifacts/talkback-speech-model.png) |
| 模型弹窗关闭按钮 | [输出“关闭”](../../artifacts/talkback-speech-model-option.png)；该截图已移至下一控件，输出存在时序延迟，不能以截图焦点位置推断文字归属 |
| 当前模型选项 | [输出“DeepSeek-V4-Pro”](../../artifacts/talkback-speech-current-option.png) |
| 退出弹窗 | [返回同一聊天与模型入口](../../artifacts/talkback-speech-return.png)，未选择其他模型、未输入或发送消息 |

证据来自 TalkBack 自带覆盖层，非网页 DOM 名称或自制朗读器；没有录制或听辨扬声器声音，不推断音质、发音正确性或其他控件。上次实际滑动/双击的证据仍见下节；本次以键盘焦点为主，不替代完整消息、审批和文件阅读流程。

七项系统设置按[本次基线](../../artifacts/talkback-speech-baseline.json)逐项恢复，临时 TalkBack/TTS 已卸载。[复查脚本](../../scripts/verify-talkback-cleanup.mjs)新增 `--speech-probe`，独立保存此次报告、不覆盖上次证据；实际复查确认设置、原搜狗输入法、原聊天、空草稿、DeepSeek-V4-Pro、无弹窗与无错误均保持。生产代码/APK、Key、电脑配置和授权均未修改。

## 共享聊天错误提示语言（2026-10-03）

状态：已修复，浏览器正式组件回归和新版 MuMu 主会话实际入口通过。维护角色：项目协作 Agent。来源：[RemoteWorkspace](../../src/ui/RemoteWorkspace.jsx)、[翻译表](../../src/ui/translations.mjs)、[浏览器检查](../../scripts/check-workspace-error-language.mjs)、[Android 语言检查](../../scripts/verify-model-labels-android.mjs)的 `--workspace-errors` 分支。

原页面把 notice、state.error、文字/附件草稿错误直接输出，英文界面仍显示中文。现在三处统一调用现有精确翻译表；未收录的 Host/插件错误原样保留，不翻译模型回复或用户输入。主聊天与嵌入旁栏均使用同一组件；本次实际 Android 只验主聊天，未单独重验旁栏。

[修复前失败](../../artifacts/workspace-errors-before.log)明确复现英文页面的中文错误；[修复后报告](../../artifacts/workspace-errors-web.json)验证通知提示、两类草稿保存提示、中英往返、草稿保留及未知插件原文。草稿读取/清理的固定提示亦补入字典，但未在本轮实际模拟 Android 存储故障。

[Web 构建](../../artifacts/workspace-errors-web-build.log)、[Android 构建与 lint](../../artifacts/workspace-errors-android-build.log)通过，覆盖安装新版 APK。[实际准备](../../artifacts/notice-missing-language-prepare-android.json)由原 Host 独立内存 Session 产生提醒；卸载夹具、重启 DSH 使目标消失，再点击真实系统通知。[语言结果](../../artifacts/workspace-errors-android.json)证明设置页切英文/中文后错误正确、原聊天和未发送草稿保持、无页面错误；[英文画面](../../artifacts/workspace-errors-en-android.png)已检查。最初脚本停在 Remote 首页而未进入指定会话，安全前置断言失败，见[原记录](../../artifacts/notice-missing-language-prepare-entry-before.json)；进入专用会话后重跑通过，不属于产品错误。

[清理结果](../../artifacts/notice-missing-language-cleanup-android.json)确认16条原回复保留、测试草稿清空、通知消费和临时插件移除；junction经路径核验后移除，DSH按原参数恢复PID8400，日常授权active、management=false。未调用模型或修改电脑配置。当前安装包哈希与本地产物相同，见[交付文件](./local-delivery.md)。README用途与操作方式未改变，用户变化已记录Changelog；完整Remote仍按[收尾验收](./completion-audit.md)推进。

## TalkBack 实际手势与清理（2026-10-03）

状态：正式 MuMu Remote 模型入口的实际读屏手势通过；真实朗读内容仍未取得可核验记录，不声明完整 TalkBack 验收。维护角色：项目协作 Agent。来源：[运行中的服务记录](../../artifacts/talkback-gesture-service.txt)、本次原生窗口操作截图、[清理复查脚本](../../scripts/verify-talkback-cleanup.mjs)及[实际清理报告](../../artifacts/talkback-cleanup-android.json)。

MuMu 原来没有 TalkBack/TTS。临时从本机现有 Google Play API36.1 系统镜像提取官方预装 TalkBack 16.0.0.777931756 与 Google TTS，安装后启用；系统 dumpsys 确认 TalkBack 绑定、触摸探索打开。原生窗口中左右滑动将绿色焦点依次移到发送、模型按钮，双击模型按钮实际打开模型弹窗，再定位关闭按钮并双击返回专用聊天。没有切换模型、发送消息或修改电脑配置。

开启 TalkBack 自带“显示语音输出”后没有观察到可核验的朗读文本，窄范围日志也没有输出。这里仅记录真实焦点/手势激活，不用 DOM 辅助名称替代实际朗读、不外推所有消息和插件窗口。此前只有网页焦点测试的限制保留。

六项辅助功能/TTS设置按[测试前基线](../../artifacts/talkback-settings-baseline.json)恢复（原缺失字段恢复为缺失），TalkBack 与 TTS 均已卸载，临时标准模拟器已关闭。只读复查确认原搜狗输入法、空草稿、专用会话、DeepSeek-V4-Pro 模型及无弹窗/错误均保持；日常设备 active、management=false。源码下载曾超时，未执行或安装下载源码；实际测试使用系统镜像内已有包。

## 模型按钮辅助名称（2026-10-03）

状态：已修复并安装新版，正式 MuMu 主会话中英文入口通过；维护角色：项目协作 Agent。来源：[共享 RemoteWorkspace](../../src/ui/RemoteWorkspace.jsx)、[翻译表](../../src/ui/translations.mjs)、[完整页面回归](../../scripts/check-model-accessibility-labels.mjs)、[Android 驱动](../../scripts/verify-model-labels-android.mjs)。

原 Remote 工具栏用中文模板拼接 aria-label，即使界面切为英文，读屏仍取得中文“选择模型，当前…”或“查看模型，当前…”。现复用普通聊天已有翻译模板，并补只读子会话模板；模型名称作为插值原样保留，不修改模型选择或权限。主聊天和旁栏沿用同一 RemoteWorkspace。

[修复前](../../artifacts/model-labels-before.log)完整页面在英文辅助名称断言失败；修复后[回归报告](../../artifacts/model-labels-web.json)覆盖父/子会话中英文名称、中文模型名不翻译、子会话选项仍禁用及父草稿保留。最初回归在打开模型页后仍期待旧投影值，受到夹具目录重读影响，已将语言断言置于打开目录之前；不把这个测试时序当产品问题。

[Web 构建](../../artifacts/model-labels-web-build.log)、[APK 构建及 lint](../../artifacts/model-labels-android-build.log)通过，新 APK 覆盖安装到 MuMu。正式设置切英文→Remote 专用聊天→切中文的[实际报告](../../artifacts/model-labels-android.json)确认 `Choose model, current: DeepSeek-V4-Pro` 与中文名称正确，模型名、原草稿、原语言保持且无页面错误；[英文画面](../../artifacts/model-labels-en-android.png)已检查。未调用模型或改电脑配置，日常设备 active、management=false。脚本的冷启动进程/新 WebView 等待曾失败，失败报告保留，修正等待后退出0。

本项证明 App 暴露的辅助名称，不能代替 TalkBack 真实朗读与手势流程；实际 Android 子会话英文辅助名称未在本批重验，子会话分支由完整页面回归覆盖。README 功能和使用方式未改变，用户可见变化记入 Changelog。

## 中文候选输入与键盘避让（2026-10-03）

状态：MuMu 正式 Remote 聊天的真实拼音候选输入及键盘避让通过；维护角色：项目协作 Agent。来源：[输入观察脚本](../../scripts/observe-mumu-chinese-input.mjs)、[实际报告](../../artifacts/mumu-chinese-input.json)、[输入截图](../../artifacts/mumu-chinese-input.png)、[清理报告](../../artifacts/mumu-chinese-input-cleanup.json)。

用户解锁并授权继续操控后，原搜狗仍报告键盘高度为零。临时安装官方 [Trime v3.3.12](https://github.com/osfans/trime/releases/tag/v3.3.12) x86_64 包，使用应用专属存储；下载 SHA256 为 `0b32fee993f59614a69269aea30f817c48d7af67b35965ed4eb107e68340ee6f`，与发布资产一致。在专用聊天空草稿中通过实际软键盘依次点击 nihao，再选择“你好”，没有发送消息。

实际编辑器接收可信 `beforeinput/insertText`，数据为“你好”。键盘弹出前后 visualViewport 高度由843.20降至553.07，输入区域底部553.07，未被键盘覆盖。该输入法当前配置在自身候选栏组词，未产生网页 compositionend；因此这里只证明真实候选提交与避让，不声称覆盖浏览器内联 composition 过程。TalkBack 仍未实际验证。

首次脚本只监听旧节点/`input`，错过编辑器的 `beforeinput`；另有空编辑器残留换行的断言问题。失败报告保留为 [旧监听记录](../../artifacts/mumu-chinese-input-stale-listener.json)和[缺少 beforeinput 记录](../../artifacts/mumu-chinese-input-missing-beforeinput.json)，不能据超时判定 App 中文输入失败。脚本现按 document 捕获真实编辑器事件并单独报告是否观察到 composition；产品代码未改。

测试文字已用软键盘删除，空草稿、原会话、无页面 alert 及键盘收起均已复查；原搜狗输入法恢复，临时 Trime 禁用并卸载。既有 Android 身份 active、management=false，没有改 Key、调用模型或改变电脑配置。此前 Windows 锁屏和标准模拟器 Gboard 未出现候选的记录保留为历史环境限制，不再将“中文候选从未实际通过”作为当前结论。

- 状态：主题、正文字号及首批页面/插件语言同步已接入，MuMu 主要入口通过；A05 全界面外观与语言未完成。
- 维护角色：DSH Mobile 项目协作 Agent。
- 最近核验：2026-09-27。
- 来源：[同步模块](../../src/phone-appearance.mjs)、[原生镜像](../../android/app/src/main/java/dev/dshmobile/validation/PhoneAppearance.kt)、[Android 实际入口脚本](../../scripts/verify-phone-appearance-android.mjs)。

## 当前行为与边界

### 相机返回后的系统栏核验（2026-10-02）

状态：已有实际报告核验通过，未复现持续的系统栏颜色错误；维护角色：项目协作Agent。来源：[真实窗口驱动](../../scripts/verify-window-focus-android.mjs)、[窗口报告](../../artifacts/window-focus-android.json)、[真实扫码驱动](../../scripts/verify-camera-scene-android.mjs)及[扫码返回报告](../../artifacts/camera-room-android.json)。

标准API36.1只读模拟器中，普通聊天冷启动、Remote冷启动及原生相机取消返回，实际焦点窗口均具有LIGHT_STATUS_BARS和LIGHT_NAVIGATION_BARS，与浅色页面匹配；取消返回后页面timeOrigin和输入草稿保持。[取消返回截图](../../artifacts/window-focus-remote-camera-return.png)可见深色状态栏图标。取消场景通过pm grant准备权限，不作为系统授权窗口的新证据。

独立pairingtest包另经真实系统授权、virtualscene摄像头识别成功，等待RemoteActivity取得焦点后窗口标志同样正确，未自动领取配对。成功返回即时截图仍处于可能的系统渐变阶段，不据单帧推断产品缺陷。生产代码未改；测试包强停、相机权限撤销、标准模拟器关闭，[正常APK恢复构建](../../artifacts/window-focus-normal-build.log)完成。2026-10-02重新检查adb仅日常MuMu在线。本项不等于所有系统主题、设备或完整A05验收。

### 插件窗口叠层交互（2026-09-27）

- 状态：新版 APK 已安装，浏览器问题复现及 MuMu 实际叠层验证通过。维护角色：项目协作 Agent；核验日期：2026-09-27。来源：[窗口所有权](../../src/remote-surface-inert.mjs)、[旁栏/全局外壳](../../src/remote-plugin-panels.jsx)、[管理外壳](../../src/ui/RemotePlugins.jsx)。
- 此前每个窗口只禁用主聊天，global 页面覆盖旁栏时，旁栏的按钮仍能获得焦点。新增[回归](../../scripts/check-global-panels.mjs)在修改前断言 lower.inert=true 失败。采用共享窗口层级所有权，而非给每个页面独立补 selector/恢复逻辑：最高窗口保持可交互，其余登记窗口和主聊天暂时 inert，原属性随所有权释放恢复；下层卸载不抢焦点，顶层关闭才回到仍有效的入口或下层容器。原插件挂到 body 的菜单/弹窗保持自己的生命周期，不整体禁用 body。
- 定向与完整插件页面回归通过，覆盖背景保护、下层焦点请求被拒绝、关闭下层保留焦点、顶层返回恢复，以及原菜单/Modal 和聊天草稿。Web 构建、Android assembleDebug/lintDebug 通过。
- 14:47 UTC，原 CLI 安装独立 UI 插件，经真实 Remote 模块加载到新版 MuMu App；[实际脚本](../../scripts/verify-global-panel-android.mjs)在全局页面内调用原 sidebarRight 打开/关闭底层旁栏，确认旁栏 inert、不能抢焦点、下层关闭后顶层焦点保持，Android 返回后旁栏可交互，再返回原聊天草稿不变。[报告](../../artifacts/global-panel-live-android.json)中 coveredPanelInert/focusPreserved/androidBack/pluginReturn 均 true、errors 为空。原 CLI 卸载后[清理报告](../../artifacts/global-panel-cleanup-android.json)通过；管理授权保持 false，没有模型调用或 Key 修改。
- 该项证明 DOM 焦点及 inert 边界，不冒充 TalkBack 全流程、所有第三方 portal 或完整键盘避让验收。管理窗口共用同一实现并通过完整浏览器回归，本轮实际 MuMu 专项只覆盖全局页面与旁栏。

### 原生对话框使用手机主题（2026-09-27）

- 状态：已修复、构建安装，配对提示与提醒设置的深浅色实际入口通过；完整原生外观仍待验收。维护角色：项目协作Agent；核验2026-09-27。来源：[共享原生外观](../../android/app/src/main/java/dev/dshmobile/validation/PhoneAppearance.kt)、[实际入口脚本](../../scripts/verify-native-dialog-theme-android.mjs)。
- 系统深色时，App选择浅色，原配对提示和Remote提醒设置仍显示深色；[修复前报告](../../artifacts/native-dialog-theme-before.json)与截图复现。四处AlertDialog入口统一使用dialogContext：普通聊天Key、电脑Key、配对提示和Remote提醒；自定义密码输入框、说明与布局使用同一个上下文。包装层局部覆盖主题和语言，不修改Activity主题或系统配置，避免污染WebView的系统配色判断。主题插件关闭时保持系统原生配色，未改凭据、通知或配对业务。
- 第一版包装使用createConfigurationContext作为base，实际配对入口出现空窗口而非预期提示，[失败报告](../../artifacts/native-dialog-theme-after.json)保留；没有AndroidRuntime崩溃记录，不将此描述为已确认崩溃。最终保留原Activity为base，通过applyOverrideConfiguration覆盖资源，并增加WindowManager身份不变检查。[原生外观检查](../../artifacts/native-dialog-final-instrumentation.log)覆盖两种系统模式×三种偏好×插件启停及语言/宿主配置不变。
- [实际提示与普通Key报告](../../artifacts/native-dialog-theme-complete.json)完成浅色/深色配对提示、通知设置和普通Key打开取消；已检查提示/通知截图，通知勾选与Key配置状态保持。密码窗口有FLAG_SECURE，不通过关闭保护获取截图，也未填写真实Key。[电脑Key原生隔离检查](../../artifacts/native-dialog-key-instrumentation.log)验证空输入框两色、取消不发送，并通过原语言、草稿、校验、移除确认与在途锁检查；传输是隔离捕获，不能当成已授权电脑Key真实写入。
- [双入口最终报告](../../artifacts/native-dialog-theme-entries.json)补齐普通设置与Remote专用会话菜单的真实提醒入口：两色一致、四项原勾选保持、普通Key仅取消；[Remote浅色](../../artifacts/native-dialog-entries-light-remote.png)与[深色](../../artifacts/native-dialog-entries-dark-remote.png)截图已检查。最终恢复跟随系统并回普通首页。电脑管理权限仍未开启，电脑Key的已授权真实入口不在本批通过范围。
- [APK构建与lint](../../artifacts/native-dialog-final-build.log)、[测试APK与lint](../../artifacts/native-dialog-key-tests-build.log)通过。第一版失败的清理未执行，暂留浅色；后续明确恢复原“跟随系统”，[12:56系统回归](../../artifacts/native-dialog-system-regression.json)再次确认真实Android深浅色切换、普通/Remote同一页面、非空草稿保留及显式主题优先，系统/App/草稿全部恢复。未发送模型请求或改变Key、绑定、管理权限及电脑服务。
- 当前保证窗口打开时使用手机主题；窗口已打开后的所有配色变化、状态栏、系统分享/文件选择器和第三方原生窗口不在本批完成声明内。系统窗口继续由Android控制，不据此标记完整A05或Remote完成。

### 系统栏图标与手机主题（2026-10-01）

- 状态：已修复并安装；维护角色：项目协作Agent。来源：[MobileWebWindow](../../android/app/src/main/java/dev/dshmobile/validation/MobileWebWindow.kt)、[正式Android驱动](../../scripts/verify-system-bars-android.mjs)。此前标准Android浅色Remote截图中状态栏时间/图标为白色，两个Activity均没有显式同步系统栏外观。
- 共享窗口读取现有PhoneAppearance的主题判定，更新系统栏背景与明暗图标，订阅手机偏好变更；系统配置变化时重算，Activity销毁时退订。没有更改Activity主题来模拟用户选择，保留WebView真实系统媒体查询和当前页面。API30以上使用InsetsController，API28–29保留其他systemUiVisibility位仅切图标位。
- [标准Android报告](../../artifacts/system-bars-android.json)四项通过：普通聊天/Remote配对页分别切浅色、深色，系统窗口appearance标志与页面一致；[浅色截图](../../artifacts/system-bars-light-remote.png)、[深色截图](../../artifacts/system-bars-dark-remote.png)实际核对无遮挡、时间和图标清楚。偏好恢复为原值；未配对或发送消息。最初[被System UI弹窗遮挡的报告](../../artifacts/system-bars-obscured-android.json)不能当视觉通过，保留[截图](../../artifacts/system-bars-obscured.png)，驱动已补前台窗口检查后重跑。
- [构建与lint](../../artifacts/system-bars-build.log)通过。日常MuMu已覆盖安装，实际普通入口进入绑定Remote并读出59项插件目录，无页面错误，见[当前入口报告](../../artifacts/plugin-compatibility-inventory-android.json)。此处不等于第三方插件全部功能通过；标准模拟器已关闭，日常绑定和权限未改。API28–29和系统主题切换时的系统栏专项尚未实测。

### Android 15以上键盘避让修复（2026-10-01）

- 状态：API36.1标准模拟器普通聊天、配对页及已绑定Remote聊天的软键盘避让通过；中文候选提交未通过，见下方对照。维护角色：项目协作Agent。来源：[共享窗口容器](../../android/app/src/main/java/dev/dshmobile/validation/MobileWebWindow.kt)、[实际驱动](../../scripts/inspect-standard-ime-android.mjs)。
- MuMu仍仅有搜狗、show_ime_with_hard_keyboard=1。已有C盘标准AVD以read-only/no-snapshot启动，在独立pairingtest包测试，不迁移Key或绑定。初次被System UI无响应弹窗挡住，失败记录保留；点击系统Wait恢复后，Gboard实际可见。[修复前](../../artifacts/standard-ime-before.json)Remote配对页inputShown=true，网页可视高度仍914，键盘覆盖网页；[截图](../../artifacts/standard-ime-before.png)核对有真实键盘，不把shown标志单独当证据。
- 原RemoteActivity只有adjustResize，在新系统边到边窗口下未处理IME/system bar Insets。现API35以上用FrameLayout接收系统栏、刘海与IME的联合Insets，缩小内部WebView的布局区域并消费Insets，避免重复处理；普通和Remote使用同一入口。旧系统保持原setContentView与adjustResize行为，不为解决MuMu搜狗环境改布局。
- [Remote配对页报告](../../artifacts/standard-ime-android.json)：无键盘可视高度约866，弹出约554，输入框bottom387仍可见，收起恢复866。[普通聊天报告](../../artifacts/standard-ime-ordinary-android.json)：同样缩小并恢复，输入框bottom由838变为484，低于可视高度554。均为真实Gboard键盘、errors为空，未发送消息或领取配对。WebView自身得到正确高度，未靠JS伪造visualViewport。
- [日常APK构建/lint](../../artifacts/ime-final-build.log)通过，新版覆盖安装MuMu，普通入口进入Remote显示已连接、无alert，见[Android12入口回归](../../artifacts/ime-mumu-entry-android.json)。标准模拟器已关闭，日常绑定和管理权限未改。本项不等同已绑定Remote聊天的全部工具面板避让或中文候选提交，亦不解决MuMu搜狗零高度的具体根因；完整A05继续按明确缺口验收。

### 中文软键盘实际窗口对照（2026-09-27）

2026-10-01补验：独立测试App真实配对，仅授予聊天权限，在已有专用Remote会话读取历史后弹出Gboard。[已绑定聊天报告](../../artifacts/standard-remote-ime.json)显示可视高度866→554→866，编辑器与发送工具栏均在键盘上方，草稿保留；撤销后聊天页面移除。[驱动](../../scripts/verify-standard-remote-ime.mjs)在finally按本次唯一名称/设备ID收回授权，不修改日常设备。

同一只读标准模拟器通过Gboard设置添加简体中文拼音，再经屏幕实际逐键点击nihao。[中文专项](../../artifacts/standard-remote-ime-chinese.json)等待候选提交超时，未通过；[Remote截图](../../artifacts/ime-live.png)显示拼音键盘但没有中文候选，编辑器收到普通字母。随后在Gboard自身的原生语言搜索框以同样屏幕按键输入，亦只得到nihao、没有候选，见[原生对照截图](../../artifacts/ime-native.png)。现象不限于聊天编辑器，尚未定位输入法内部原因；不据此修改生产代码或冒充中文组词通过。此次没有发送消息，临时授权已撤销且聊天页面已移除，正常APK产物已重新构建并通过lint，见[构建日志](../../artifacts/ime-normal-artifact-build.log)。中文输入、读屏仍待验。

- 状态：环境问题已进一步定位，中文组词及键盘避让仍未验收。维护角色：项目协作Agent；核验2026-09-27。来源：[实际屏幕点击检查](../../scripts/inspect-remote-ime-android.mjs)、[Remote报告](../../artifacts/remote-ime-inspect.json)、[原生输入框对照](../../artifacts/native-ime-control.json)。
- MuMu当前仅有搜狗输入法，`show_ime_with_hard_keyboard=1`。原生屏幕点击专用Remote会话输入框后，系统`mInputShown=true`，但在按返回键前读取的输入法窗口为`[0,1624][786,1624]`，高度0；页面visualHeight维持843.2，截图没有软键盘。不能以系统shown标志或脚本正常退出认定验收通过。
- 打开Android设置的设备名称原生编辑对话框，同样出现已请求显示、窗口高度0、没有软键盘的现象；[对照截图](../../artifacts/native-ime-dialog.png)已检查。没有输入或保存设备名称，随后点击取消并返回原Remote会话，12:44再次检查草稿保留。此证据说明现象不限于WebView，尚不能定位搜狗内部或MuMu配置的具体原因；不据此修改产品布局。
- 原生设置页两次uiautomator未能取得idle状态，旧XML不作为新页面证据，最终用实际截图及输入法窗口采样对照。Playwright的tap因未启用hasTouch而拒绝，检查改用观测到的WebView区域换算真实Android点击。所有临时设备文件已删除，未更换输入法、改系统设置、Key、绑定或管理权限，未调用模型。完整中文组词/候选提交/回车与非零键盘避让仍待具备可见软键盘后验证。

### 跟随Android系统主题与页面保留（2026-09-27）

- 状态：已修复、安装并通过MuMu实际系统切换；完整A05仍未完成。维护角色：项目协作Agent；核验2026-09-27。来源：[Android主题声明](../../android/app/src/main/AndroidManifest.xml)、[浅色资源](../../android/app/src/main/res/values/themes.xml)、[深色资源](../../android/app/src/main/res/values-night/themes.xml)、[普通聊天容器](../../android/app/src/main/java/dev/dshmobile/validation/ValidationActivity.kt)、[Remote容器](../../android/app/src/main/java/dev/dshmobile/validation/RemoteActivity.kt)、[实际专项](../../scripts/verify-phone-appearance-android.mjs)。
- 原宿主固定Theme.Material.Light，系统已深色时WebView媒体查询仍是浅色。按[Android官方约定](https://developer.android.com/develop/ui/views/layout/webapps/dark-theme)，媒体查询取决于宿主isLightTheme。采用平台day/night资源与两Activity处理uiMode变化，先重新应用主题再通知WebView；无需新增原生桥、改主题插件、伪造matchMedia或对插件/图片自动反色。系统主题切换不重建聊天页面。
- 排查发现Playwright Android连接默认模拟light，最初几份phone-system-before/after/probe/meta/compat报告受到测试覆盖影响，不能用于判定原生修复。脚本现以emulateMedia({colorScheme:null})解除覆盖，读取真实系统信号；[重新测得的原版失败](../../artifacts/phone-system-real-before.json)确认Android night=yes而两页面dark=false。临时native日志确认候选Activity uiMode=33、isLightTheme=0；所有探针、ForceDark尝试及多余meta已移除。
- 仅更换主题资源的候选虽颜色正确，uiMode仍触发Activity重建，[非空草稿测试](../../artifacts/phone-system-final-draft.json)发现Remote退回列表；没有记为通过。其测试后缀已按原报告时间核对后单独移除，[清理记录](../../artifacts/phone-system-draft-cleanup.json)保留原草稿前缀。最终容器处理uiMode后，[12:31真实报告](../../artifacts/phone-system-lifetime.json)两模式dark=true/false、媒体查询true/false、同一页面timeOrigin均保持，手动浅色/深色优先于相反的系统配色。专用会话和非空草稿保持，未发送消息；原系统模式、App偏好/字号与草稿全部恢复。
- 已查看两色实际聊天截图。[3项外观逻辑测试](../../artifacts/phone-system-unit.log)、[最终APK构建与lint](../../artifacts/phone-system-lifetime-build.log)、[收尾实际Remote入口](../../artifacts/phone-system-cleanup-entry.json)通过，两个动态模块active、errors/resources为空。本轮未调用模型、改Key/绑定/权限或重启电脑服务。此验证涵盖系统配色及两聊天容器，不涵盖所有原生对话框对App显式主题的覆盖、状态栏完整适配或全部第三方界面。

### Office预览失败提示（2026-09-27）

- 状态：修复已构建安装，真实 MuMu 附件入口通过。维护角色：项目协作 Agent，核验日期2026-09-27。来源：[预览注册](../../src/remote-document-previews.jsx)、[原组件构建适配](../../scripts/remote-document-sources.mjs)、[实际验收脚本](../../scripts/verify-office-error-language-android.mjs)。
- 原注册在英文下直接使用 error.message，且 OfficeBody 将格式化后的提示保存在标签状态中，导致英文显示内部错误码、切换语言后旧提示不更新。[真实修复前报告](../../artifacts/office-error-before-3-android.json)在专用聊天的既有损坏附件上复现 `document-render/failed`。没有改写附件或伪造电脑应答。
- 现在两种语言统一使用现有 officeError 生成稳定提示键，派生 OfficeBody 仅在显示失败时调用手机翻译。相比因语言变化重建预览或重新转换文档，这种方式保留原 store、文件与标签生命周期；参考检出不修改。原文件预览回退入口已使用 t(error)，无需重复实现。工作区与附件共用同一原 Office 注册。
- [最终实际报告](../../artifacts/office-error-final-android.json)09:15:11香港时间通过英文→中文→英文错误更新，同一页面及失败节点保持；随后打开既有正常 docx，原 PDF 文字/画布正常，切中文后同一画布仍挂载。草稿保留、errors为空，原语言和普通首页恢复；[英文截图](../../artifacts/office-error-final-en-android.png)已检查。此轮实际覆盖历史附件，不冒充所有工作区失败、第三方预览或完整A05验收。
- [Office专项9项](../../artifacts/office-error-unit.log)、[完整原插件页面回归](../../artifacts/office-error-panels.log)、[Web构建](../../artifacts/office-error-build.log)、[APK构建与lint](../../artifacts/office-error-android-build.log)通过。早期脚本误用翻译标签/标题范围和未等待进程、历史就绪，失败报告保留；按实际入口修正后重跑，未放宽错误文案断言。没有新模型请求、Key、文件、电脑设置或设备权限修改，DSH38236/网关45812保持运行。
- 内置浏览器控制仍不可用；备用 Windows 操控因无法可靠识别浏览器 URL 停止。实际手机管理保存仍待验，完整 Remote、其他外观/通知/插件/性能缺口保留；网页转发暂缓、范围待定。

### 动态插件待审批提示（2026-09-27）

- [共享翻译](../../src/ui/translations.mjs)补齐“有插件等待你确认运行”和“查看请求”两处遗漏。两者已有同一LocaleProvider调用，仅缺词条；无需重建Remote、重读请求或修改电脑语言。当前Remote组件中静态`t('…')`中文键的检索未发现其他缺失，此检查不覆盖动态错误、未使用t的文案或第三方组件，不代表全语言完成。
- 新版Web/APK构建、Android lint及现有语言持久化/插值测试通过，已覆盖安装。04:51:48香港时间，[实际脚本](../../scripts/check-cordis-notice-language-android.mjs)在真实动态包待审批期间，通过普通设置切英文并返回同一Remote：提醒与按钮英文、performance.timeOrigin不变、原草稿保留；[英文截图](../../artifacts/cordis-notice-language-en-android.png)已查看。
- finally恢复原中文，随后原验收流程成功拒绝，再批准单次/后续版本、运行并停止移除；见[实际报告](../../artifacts/cordis-notice-language-android.json)。未批准前没有因切语言执行插件。原维护门闩阻止模型唤醒，本轮6条测试回执清理、原待办保持、newTurns=0，errors/resources为空；Key、绑定及权限未变。
- 临时包经原CLI卸载，DSH恢复53256、网关18752保持，[冷启动收尾](../../artifacts/cordis-language-cleanup.log)核对原中文日常Remote、草稿与两个动态模块。其他语言/原生外观边界和完整A05仍未完成。

### Remote 列表日期跟随手机语言（2026-09-26）

[会话列表](../../src/ui/RemoteWorkspace.jsx)原先未给日期格式指定语言，实际英文 App 仍显示中文日期；现在复用同一 LocaleProvider，在共享列表显式使用手机语言，保留原时间和系统时区。增加 time 的机器可读时间，不改变排序、标题、记录或电脑语言。运行中条目仍显示原“进行中”状态。

[MuMu 修复前](../../artifacts/remote-list-locale-before.json)复现中英文日期均为 `2026/9/26`；[修复后实际入口](../../artifacts/remote-list-locale-android.json)通过英文 `9/26/2026`、中文 `2026/9/26`、同一页面即时更新及五条原时间一致。通过普通设置切语言、电脑连接进入列表，没有直接写语言存储或模拟电脑响应。[英文截图](../../artifacts/remote-list-locale-en-android.png)已检查，标题仍保留原文。验证脚本：[列表语言专项](../../scripts/verify-remote-list-locale-android.mjs)。

[Web 构建](../../artifacts/remote-list-locale-build.log)、[完整页面回归](../../artifacts/remote-list-locale-browser.log)、[APK 与 lint](../../artifacts/remote-list-locale-android-build.log)通过，新版安装后已恢复原中文并退出普通设置；[实际聊天收尾](../../artifacts/remote-list-locale-cleanup.json)确认原空草稿、指南、历史只读命令入口正常，errors/resources 为空。未发送模型请求、改 Key、绑定、权限或电脑设置。

验证脚本曾有启动等待、同名会话配对及收尾仍停留设置页三处假设错误，失败报告保留，分别补进程等待、标题加时间匹配及显式退出设置后完整重跑。仅主列表语言入口做了新版 Android 专项，其他时间窗口已有显式语言，无产品修改；全部原生窗口/第三方语言和完整 A05 仍不能据此认定完成。

### 系统分享入口语言边界（2026-09-25 12:26 UTC）

从真实专用聊天的既有 PDF 链接进入 DSHM 文件预览，再打开 Android 分享面板。[入口脚本](../../scripts/verify-native-share-language-android.mjs)分别在中英文下确认真实系统 Chooser 与接收应用入口出现，按系统返回取消，文件预览和同一 Remote 页面保留；没有选择接收者或发送文件。[报告](../../artifacts/phone-language-native-share-android.json)还核对连接菜单、语言切换与原草稿恢复；[英文界面的系统面板截图](../../artifacts/share-language-en.png)已查看。未修改电脑文件、绑定、Key 或权限。

实际发现 Android 的 `ACTION_SEND` 分享面板不显示 `createChooser` 的自定义标题，系统控件仍随系统语言；这是[官方接口约定](https://developer.android.com/reference/android/content/Intent#createChooser(android.content.Intent,%20java.lang.CharSequence))，不能把翻译资源存在当成面板标题已显示。应用自己的分享按钮与打开面板后的状态提示跟随手机语言；传入系统的标题仅在平台适用时使用，不承诺覆盖系统 UI 语言。

第一次脚本过早匹配到网页同名按钮，第二次真实系统窗口推翻了自定义标题必显示的假设。最终脚本检查系统包及 Chooser 控件身份，明确记录 `customTitleDisplayed: false`，不再用标题单独判定系统窗口。两次失败报告保存在 artifacts，本批只调整验收脚本和记录，未修改产品代码或重新构建 APK。相机实际解码、扫码说明窗口与完整 A05 仍待验收。

### 原生配对入口及平台入口文案（2026-09-25 12:17 UTC）

[PairingEntryActivity](../../android/app/src/main/java/dev/dshmobile/validation/PairingEntryActivity.kt)的无效链接与已有绑定提示使用 PhoneAppearance 局部资源；打开期间订阅语言变化，关闭释放监听。原解析规则、已有绑定保护与 Intent 清理不变。[扫码入口](../../android/app/src/main/java/dev/dshmobile/validation/RemotePairScanner.kt)和[分享入口](../../android/app/src/main/java/dev/dshmobile/validation/RemoteDownloads.kt)在打开时读取同一手机语言；不修改系统语言，系统自身界面仍由 Android 控制。

[实际入口脚本](../../scripts/verify-pairing-language-android.mjs)从普通设置切换中英文，通过 Android ACTION_VIEW 启动配对入口。无效链接与已有绑定两类提示、正文及按钮共四项均通过；已有绑定检查使用无效的固定测试 key，不领取配对、不新增设备。[报告](../../artifacts/pairing-language-android.json)记录语言恢复；已查看[英文已有绑定窗口](../../artifacts/pairing-language-en-bound.png)，文字完整。未发送模型消息、修改 Key 或授予权限。

正常/测试 APK 构建与 lint 通过，新版已覆盖安装。[原生资源检查](../../android/app/src/androidTest/java/dev/dshmobile/validation/PhoneAppearanceChecks.kt)通过，覆盖配对、扫码和分享的中英文资源。首次 UI 脚本在进程启动前连接失败，补充启动等待后通过；该次未进入验收页面。分享真实窗口后续已核验，见上节；扫码窗口、配对弹窗打开期间即时切换和完整 A05 仍未实际验收。

### 原生电脑 Key 窗口（2026-09-25 05:27 UTC）

[RemoteComputerKey](../../android/app/src/main/java/dev/dshmobile/validation/RemoteComputerKey.kt)复用 PhoneAppearance 局部资源；标题、密码提示、HTTP 说明、输入校验、移除二次确认和保存状态均跟随手机语言。只更新文本，不重建密码框、不触发提交、不改变按钮启用状态；窗口关闭释放监听。原 `snapshot/remote.keyWrite/set/unset`、请求身份/代次、结果字段过滤、未知结果阻止重试及 35 秒超时规则不变。密码隐藏、禁止 Autofill/状态保存、FLAG_SECURE 和退出清空保持。

[原生隔离检查](../../android/app/src/androidTest/java/dev/dshmobile/validation/RemoteComputerKeyChecks.kt)使用独立语言偏好与无价值哨兵，生产窗口配隔离发送回调：密码/光标和同一 EditText 跨语言保持，空输入错误翻译、取消清空、保存中全部按钮仍禁用、移除确认和原 unset 值、结果脱敏与未知结果锁定通过。另检查 FLAG_SECURE 与 Autofill/状态保存保护。测试不访问真实电脑 Key；独立回调的 set/unset 不能当作电脑真实写入验收。

新版正常 APK 已安装。沿用用户先前授权，临时给同一 DSHM Android（指纹 `EYvtQJ2f8cICRebQxcWaUTtmkPQ01XcdfKG_V2tE-lE`）管理权限；从 MuMu 自有 Remote → 电脑设置 → 管理电脑 Key 进入真实原生窗口，中→英即时切换后取消。全程不输入、保存、移除或读取 Key 内容，仅原页面读取配置状态。已授权设置表单的等待输出超时临时编辑为原值加 1，但没有保存；跨语言草稿保留，关闭窗口再打开读取仍为电脑原值。临时管理权限随后从 DSH 插件页收回，已见“聊天与任务操作”；保留原聊天授权，未操作独立待批准设备。

实际证据：[主入口脚本](../../scripts/verify-phone-language-android.mjs)、[Key 窗口检查](../../scripts/verify-native-key-language-android.mjs)、[报告](../../artifacts/phone-language-native-key-android.json)。原生层级核对中英标题、HTTP提示、三个按钮和密码字段；FLAG_SECURE 保持，未关闭保护取截图，因此本批不宣称截图视觉验收。中文与原聊天草稿恢复，App 回普通首页，无模型请求。

正常/测试 APK 构建、Android lint、`computerKeyOnly` 原生检查和脚本语法通过。真正 set/unset 的英文端到端写入、其他原生窗口及完整 A05 仍未完成；此批不以隔离写入或取消流程替代真实配置提交。

2026-09-25 原生 Remote 提醒窗口与摘要已接入同一手机语言资源。MuMu 同一原生设置窗口跨语言、两种入口、真实英文完成通知原地切中文、点击目标保持与已清除通知不重放通过；构建/lint、原生资源持久化与通知账本检查通过。详见[通知语言源码与实际证据](./notifications-current.md)。不修改系统语言或重建 Activity；电脑密码窗口的后续核验见上文，其他原生窗口、英文前台横幅与通知冷启动语言仍待专项验收。

普通聊天“设置 → 外观与语言”仍是手机外观的修改入口，主题和 12–17px 正文字号同步到 DSHM 自有 Remote 页面，包括已打开但位于后台的页面。主题插件禁用时释放手机主题效果，保留用户偏好。电脑主题不被修改，手机也不读取电脑主题覆盖自己的设置。

普通聊天已有设置是权威来源，原生仅持久镜像 `preference/fontSize/enabled/language` 四个固定字段，语言限 `zh/en`。兼容旧三个字段写入，缺少语言时保留原值；旧存储默认中文，与普通聊天一致。普通聊天来源可以写入；Remote 主页面只能读取，HTML 预览与子 frame 不增加权限。原生镜像让通知直接冷启动 Remote 时无需先加载普通聊天。采用此方式而非合并两个 WebView 的存储，保留凭据及来源隔离，并复用原 DSH ThemePresenter，不另造主题渲染器。

写入按顺序提交，失败在普通聊天设置页显示重试。Remote 初次进入、页面恢复及原生变动通知时重读；旧读取结果、页面卸载后回调丢弃。跟随系统由手机的媒体查询变化驱动。不会转发任意 CSS、令牌对象、Key 或电脑配置。停用主题插件不停止语言同步。

## 首批语言接入（2026-09-25 03:58 UTC）

普通聊天设置的语言经同一镜像进入 [RemoteApp](../../src/RemoteApp.jsx) 的共享 [LocaleProvider](../../src/ui/locale.jsx)。Remote 的连接/配对页面、[工作区首页和主要菜单](../../src/ui/RemoteWorkspace.jsx)、共享输入框与回复组件使用手机翻译。电脑返回的会话标题、正文、工作区名和模型名称保留原文，不逐字替换页面 DOM。

真实插件沿用原 LocaleRuntime：装配时设为当前手机语言，设置变化即时调用原 `setLocale`；异步重建通过当前语言引用取得最新值，不重新连接会话或重置草稿。电脑语言设置不写入。原生仍仅传固定枚举，不从插件或电脑读取手机 Key。

[MuMu实际入口脚本](../../scripts/verify-phone-language-android.mjs)与[最终报告](../../artifacts/phone-language-android.json)通过：普通设置切英文后，[Remote首页](../../artifacts/phone-language-home-en.png)、[菜单](../../artifacts/phone-language-menu-en.png)、[实际连接菜单](../../artifacts/phone-language-connection-en.png)已检查；专用聊天的模型回复标签、输入框及原评价插件 `Good response` 正确切英文，正文与标题保留中文。切回中文后同一页面时间标识不变，原插件恢复“好的回答”，测试草稿完整保留后恢复原值。最终普通与Remote均为原中文，App回普通首页；没有发送模型消息、断开连接、改权限、Key或电脑设置。测试曾因“Remove pairing”同时匹配摘要和隐藏确认按钮而失败，修正为可见摘要选择器后通过，不曾点击移除。

246项JS测试通过，覆盖语言白名单、旧读值默认、主题禁用时语言仍更新和卸载拒绝迟到。原生独立存储检查新增语言持久化、旧三个字段写入保留语言、非法值拒绝，通过；五场景RemoteApp恢复回放、Web/APK构建与Android lint通过，新普通APK覆盖安装。

剩余语言范围：插件/电脑设置等详细页、其余动态错误和辅助标签仍有固定中文；原生窗口/通知及日期格式也未全量本地化。聊天卡片、文件/命令窗口及目标/任务的后续增量见下节。上面的主要入口通过不能作为全部页面或所有第三方插件已翻译的证据。语言的实际通知冷启动尚未单独测试，原生持久化检查不代替该入口验收；上一节外观冷入口证明的是主题与字号。

## 聊天记录与交互卡片语言（2026-09-25 04:08 UTC）

[RemoteMessage](../../src/ui/RemoteMessage.jsx)的工具状态/耗时、命令/修改/附件入口、系统上下文、停止/重试/上限提示与分支操作已接入翻译；[RemoteInteraction](../../src/ui/RemoteInteraction.jsx)覆盖审批、提问和计划确认；[队列](../../src/ui/RemoteQueue.jsx)和[计划模式面板](../../src/ui/RemotePlanMode.jsx)也已接入。正文、原问题、选项及描述、工具参数/输出、文件路径、计划正文等电脑数据保持原值，仅固定界面文案和插值外层翻译。

原交互语义不变：批准仍为 `allowed-once`，拒绝仍为 `rejected`；计划批准发送电脑给出的原选项标签，提出修改使用原取消分支；问题保留选项原文与补充文字。提交后等待原事件撤下，未知结果继续锁定，不因语言切换重试或解锁。

- [六场景真实组件回放](../../scripts/verify-remote-interaction-language.mjs)与[报告](../../artifacts/remote-interaction-language.json)通过：已选问题/补充文字跨语言保留，批准/拒绝、计划批准/提出修改的回调值准确，提交失败后切中文仍锁定且只提交一次。仅隔离 answer 回调，不含鉴权、网络或真实审批执行，不能代替该类端到端验收。初次打包缺少上游依赖解析路径，补用手机现有 node_modules 后通过，没有新增依赖。
- [MuMu真实入口报告](../../artifacts/phone-language-interactions-android.json)通过。专用聊天用英文界面发起一次仅 ask_user_question 的测试，中文问题/选项保持原文，选择“保留原文”并补充“保留中文补充”后显式提交，卡片撤下、电脑返回标记。[电脑浏览器展开真实已回答记录](../../artifacts/language-interaction-desktop-check.json)核对了两项原值，不只依据模型回复。
- [英文提问卡片](../../artifacts/phone-language-question-en.png)、[工具历史](../../artifacts/phone-language-tool-en.png)和[计划模式面板](../../artifacts/phone-language-plan-en.png)截图已检查。计划只读取“Off”状态，未切换或创建计划。系统截图可能晚于/早于页面绘制，补充回答以电脑实际记录为准。
- 246项JS测试、Web/APK构建、Android lint通过，正常APK覆盖安装。最终恢复原中文与原草稿，App回普通首页；未修改电脑语言、Key、模型地址、设备授权或计划模式。
- 本次实际覆盖提问提交、工具状态与计划面板。英文审批/计划确认及队列操作只有组件语义/现有底层检查，尚未在MuMu重新执行真实写入与排队验收；文件/命令等详情页及原生本地化继续推进，不宣称A05完成。

## 文件、差异与命令窗口语言（2026-09-25 04:31 UTC）

[文件预览](../../src/ui/RemoteFilePreview.jsx)、[差异](../../src/ui/RemoteDiff.jsx)、[命令](../../src/ui/RemoteCommand.jsx)、[前台输出](../../src/ui/RemoteCommandOutput.jsx)、[共用输出窗口](../../src/ui/RemoteLiveJobOutput.jsx)、[电脑打开确认](../../src/ui/RemoteDesktopOpen.jsx)使用手机翻译。固定错误在显示时翻译，已出现的错误也随语言变化；电脑内容、命令、路径、工具描述和差异行不处理。图片/PDF通过共享[语言上下文](../../src/ui/locale.jsx)选择上游自有语言包，不修改上游。离线摘要使用手机语言和相应日期格式。

真实入口回归为[脚本](../../scripts/verify-phone-language-android.mjs)的 `--details` 分支及[细项检查](../../scripts/verify-detail-language.mjs)，最终[报告](../../artifacts/phone-language-details-android.json)通过，仅读取“DSHM Remote 联调提示”既有历史，无新模型消息、命令或文件写入：

| 真实入口 | 本次检查 |
| --- | --- |
| [命令详情](../../artifacts/detail-language-command-en.png) | 原失败命令显示英文状态和退出码7；完整命令跨语言保持一致，全屏状态保留；历史输出原有乱码不由翻译修复 |
| [工具差异](../../artifacts/detail-language-diff-en.png)与最新完整文件 | 原 BEFORE/AFTER 与当前第三版区分保留；英文电脑打开确认页只进入并取消，未实际打开应用；切语言不丢失当前文件 |
| 整轮快照已过期 | 原真实缺失错误在窗口内中英文更新，不用工具差异冒充已失效快照 |
| [PDF](../../artifacts/detail-language-pdf-en.png) | 原两页文档正常，页码辅助标签切换，原画布仍挂载 |
| [SVG图片](../../artifacts/detail-language-image-en.png)与[损坏PNG](../../artifacts/detail-language-broken-image-en.png) | 图片标签及失败提示切换，正常图片的blob地址不变。旧PNG是此前用例故意留下的损坏文件，未改写为成功样本 |
| [HTML](../../artifacts/detail-language-html-en.png) | 内部计数操作后跨语言仍为1，iframe地址不变；两种原生桥均不存在，访问父DOM仍被拒绝 |

HTML曾真实失败，见[修复前报告](../../artifacts/phone-language-details-before-html-fix.json)：普通聊天已中文，Remote仍英文，关闭预览后也不会自动补上被忽略的设置事件。原因是[RemoteBridge](../../android/app/src/main/java/dev/dshmobile/validation/RemoteBridge.kt)误把“存在HTML预览”用于阻止父主框架的外观事件和只读查询。修复仅移除外观分支的该条件；原生监听器仍先校验主框架/来源，查询仍校验准确主页面URL及空参数，其他敏感操作和文件选择的HTML限制保持。最终同一路径通过，不通过重载页面掩盖问题。应按调用来源判定只读主页面能力，不能把文件选择回调无法区分子框架的限制直接套到所有桥操作。

第一次脚本未继续加载更早PDF记录，随后补齐分页；图片成功态误用历史损坏PNG后，改为独立成功/失败两条检查，未修改测试原件。最终同页聊天、原插件语言和草稿回归也通过。恢复后另行读取两页 `documentElement.lang` 均为 `zh-CN`，无打开弹窗，App回普通首页。临时只读诊断脚本已移除。

246项JS测试通过；Web构建、APK构建与Android lint通过，新正常APK已覆盖安装。独立输出的固定标签/错误已接入，但本次未重做真实运行中的前台/后台输出中英文切换；Office、保存/分享原生窗口与动态下载进度英文验收也尚未执行。其余详情、原生窗口及通知语言继续实施，不能宣称A05或完整Remote完成。

## 目标、后台任务与定时记录（2026-09-25 04:41 UTC）

[目标摘要与面板](../../src/ui/RemoteGoal.jsx)、[后台任务](../../src/ui/RemoteJobs.jsx)、[任务输出记录](../../src/ui/RemoteJobOutput.jsx)和[定时任务](../../src/ui/RemoteSchedules.jsx)已使用手机语言。目标及轮次输入不会因切语言重置，电脑原目标内容、受阻原因、任务描述、命令输出和提醒正文不翻译。日期按手机语言格式化，重复频率使用 Intl 单位格式，不修改原计划时间或另外安排手机计时任务。未知操作结果、任务版本及进程状态仍由原 RemoteGoals/RemoteJobActions 校验。

- [生产组件隔离回放](../../scripts/verify-task-language.mjs)、[报告](../../artifacts/task-language-components.json)四项通过：编辑值/轮次跨语言保持并提交原 id/revision；电脑新版本让旧编辑失效且错误即时翻译；停止确认跨语言保持，requested 回执仍等待电脑最终 killed 状态；提醒内容和时间戳不变，离线不能显示已执行。该回放没有真实网络或鉴权，不代表电脑已执行写操作。
- [MuMu 实际入口](../../scripts/verify-phone-language-android.mjs)的 `--tasks` 分支及[报告](../../artifacts/phone-language-tasks-android.json)通过：读取真实当前目标，填入未提交文字与7轮上限后切中文，输入保持；随后关闭窗口，未点击开始目标。[目标截图](../../artifacts/task-language-goal-en.png)已检查。
- 当前专用会话后台任务实际为0，[空列表](../../artifacts/task-language-jobs-en.png)正确显示英文；默认 DSH 未提供 schedule，[不可用入口](../../artifacts/task-language-schedules-en.png)正确说明。未临时开启电脑功能或生成假任务，不以这两个空/不可用入口声称非空真实任务验收。
- 246项JS、Web/APK构建及Android lint通过，正常APK已安装。共享首页、原插件、同一Remote页面及草稿回归通过；最终原中文、原聊天草稿恢复，App回普通首页。未发模型请求、改变目标/任务/提醒、电脑配置、Key或授权。
- 尚未重做英文真实目标提交/停止任务、有记录输出及启用定时任务的完整链路；已有中文功能证据仍保持其原验证范围。插件/电脑设置等其余详情与原生窗口继续接入，完整A05及Remote未完成。

## 实际验收

### 模式、权限、技能、子会话及管理入口（2026-09-25 05:03 UTC）

[Agent模式](../../src/ui/RemoteAgentPresets.jsx)及[权限选择](../../src/ui/RemotePermissions.jsx)按手机语言使用原上游字典；[模式显示](../../src/remote-agent-presets.mjs)仍通过原presetDisplayText区分system/user，自定义同名模式不会被自动翻译。[权限显示](../../src/remote-permissions.mjs)沿用原displayPermissionPreset，完全权限与Auto review的风险确认保留上游原文、原枚举和显式勾选流程，不改电脑默认配置。

[技能](../../src/ui/RemoteSkills.jsx)、[子会话](../../src/ui/RemoteSubagents.jsx)、[工作区管理](../../src/ui/RemoteWorkspaces.jsx)及[日志导出](../../src/ui/RemoteSessionExport.jsx)固定标签、状态和本地错误接入手机语言。技能说明、源文件路径、工作区/子会话名称保持原文；子会话inactive只显示“当前未运行”，不能推断已完成。语言变化不放进目录读取effect依赖，不重置搜索、工作区编辑、权限勾选或导出包含子会话选项。

- [生产组件隔离检查](../../scripts/verify-navigation-language.mjs)、[报告](../../artifacts/navigation-language-components.json)四项通过：上游完全权限/Auto review确认切语言保持、目录revision变化撤下旧同意；工作区改名草稿/移除勾选保持，电脑更新后禁用移除；技能搜索/原路径/原模式ID保留、读取次数不增、自定义中文名称不翻译；未运行子会话不假报完成、损坏记录不可点击、原child ID交给导航。权限/模式/工作区回调为隔离捕获，不能代替电脑真实写入。
- [MuMu入口](../../scripts/verify-navigation-language-android.mjs)由[完整语言脚本](../../scripts/verify-phone-language-android.mjs)的 `--navigation` 调用；[最终报告](../../artifacts/phone-language-navigation-android.json)通过。已有聊天模式固定不可更换；原权限为Read Only，打开完全权限确认、勾选后切中文再取消，英文回来原权限不变。33个真实技能原名称与搜索词跨语言保留，未插入或发送技能。子会话目录真实为空，刷新完成后显示空态；不能以此代表非空真实子会话英文验收。
- 日常设备没有管理权限，工作区管理仍拒绝；没有临时授予权限或操作工作区。日志包含子会话勾选跨语言保留，真实导出到Android保存窗口后按返回取消，显示Export canceled，未保存ZIP。原生系统选择器仍遵循系统语言，本批未改原生窗口。
- 已检查截图：[模式](../../artifacts/navigation-language-presets-en.png)、[权限](../../artifacts/navigation-language-permission-en.png)、[技能](../../artifacts/navigation-language-skills-en.png)、[子会话](../../artifacts/navigation-language-subchats-en.png)、[导出取消](../../artifacts/navigation-language-export-en.png)。首次脚本误用 `[role=dialog]` 查询实际原生dialog元素，导致等待超时；[原报告](../../artifacts/phone-language-navigation-selector-failure.json)保留。修正选择器后同一路径通过，无产品功能修补或重启绕过。
- 246项JS、四项组件检查、Web/APK构建和Android lint通过，新正常APK覆盖安装；共享聊天/连接菜单及原插件语言回归通过，恢复原中文和聊天草稿，App回普通首页。英文真实权限/模式/工作区写入、非空子会话导航、实际导出保存而非取消仍未在本批重验。辅助标签/动态提示、原生窗口/通知与完整A05继续实施。

### 电脑设置与插件列表语言（2026-09-25 04:52 UTC）

[电脑设置](../../src/ui/RemoteComputerSettings.jsx)、[Key状态](../../src/ui/RemoteComputerKey.jsx)、[服务地址](../../src/ui/RemoteComputerEndpoint.jsx)和[插件列表](../../src/ui/RemotePlugins.jsx)使用共享翻译上下文。仅翻译固定标签和本地已知错误，原设置枚举/数值、地址站点/完整新路径、插件标识保持。异步结果仍保存原提示键并在渲染时翻译；语言不加入读取effect依赖，不重读、不丢未保存表单。服务地址仍通过原URL schema校验与确认，管理权限、快照、写入锁和未知结果策略保持；原生密码窗口未在本批翻译。

- [生产组件检查](../../scripts/verify-settings-language.mjs)、[报告](../../artifacts/settings-language-components.json)六项通过：枚举/数字/恢复默认草稿跨语言保留且读取次数不增；地址设置/恢复默认确认保留原站点/路径和HTTP提示，取消不保存、非法URL被拒绝；Key取消回调只重读状态、不显示已保存；实际MobilePluginLayout保留用户覆盖并恢复作者默认；单次原快照/原值提交、忙碌与未知结果锁定；未授权隐藏全部设置入口。设置服务为隔离回调，不代表真实电脑写入或原生密码窗口实测。
- [MuMu实际入口脚本](../../scripts/verify-phone-language-android.mjs)的 `--settings` 分支与[报告](../../artifacts/phone-language-settings-android.json)通过。真实插件列表59项跨语言身份、运行状态和自适应选择相同；仅读取，没有切换或安装卸载插件。[英文插件截图](../../artifacts/settings-language-plugins-en.png)已检查。
- 当前日常设备仍无管理权限，真实电脑设置入口正确显示[英文拒绝提示](../../artifacts/settings-language-denied-en.png)，没有读取或修改电脑设置、Key、地址，没有临时授权。本次不能记为已授权表单的英文真实链路通过，该项及原生密码窗口仍待验证。
- 246项JS、Web/APK构建与Android lint通过，正常APK已覆盖安装；共享首页、聊天、原插件语言、连接菜单及同页草稿回归通过。恢复原中文及原草稿，App回普通首页，无模型请求或权限变化。其他功能详情、原生窗口和完整A05仍未完成。

| 入口/场景 | 结果与证据 |
| --- | --- |
| 旧版普通聊天深色17px → Remote | [复现](../../artifacts/phone-appearance-reproduce-android.json)：Remote 仍白底且字号属性缺失，确认真实入口缺口 |
| 新版设置深色17px → Remote 首页、已加载聊天、菜单 | [入口报告](../../artifacts/phone-appearance-verify-android.json)通过；[真实正文截图](../../artifacts/phone-appearance-dark-chat.png)、[菜单截图](../../artifacts/phone-appearance-dark-menu.png)已检查 |
| 改为浅色12px再进入已有 Remote | 同一 `performance.timeOrigin` 页面即时更新，未销毁重建；恢复跟随系统14px也通过 |
| 已有系统通知 → 结束后台进程 → 点击通知 | `am kill` 后 PID 不存在而通知保留；实际点击系统通知打开唯一 Remote WebView，正确聊天已加载且深色17px保留。[冷入口报告](../../artifacts/phone-appearance-check-cold-android.json)、[截图](../../artifacts/phone-appearance-cold-chat.png) |
| 测试后恢复 | 冷入口脚本的清理最初因普通页面尚未创建而失败；已添加等待，并单独运行[恢复阶段](../../artifacts/phone-appearance-restore-cold-android.json)成功，普通与 Remote 均跟随系统14px，App 回普通首页 |

测试过程仅在专用“DSHM Remote 联调提示”发送一条无工具标记消息。未修改 Key、地址、设备权限或通知开关；DSH 与网关未重启。

最初冷启动脚本尝试 `adb am start` 私有 RemoteActivity，被 Android 拒绝，不是 App 崩溃；[原失败报告](../../artifacts/phone-appearance-invalid-cold-entry.json)保留。最终使用实际通知 PendingIntent，Activity 仍不对外导出。`prepare-cold/check-cold/restore-cold` 分阶段验证与恢复，不伪造原生桥事件。

## 自动检查与剩余范围

- [JS 测试](../../tests/phone-appearance.test.mjs)覆盖白名单、串行写入、失败重试、插件禁用、系统主题变化、迟到与卸载；全套246项通过。
- [原生检查](../../android/app/src/androidTest/java/dev/dshmobile/validation/PhoneAppearanceChecks.kt)以独立测试偏好存储验证类型、范围、持久化与监听清理，`appearanceOnly=true` instrumentation 通过，不触碰用户配置。
- RemoteApp 五种恢复回放、Web 构建、普通 APK/测试 APK 构建及 Android lint 通过，新普通 APK 已覆盖安装到 MuMu。
- 尚未完成 Remote 全界面语言同步、所有第三方插件局部界面、原生对话框与状态栏的完整外观适配；系统深浅色变化已由上方2026-09-27专项在MuMu实际切换并验证页面与草稿保留。此项不代表 A05 或完整 Remote 交付。
