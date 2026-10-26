# Remote 首页独立界面插件

2026-10-26：新版首页已从APK拆为外部包，当前实现、固定APK验收与开发入口见[外部插件专题](./external-phone-plugins-current.md)。下文随包chunk及旧菜单证据保留为历史，不代表当前分发方式。

当前插件管理以[KKC-100统一方案](./phone-plugin-management-current.md)为准：安装/卸载/启停和宿主真实运行状态都由统一目录与管理器提供，加载器不再保存选择。下文KKC-97/98/99保留阶段性历史证据。

状态：本地实现、页面验证及MuMu真实电脑连接验收通过，已安装原签名非调试候选，未提交、推送或公开发布；维护：DSHM 手机端维护者；最近核验：2026-10-25；实现任务：[KKC-97](https://linear.app/kkcodes/issue/KKC-97)，设备验收：[KKC-98](https://linear.app/kkcodes/issue/KKC-98)，统一插件页：[KKC-99](https://linear.app/kkcodes/issue/KKC-99)。

## 边界与选择

本轮把新版 Remote 首页从宿主提取到[独立插件包](../../packages/remote-home-design/README.md)，通过[公开 API](../plugins/remote-home-api.md)与现有 Cordis/SlotRegistry 加载；[发布版默认首页](../../src/ui/DefaultRemoteHome.jsx)保留。连接、同步、搜索、导航、草稿和审批由宿主继续执行，不复制业务状态机，不修改 DSH、电脑插件或中转，也没有合入手机 npm 适配分支。

比较了两种实现：只将 JSX 移入一个内置组件成本低，但无法验证卸载和契约边界；本次选择独立包、动态模块、公开页面槽和真实 fiber 启停。它增加小型加载目录与偏好控制，但可以用其他同契约模块替换，并验证真实注册/清理。完整 npm 安装器与依赖解析另属独立工作，本次不做。

## 当前实现

- [加载器](../../src/mobile-interface-plugins.mjs)校验 API 主版本与目标槽，支持选择/禁用、保存失败、过期加载隔离、超时、渲染错误释放与显式重试。界面加载不阻塞核心 Remote 就绪。
- [首页投影](../../src/ui/RemoteWorkspace.jsx)只交付显示字段和限定操作；状态、审批提示和弹窗在插件样式根外。项目/搜索保留在宿主，阅读位置按过滤组合有界保存。
- [独立包](../../packages/remote-home-design/index.jsx)只导入 React 和包内样式，不导入任何宿主私有组件/模型/原生桥。样式限定插件根，关闭时实际撤下；颜色继承公共主题变量。
- 「普通聊天抽屉 → 插件 → 手机 → Remote 新版首页」统一管理版本、启停和运行状态；停用即默认首页。Remote菜单不再含「手机界面」。详见下节新增入口验收。

## 手机插件页统一管理（2026-10-25）

用户纠正管理入口后，不再使用Remote二级菜单。选择继续由通用安装目录定义，不按包名分支；插件页复用原手机插件列表与详情样式。样例没有额外配置项，详情提供启停、版本、来源、运行状态和失败重试，不编造设置。已有普通聊天插件的安装/卸载/设置入口保持。

当时比较普通聊天与Remote各写一份localStorage、Application共享偏好两种方案，采用共享偏好桥＋原生MobilePluginPreferences。该阶段只统一选择，尚未统一安装/卸载；后续已由[通用管理器](../../src/phone-plugins.mjs)与PhonePluginStore取代，旧偏好只用于迁移。历史验收说明：桥只向两个自有主框架开放，Remote才能初始化迁移及报告运行状态；不传脚本地址、不接触Key/授权/会话。选择持久化、运行状态内存化，状态事件不重建插件；旧停用与手机明确选择优先。当前安装和生命周期规则以KKC-100专题为准。

| 入口与状态 | 验证结果 |
| --- | --- |
| 插件页搜索/详情/启停 | rc.2与alpha.2实际PhonePluginsPage、React/Cordis/RemoteModel和隔离桥协议回放通过；原Remote菜单入口不存在 |
| 离线/尚未打开Remote | MuMu普通聊天抽屉实际打开插件页，准确显示「Remote 新版首页」；先启用显示等待连接，进入真实Remote后加载并报告运行中 |
| 跨来源实时生效 | MuMu切回前台插件页停用，后台真实Remote同一模型保持connected、页面槽归零，默认首页出现；重新启用恢复一个槽 |
| 实际核心重连 | 现有官方DSH alpha.2＋电脑插件0.1.81＋公用中转，连接世代1→2且原界面fiber保持；无模型消息或电脑配置写入 |
| 迁移与持久化 | 新增4项Node覆盖双客户端、旧停用迁移、用户选择优先、离线设置、重试及过期消息；Android隔离偏好专项通过持久化、显式默认、所有权释放与非法字段校验；最终覆盖安装后插件页仍为已启用 |
| 全量及构建 | 586项Node通过；rc.2/alpha.2页面矩阵、APK debug/release与AndroidTest编译、release lint通过；旧重复翻译键警告保持原范围 |

证据位于`artifacts/tests/mobile-interface/plugin-page/verification.json`、`list-running-debug.png`、`release-plugin-list.png`及原签名非调试候选。测试仅临时调试本手机候选，最终恢复非调试版并移除专项测试包，保留主包数据及原配对；没有修改DSH/电脑插件/中转，没有合入npm适配分支或推送发布。以下KKC-97/98章节保留原入口的历史验收背景，不代表当前管理路径。

## 验证记录

专项脚本：[verify-mobile-interface](../../scripts/verify-mobile-interface.mjs)；控制器测试：[mobile-interface-plugins](../../tests/mobile-interface-plugins.test.mjs)。

| 验收入口 | 实际结果 |
| --- | --- |
| rc.2 / alpha.2 实际首页 | 独立ESM chunk经浏览器请求加载，真实Cordis注册页面槽；没有导入宿主私有组件 |
| 手机插件页→Remote新版首页 | 当前脚本经实际详情开关启停，释放注册及style，保留项目/查询；页面重载读取共享选择 |
| 断线和核心重连 | 明确渲染离线提示后恢复，以及真实连接控制器创建新世代；首页挂载次数保持，写入口禁用、查询保留 |
| 已有聊天内切换外观 | 同一个会话引用、草稿保持；没有重新选择或发送消息 |
| 阅读位置 | 完整列表滚动140px，切换默认/新版仍为140px；默认首页原有行高与滚动样式也已恢复到局部作用域 |
| 渲染故障 | 通过构建探针使真实页面槽组件抛错，原错误账本退位并释放界面fiber；默认可操作，显式重选恢复 |
| 非指定插件 | 另一个通用模块注册同一页面槽并成功显示；公开props仅为apiVersion/view/actions/t/locale，不依赖样例包名分支 |
| 样式与返回 | 第三方设置页自有5px焦点样式保持；320/390明暗与公共主题颜色通过；新版与默认均通过真实列表进入、项目、忙碌、自有弹窗、插件菜单/模态/侧面板/设置返回矩阵 |
| 模块与控制器 | npm pack四文件约4.5KB；解包后独立esbuild仅打入包内index/styles，React外部共享。实际Cordis的8项启停/迟到/兼容/失败/超时/保存失败测试通过 |
| 原恢复和构建 | RemoteApp的19种隔离恢复用例通过；582项Node通过；官方rc.2页面构建通过。构建保留旧有重复翻译键警告，未为此混入无关修复 |

本机证据位于忽略目录 `artifacts/tests/mobile-interface/`：两版 `report-*.json`、明暗窄屏截图、`package-check/`归档与独立编译结果。另有 `artifacts/remote-app-recovery.json` 和 `artifacts/tests/remote-design/home-report.json`。

测试曾发现默认首页退回时缺少被本轮设计替换掉的旧列表样式，现按默认首页根范围恢复，连续切换和滚动验收通过。阅读位置通过挂载时的公开 `readScroll()` 读取，避免只更换插件时使用旧投影。临时测试数据必须保留真实目录行的完整结构，不能用损坏投影导致根插槽退位后误判插件状态。

以上自动页面矩阵运行于真实 React/Cordis/SlotRegistry/RemoteModel/RemoteWorkspace，电脑数据使用隔离协议回放；设备和真实链路验收另见下节，不将两者混为同一测试。

## MuMu真实链路验收（2026-10-25）

用户追加授权安装和真实联调后，在MuMu 0号实例、Android12、ADB `127.0.0.1:16384`执行。该实例开始没有DSHM，先安装临时调试候选并建立新配对；保留现有电脑上其他设备授权，不授予本次手机电脑管理权限。测试结束覆盖安装同签名非调试候选，保留新配对和界面偏好，留在新版Remote首页供用户体验。

- 电脑沿用正在运行的官方DSH `0.2.1-alpha.2`、已安装电脑插件 `0.1.81-latest.0`，通过现有公用中转真实连接；读取167个工作区、313条会话目录。没有更新或改写DSH/插件/中转，没有合入独立npm适配分支。
- 通过实际「Remote选项→手机界面」切换默认/新版，真实页面槽注册数0/1；项目`4b97caa7`及查询保持。打开既有专用验收聊天，切换界面后仍为同一个会话引用，未发送草稿保持；验收后恢复测试前草稿。
- 实际关闭模拟器Wi-Fi导致公网连接中断，MuMu原生窗口看到离线提示与原聊天/草稿。Wi-Fi同时中断ADB/CDP，因此不能将18秒调试等待超时描述为App未离线；使用MuMu厂商`sh`通道恢复Wi-Fi后重新附着同一进程，App自动恢复。连接世代1→2，RemoteModel、会话引用、界面fiber和页面槽条目均为原对象，草稿、项目、查询保持。未修改电脑端连接配置。
- 真实长项目列表滚动约180CSS像素，默认/新版切换前后三次均为`179.73333740234375`，符合实际设备像素精度；不使用浏览器整数假设误报失败。
- 最终安装`0.1.0-preview.13-interface` / code16 / `dev.dshmobile.validation.officialtest`，证书SHA256 `d97f5b68c6a327f4ae455834ba30f23ce7b64f2eeafd8a222e0e74b0a998e51e`。APK及设备安装包SHA256均为`6b8e2cbbcaf117629c188482366c0bdcf2c8833f3d60be25f7028e1cae761e8c`，无DEBUGGABLE标志；APK内独立首页chunk与当前CI Web构建字节一致。
- 非调试版从普通聊天抽屉实际进入Remote后无需重新配对，自动连接并保留此前选中的默认首页；再通过模拟器可见界面启用新版，实际显示已连接与项目。验证没有卸载/清除主包数据，没有读取或录入模型Key，没有发送模型消息或执行工具审批。

证据：忽略目录`artifacts/tests/mobile-interface/live/verification.json`、`release-final-home.png`、`real-default-home.png`、`actual-reconnected-chat.png`，以及原签名候选APK、签名报告和设备UI层次。自动故障回退此前两版SDK页面矩阵通过；本次尝试CDP拦截本地界面资源未命中Android资产加载，阻断数0，未制造故障，不计作Android自动故障回退通过。真实设备已验证用户停用后的默认回退，不扩大为物理手机或全部网络/错误组合验收。

```powershell
node --test tests/mobile-interface-plugins.test.mjs
node scripts/verify-mobile-interface.mjs
node scripts/verify-mobile-interface.mjs --alpha2
node scripts/verify-remote-plugin-slots.mjs --design-home
node scripts/verify-remote-app-recovery.mjs
node --test tests/*.test.mjs
node scripts/build-web.mjs --latest-candidate --official-candidate --official-rc21
```
