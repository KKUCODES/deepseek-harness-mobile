# Remote 电脑插件管理

- 状态：包管理与部分原配置已接入；长安装回执、网关重连、页面重建取消、安装脚本批准与运行中取消、下载阶段撤权、DSH重启未知结果及应用阶段取消过晚已在MuMu验证。完整R13继续实施。
- 维护角色：DSH Mobile 项目协作 Agent。
- 最近核验：2026-09-27（核对已有验收报告，未重跑历史测试）。
- 来源：[手机入口](../../src/ui/RemotePlugins.jsx)、[局部插槽](../../src/remote-plugin-slots.jsx)、[权限策略](../../../backend/packages/protocol/src/remote-policy.ts)、上游[原管理组件](../../../deepseek-harness/packages/client/ui-plugin-manager/src/client/PluginManagerPage.tsx)与[原控制器](../../../deepseek-harness/packages/client/ui-plugin-manager/src/client/manager-store.ts)。

## Host升级的重启边界（2026-10-03）

状态：原提示冲突已修复，正式MuMu安装/升级、实际DSH重启生效和清理通过。维护角色：项目协作Agent；核验日期：2026-10-03。来源：[兼容补丁](../../../plugin/compatibility/plugin-restart-notice/README.md)、[真实设备报告](../../artifacts/plugin-restart-run-android.json)、[实际截图](../../artifacts/plugin-restart-required-android.png)、[只读断言](../../scripts/check-plugin-restart-report.mjs)。

原Host对已有包安装明确返回restart-required，页面却仍显示“立即启用”，控制器继续提交启用。这不能保证已缓存Host模块换版。补丁保留原“下次启动后加载”和“完成”，禁止此时再次启用；可立即应用的新安装不受影响。选择遵守原重启契约，未另建热替换机制。

在实际DSH安装三文件补丁后，手机安装专用Host包0.0.1并立即启用，执行记录为PID18788/0.0.1；手机再安装同名0.0.2，窗口无“立即启用”，关闭后Host记录仍为0.0.1。正常重启DSH后，PID51668实际执行0.0.2，手机详情显示v0.0.2与一个运行中组件。随后手机卸载测试包，管理权限收回且管理入口明确拒绝，原联调聊天/空草稿恢复，页面错误为空。APK、网关和0.1.75插件包未改。

严格类型检查、原客户端构建及四项自动回归通过，真实运行目录三文件哈希匹配。测试读取固定before/after产物，在安装后仍能复现原问题。该证据关闭同名Host换版的具体待核查项，不把客户端换版推断成Host热更新，不承诺任意第三方依赖或升级副作用回滚。

## 真实模型搜索与手机结果（2026-10-03）

状态：正式 MuMu 发消息、电脑真实模型调用官方搜索服务、手机读取来源及恢复通过。维护角色：项目协作 Agent。来源：[实际操作记录](../../artifacts/real-search-run-android.json)、[电脑原日志](../../artifacts/real-search-session.zip)、[只读核验脚本](../../scripts/check-real-search-archive.mjs)、[核验结果](../../artifacts/real-search-archive.json)、[手机工具详情截图](../../artifacts/real-search-details-android.png)。

在已有 DSH-TEST 工作区新建专用会话，选 Pro 并收紧为“仅可查看”，手机只发送一条消息，要求仅调用一次 `web_search` 搜索公开关键词。原日志证明：真实父请求使用 `deepseek-official/deepseek-v4-pro`；仅一次工具调用、一次 `web/deepseek-search-llm-request`，实际地址为 `https://api.deepseek.com/anthropic/v1/messages`，辅助模型为 `deepseek-v4-flash`，工具结果 `isError=false`，返回8条来源。手机工具详情中的8个链接与原结果逐项相同，模型最后回复包含实际来源URL及本轮完成标记。

从手机正式日志导出入口经 Android 保存取得 ZIP，SHA-256 为 `9822775e69b52147f6c5fe27eb029b751dee6978b5396362f1ca44b8d83ecc60`；`node scripts/check-real-search-archive.mjs` 只读断言通过。此证据补齐上一节受控401端点不能证明的真实模型/外部服务链路，不宣称每条外部网页内容或标题都独立查证，也不扩大为所有提供方支持保证。

专用会话已归档，手机本轮临时下载删除、项目证据ZIP保留，原联调聊天和空草稿恢复、页面错误为空。管理权限始终为false；未修改Key、地址、电脑配置、APK，也未重启服务。详情关闭按钮名称与归档后的自动返回导致的两次驱动定位超时已记录，未重复发送消息或归档写入。

## 共享 Key 与搜索地址的实际写入（2026-10-03）

状态：正式 MuMu 的原生密码入口、地址确认、原搜索服务 HTTP 传输及恢复通过。维护角色：项目协作 Agent。来源：[实际手机报告](../../artifacts/shared-key-run-android.json)、[只读断言](../../scripts/check-shared-key-report.mjs)、[夹具及复验步骤](../../tests/fixtures/live-shared-key/README.md)、[恢复后手机页面](../../artifacts/shared-key-restored-android.png)。

电脑默认聊天与搜索共用 `DEEPSEEK_API_KEY`。本次通过原 settings 服务临时让两个实际命名空间共用随机的新引用，不读取或替换用户原 Key。手机搜索原生窗口保存第一个公开测试值，官方入口显示已配置；官方原生窗口替换为第二个值，下一次搜索实际使用新值。手机移除后两个入口均未配置，原搜索服务在 HTTP 前返回 `WEB_PROVIDER_CREDENTIAL_MISSING`。

手机通过正式地址确认保存唯一 loopback 测试地址，原 `ctx.web.search` 的真实请求为 POST `/anthropic/v1/messages`，原 Messages 版本、模型、原搜索正文前缀、web_search 类型与次数均核对通过；两次请求分别匹配新旧测试 Key。端点刻意返回 401，**只证明设置与传输生效，不是外部搜索成功，也不是模型实际选择搜索工具的证明**。官方聊天地址保持默认继承，没有向外部发送测试 Key。

手机恢复搜索默认地址；夹具恢复两个凭据引用的默认继承并移除测试凭据，原 Key 状态回到已配置。手机卸载夹具后报告 disposed/cleaned，临时管理权限收回并实际拒绝设置入口，原联调聊天与空草稿保持、页面错误为空。DSH 72472、网关 24312 原进程保持，生产代码、APK、反馈目的地未改。

首轮正文断言漏算原服务添加的前缀；第二轮同名包升级后仍报告旧断言，未据此宣称 Host 更新通过。失败分别保留在 [首轮](../../artifacts/shared-key-first-run-android.json)和[第二轮](../../artifacts/shared-key-second-run-android.json)。最终独立包名的 0.0.3 在运行时明确核对版本，完整复验通过；同名 Host 模块刷新原因尚未确认，不能外推客户端插件换版结论。只读检查命令 `node scripts/check-shared-key-report.mjs` 不再次写入或发请求。

## 子任务模型授权的实际调用（2026-10-03）

状态：正式 MuMu 手机保存授权、新父会话实际调用不同子模型及恢复默认通过。维护角色：项目协作 Agent。来源：[实际操作与清理报告](../../artifacts/subagent-selected-model-run-android.json)、[原会话日志 ZIP](../../artifacts/subagent-selected-model-session.zip)、[日志断言脚本](../../scripts/check-subagent-model-archive.mjs)、[提取证据](../../artifacts/subagent-selected-model-archive.json)和[手机子模型显示](../../artifacts/subagent-selected-model-child-android.png)。

从手机原 Subagent 设置卡读取基线：模型选择关闭且继承默认，最大递归深度 1、并行上限 8。临时开启模型选择，仅勾选真实目录中的 `deepseek-official/deepseek-flash`，保存后重新读取确认。随后在已有 DSH-TEST 工作区新建专用会话，将父模型选为 `deepseek-v4-pro`、权限收紧为仅可查看。手机只发送一条测试消息，要求先查看可选子模型，再显式选择 Flash 创建一次性子任务；子任务只回复本轮唯一标记，不调用其他工具。

父子真实回复均在手机读取；子会话“当前模型”选中 Flash，父会话保留 Pro。进一步通过手机正式“导出会话日志 → 包含子会话 → 导出并保存”取得原电脑记录，脚本核对两份日志的父子 ID、`subagent/model-selection-policy`、实际 `request/header.header.config` 和 `tool/call`：父请求是 Pro，子请求是 Flash；父工具依次为 `list_subagent_models`、`subagent`，后者明确传 provider/model，子工具调用数为零；两端 assistant/message 含真实预期回复。因此不是仅保存配置、默认模型继承、模型口头声称或 UI 标签证明。

手机恢复模型选择的默认继承后再次读取：开关关闭、覆盖入口消失；只打开草稿检查两个模型均未勾选，再丢弃草稿，运行限制保持原值。专用父会话归档，手机临时导出下载删除，证据 ZIP 留在项目 artifacts。管理授权已收回并重连，原联调聊天与空草稿恢复、无通知和页面错误；未修改用户 Key、模型服务地址或重启电脑服务，未改生产代码/APK。

复验归档断言：在手机项目运行 `node scripts/check-subagent-model-archive.mjs`，本次已通过；该命令只读取已导出的本轮记录，不重新调用模型。操作中菜单遮挡、模型选择器保存后自动关闭、父标题追加子导航导致的选择器/标题断言失败已保留在报告说明，没有重复发送模型消息。此项关闭“Subagent 授权模型在新会话中实际调用未验”的具体缺口，不外推任意第三方模型、后台可继续子会话或既有会话重采样设置。

## 手机发起同名插件升级（2026-10-03）

状态：当前正式 MuMu、原电脑插件管理服务与本地网关的真实升级通过。维护角色：项目协作 Agent。来源：[两版夹具与复验步骤](../../tests/fixtures/live-upgrade-v1/README.md)、[实际运行与恢复报告](../../artifacts/plugin-upgrade-run-android.json)、[电脑返回的新版详情](../../artifacts/plugin-upgrade-installed-android.png)、[新版局部界面](../../artifacts/plugin-upgrade-v2-android.png)。本轮没有修改或安装产品 APK。

从 DSHM 自有 Remote 页面打开原局部管理组件，经「添加插件」提交专用包 0.0.1，立即启用后管理详情显示 v0.0.1、一个组件运行中；同一聊天的原 turnTail 插槽加载第一版卡片，按钮从 0 增加到 1。随后沿同一手机入口提交同名包 0.0.2，电脑管理详情显示 v0.0.2，手机局部界面实际切为第二版，新按钮可交互。13 个已加载轮次对应的卡片数量保持，旧版卡片为零；未把安装回执或版本号单独当作运行成功。升级回执出现过“下次启动后加载”提示，本测试实际在点击“立即启用”后观察到新版局部界面；不外推任何含 Host 状态的插件均可热更新。

正式手机卸载测试包后，管理清单、客户端目录和所有测试卡片均消失；原聊天标题与空草稿保持，无页面错误。临时管理已收回，重连后手机管理入口明确拒绝、聊天授权保留。未发送模型消息、改 Key 或重启 DSH/网关。首次调试器等待授权变化前的聊天根节点超时、安装完成后仍等待旧弹窗标题超时均保留说明；重新读取实际页面后继续，没有重复提交未知写入。报告的旧复制按钮计数未匹配节点，不用于证明历史消息数量；本次仅断言标题、空草稿和已加载卡片数量。

此专项关闭“手机发起插件升级缺独立证据”这一具体缺口，覆盖本地归档同名包更新、手机实际局部界面换版及卸载/收权。不能替代远程仓库的所有包源、任意依赖迁移或安装脚本外部副作用验证；其他首版工作见[当前收尾表](./completion-audit.md)。

## 实现边界

手机插件列表已增加[缺依赖诊断与实际验收](./remote-current.md#插件依赖诊断2026-09-26)，不再只显示“暂不可用”。详细依赖默认折叠，已有具体兼容限制优先；没有改变管理权限或原插件内部。

### Subagent 模型保存与恢复默认（2026-09-26）

手机原 Subagent 卡片已通过真实模型选择保存、桌面同步及恢复继承验收。[DSHM 外层](../../src/remote-plugin-settings.jsx)补充“恢复模型选择默认设置”，不修改原插件表单内部。比较重新关闭开关与删除覆盖值：关闭开关仍会留下自定义模型列表，因此恢复默认一次性 unset `enabled/allowedModels`，使用确认时的 revision，不触碰运行限制。仅存在覆盖且表单无草稿/写入时可操作；电脑配置或连接变化会取消旧确认，未知写入结果保留提示、不自动重发。

本轮开始时 DSH/网关已停止，核对原启动参数后恢复源码服务23668与网关51356，3080/8787正常；没有为本次设置验收再次中断服务。新版APK覆盖安装到MuMu，原绑定保留。沿用既有临时管理授权，实际入口为“Remote选项 → 电脑插件 → 管理电脑插件 → Subagent”。

- 03:52:22 UTC，[保存报告](../../artifacts/plugin-manager-subagent-model-write-android.json)：原模型开关关闭、两个模型字段均无用户覆盖，选中电脑目录的 `deepseek-official/deepseek-flash` 后保存并重读；电脑已打开的原设置页自动变为开启且同一模型选中。深度1、并行8及各自继承状态保持。
- 03:52:40 UTC，[恢复报告](../../artifacts/plugin-manager-subagent-model-restore-android.json)：先取消恢复确认，配置保持；再确认恢复并重读，开关关闭、覆盖入口消失，重新打开草稿确认模型列表无勾选后丢弃。电脑原设置页同步关闭。已查看[确认截图](../../artifacts/subagent-model-reset-confirm-android.png)与[恢复截图](../../artifacts/plugin-manager-subagent-model-restore-android.png)。
- 03:53:37 UTC，[最终权限报告](../../artifacts/subagent-model-final-denied-android.json)：收回管理权限后手机拒绝管理入口，电脑显示“聊天与任务操作”；聊天授权、绑定及待批准031保持，页面错误为空。

[专项组件回归](../../scripts/verify-subagent-settings.mjs)使用原卡片/控制器、真实schema与隔离传输，覆盖模型/数值草稿阻止恢复、取消不写、版本/连接使确认失效、跨语言确认、两个字段原子移除、保留原数值覆盖以及未知结果不重发，[结果](../../artifacts/subagent-settings-browser.json)通过。315项手机测试、Web/APK构建和Android lint通过，详见`artifacts/subagent-model-{tests,build,android-build,browser}.log`。Android验收扩展既有[脚本](../../scripts/verify-plugin-manager-android.mjs)的`subagent-model-write/restore`阶段，只在默认无覆盖基线运行，需显式`DSHM_RUN_LIVE=1`。

没有发送模型请求、修改Key或模型地址；本批证明设置真实保存、同步与恢复，**新会话实际调用授权模型**仍未验证。完整第三方配置和R13其他异常仍在推进。下方较早“模型授权未保存”描述仅代表其当时的历史结果。

### 应用阶段取消过晚已实测

2026-09-25 10:39:40 UTC开始的[真实MuMu报告](../../artifacts/plugin-manager-install-applying-android.json)通过：手机原管理页安装并启用[临时排队插件](../../tests/fixtures/applying-gate-plugin/index.js)，它在真实`plugin-manager/install-state`的applying事件前沿向原HMR队列提交最长45秒的等待事务；不替换安装、取消或回执服务。随后从手机安装[无操作测试包](../../tests/fixtures/applying-target-plugin/package.json)，确认原安装弹窗进入applying，再重建同一Remote页面，从“最近插件操作”找回唯一在途安装并点击“取消此次安装”。

原电脑管理器返回too-late，手机明确显示“插件正在应用，已无法取消，请等待结果。”；手动刷新并经过自动轮询后提示仍在，记录保持pending。释放临时队列后，同一条记录变为“已完成”，过晚提示消失，原列表确认测试包已安装但未启用。已核对[应用中截图](../../artifacts/plugin-manager-install-applying-running-android.png)、[取消过晚截图](../../artifacts/plugin-manager-install-applying-too-late-android.png)和[完成截图](../../artifacts/plugin-manager-install-applying-complete-android.png)。这覆盖真实applying边界与页面重建后的查询/取消入口，不是Windows关机或任意插件副作用回滚测试。

[专项脚本](../../scripts/verify-plugin-applying-android.mjs)由[现有Android验收入口](../../scripts/verify-plugin-manager-android.mjs)的`install-applying`阶段调用，仍需`DSHM_RUN_LIVE=1`、`DSHM_ANDROID_SERIAL`和`DSHM_PROFILE_DIR`。临时插件只读取项目artifacts内固定控制文件；等待有45秒上限，脚本finally释放队列，并通过原手机管理入口卸载两个测试包，删除本轮控制文件。package.json、pnpm-lock.yaml及pnpm-workspace.yaml解析内容与开始前一致，页面错误为空，正常返回Remote。没有模型请求、Key或服务地址变更；产品代码/APK未改。

10:40:35 UTC的[最终拒绝报告](../../artifacts/plugin-manager-applying-final-denied-android.json)确认临时管理权限已收回，手机管理入口正确拒绝；原聊天授权、031待批准状态保留。DSH43052与网关57392保持运行，无package.json.lock遗留。本节为当前结论，下方applying待验收为历史阶段记录；任意第三方插件、其余服务/Worker及完整Remote仍未完成。

### 下载中强制结束DSH后的未知结果已实测

2026-09-25 10:16:27 UTC启动的[真实MuMu报告](../../artifacts/plugin-manager-install-restart-android.json)通过：一次本地测试归档下载已建立，但测试端不发送内容；核对DSH53852身份后结束进程，手机观察到断线。核对专用URL后结束遗留下载进程34348，并在确认53852已退出、锁内容仍是53852后清理其package.json.lock；按相同源码启动参数恢复DSH43052，网关57392保持。脚本沿同一WebView重开管理页，显示同一目标的unknown记录；performance.timeOrigin不变，三份profile配置哈希保持，测试服务仅收到一次下载请求且连接关闭，页面错误为空。已核对[手机截图](../../artifacts/plugin-manager-install-restart-android.png)，没有重试安装入口；返回正常。本次没有安装新插件、执行安装脚本、发送模型请求或改动Key/地址。

本轮只修改[验收脚本](../../scripts/verify-plugin-manager-android.mjs)：电脑换代导致客户端重建、管理页关闭后，从同一页面重新进入管理页，并核对WebView未重载；操作记录已展开时不反向收起。产品代码和APK未修改。电脑显示原设备已恢复聊天与任务权限，最终[手机管理拒绝检查](../../artifacts/plugin-manager-restart-final-denied-android.json)通过；031保持待批准。

**恢复边界**：这是DSH进程强制退出及人工核验清理后的恢复，不是Windows整机重启，也不是自动回滚或自动清锁验证。上游[withFileLock](../../../deepseek-harness/packages/util/atomic-write/src/index.ts)明确把遗留锁恢复留给操作者；不能仅凭锁年龄删除。此前08:50测试的package.json.lock内容为19608，该进程已退出。本轮前两次安装因此等待120秒后返回锁超时，没有下载；[可见错误证据](../../artifacts/plugin-manager-orphan-lock-visible-android.json)和[清理记录](../../artifacts/plugin-restart-download-timeout-cleanup.json)保留。确认请求结束、旧进程不存在且锁内容未变后只删除该锁，才进行最终有效测试。中间一次脚本被尚未关闭的失败弹窗遮挡，未再提交安装。早先“重启后没有未知提示”观察对应已超时失败的操作，不能当作摘要丢失缺陷；最终真实在途测试已证明摘要保留。

当前源码服务43052和网关57392正常，专用下载子进程与遗留锁均已清理。本次通过未知结果专项；applying竞态、任意第三方插件及完整Remote其他边界继续保留。下方离线、未安装、权限待收回及此项待验收描述均为历史记录。

### 服务恢复与新版APK复核

2026-09-25 09:31 UTC，用户恢复原源码启动方式后，DSH41308监听3080、网关57392监听8787，电脑插件0.1.40显示已连接。通过电脑插件页核对原DSHM Android指纹后收回遗留临时管理权限，页面明确变为“聊天与任务操作”；031仍待批准，未操作其他设备。profile的package.json、pnpm-lock.yaml和pnpm-workspace.yaml哈希与重启测试种子一致。

覆盖安装上一轮已构建的新APK，不清除应用数据。[实际手机管理拒绝报告](../../artifacts/plugin-manager-recovery-denied-android.json)确认无管理授权时没有管理组件，返回正常、页面错误为空。[只读聊天检查](../../artifacts/remote-service-recovery-android.json)通过正式Remote入口读取专用联调聊天：本地页面/assets/web/remote.html、22条当前页模型回复、一个输入框、无iframe，错误及失败资源为空；已核对截图，原DSHM_LANGUAGE_DRAFT_20260925草稿保留。没有发送模型请求或改动Key、地址、插件配置。

此前等待服务与权限清理的阻塞已解除。此次属于恢复后新APK连接/读取检查，不能证明此前在途安装结果跨电脑重启后的unknown显示；该专项及applying竞态仍未验收。本次未再中断DSH，也未重新授予管理权限。下方“服务离线/尚未安装/权限待收回”为此前批次事实。

### 未确认摘要与管理列表的迟到响应修复

2026-09-25，DSH恢复仍待用户操作，本轮未重启电脑服务、未安装APK、未再次授予权限。继续通过实际[操作通道](../../src/remote-plugin-operations.mjs)和[列表组件](../../src/ui/RemotePluginOperations.jsx)检查已有修复。

[回归测试](../../tests/remote-plugin-operations.test.mjs)新增两项RED：列表pending快照迟于确定完成响应返回，把状态降回pending；绑定切换后旧请求返回，污染新绑定摘要。修复分别保留同一世代已确认终态、核对请求开始时的绑定摘要对象并拒绝迟到结果；列表读取也绑定操作通道生命周期，撤权或释放时取消读取。10项针对性及全部263项手机测试通过。

内置浏览器使用[隔离入口](../../tests/fixtures/plugin-operation-history.jsx)和[回放服务](../../scripts/serve-plugin-operation-history.mjs)，直接渲染产品组件，响应由显式测试替身提供，不连接DSH/网关、不加载原生桥、不执行实际安装或权限变更。观察到读取拒绝仍保留旧行与取消按钮、too-late提示被自动列表刷新抹掉；修复后按下表手动回放通过，临时页面和服务均已关闭。

| 场景 | 实际组件观察 |
| --- | --- |
| unknown且列表收起 | 仍显示未确认提示；展开后显示同一操作，没有取消或重装入口 |
| 进行中操作取消返回too-late | 明确显示已无法取消，刷新后保留 |
| too-late后转unknown | 移除旧“正在应用”提示，避免与未知结果矛盾 |
| 列表读取拒绝 | 清除旧行与取消按钮，只显示读取失败和刷新入口 |
| 切换英文与离线 | 英文文案正确；离线不显示旧未知提示或操作行 |
| 连续查看/切换状态 | 测试取消调用计数保持1，仅对应手动点击一次，未自动提交写入 |

这是组件回放及协议回归证据，不能替代真实MuMu重启、真实applying竞态或完整设备撤销。Web、最终APK构建及Android lint通过，76文档1917本地链接校验通过，新APK未安装；真实电脑仍离线，原临时管理权限仍待恢复后收回。

### 电脑重启的未确认操作：手机已修复，真实复验待恢复服务

2026-09-25本轮源码检查发现，[手机操作通道](../../src/remote-plugin-operations.mjs)原本只依赖电脑内存回执。电脑换代返回空列表后，本次未确认操作会从管理页消失。新增[回归](../../tests/remote-plugin-operations.test.mjs)以真实RemoteClient/Transport配合协议替身验证：原代码返回0条而期望保留1条未知结果，RED成立；修复后换代、核心重建、绑定隔离、列表与完成交错、管理拒绝等8项通过。该隔离测试不是实际电脑重启后的手机验证。

现在手机只在当前RemoteClient进程内保留有界操作摘要（编号、来源世代、目标、时间、状态），不保存完整参数，不构造重放队列。未确认操作在电脑换代后转为unknown，已确认完成记录仍按电脑列表清空；新绑定不继承旧绑定摘要。历史读取先完成电脑管理授权RPC，失败不返回本地摘要。完成/未知摘要按一小时清理，最多保留64条已结束摘要；在途项不因时间被删除。关闭或重新加载整个WebView会丢失本地摘要，不承诺跨App进程持久化。管理页未展开时也会提示存在未确认操作。来源另见[模型绑定](../../src/remote-model.mjs)、[列表组件](../../src/ui/RemotePluginOperations.jsx)。

真实验收[报告](../../artifacts/plugin-manager-install-restart-android.json)及[种子](../../artifacts/plugin-manager-install-restart-seed.json)：08:50:05 UTC启动，本地测试URL确实开始下载，未发送包内容。强制停止已核对的DSH19608后手机显示断线；pnpm测试子进程16336仍存活。随后“结束已核对测试子进程并重新启动DSH”的组合命令被自动审批拒绝，只返回blocked by policy，没有更具体理由；没有换工具绕过。已请求用户恢复DSH，恢复前等待120秒后验收结束，不能记为结果恢复已通过。测试HTTP服务finally关闭，16336随后自行退出；原profile三份文件哈希与种子相同，网关57392仍运行。

**交接状态**：DSH目前未运行，等待用户在原安装目录执行`pnpm dsh web`；不要再结束旧PID16336。DSHM Android本轮临时管理权限已授予但尚未收回，须服务恢复后立即清理，聊天绑定和031保持。本轮没有安装新版APK，不清除App现场/凭据，不把超时当作再次提交安装的理由。恢复后先核对权限与现状，再安装新版并复验；安装重启脚本涉及真正进程中断，不能无人核对PID后重复执行。

手机261项测试、Web/APK构建和Android lint已通过，后续仅增加摘要变更通知后重新通过8项针对性测试、Web/APK构建及lint。76文档1911本地链接校验通过。最终APK尚未安装，真实视觉和运行路径未完成。脚本执行中取消等此前结论继续有效，完整Remote未完成。

### 安装脚本运行中取消实测

2026-09-25 08:45:47 UTC，[真实MuMu报告](../../artifacts/plugin-manager-script-cancel-android.json)：使用[独立测试包](../../tests/fixtures/script-cancel-plugin/package.json)，[安装脚本](../../tests/fixtures/script-cancel-plugin/postinstall.mjs)只输出自身PID并等待最多90秒，不访问文件、环境变量或网络。经手机原管理页明确批准后，展开安装日志，读取PID38376并确认进程存活；点击“取消安装”，原输入页恢复时该进程已退出，包清单和锁文件与开始前逐字节相同，最近操作显示“已取消”。清理本次测试脚本批准；没有启用插件或发送模型消息。

[运行中截图](../../artifacts/plugin-manager-script-cancel-running-android.png)和[取消回执截图](../../artifacts/plugin-manager-script-cancel-android.png)已检查：日志在自身区域横向滚动，弹窗不横向溢出。页面控制台错误为空，返回Remote正常。08:46:11 UTC[权限检查](../../artifacts/plugin-manager-denied-android.json)确认管理权限已收回，聊天/绑定和031保留；DSH19608、网关57392未重启，产品代码和APK未变。

首轮[观察失败报告](../../artifacts/plugin-manager-script-cancel-hidden-log-android.json)因验收脚本未展开原日志而超时；原安装仍运行，随后正常完成90秒等待。核对真实完成状态后从原界面卸载，清理测试批准，才重新验证。不能把该超时称为产品取消失败，也未盲目重发仍在执行的安装。验收脚本现于批准后展开详情再等待进程标记。

复验命令为`node scripts/verify-plugin-manager-android.mjs script-cancel`，沿用下方显式环境变量要求。此项证明原pnpm脚本子进程可取消和原清单回滚；不代表能撤销任意第三方脚本已经造成的外部副作用。applying阶段竞态和电脑重启后的未知结果仍待验收。

### 安装脚本批准与下载阶段撤权实测

2026-09-25，沿用0.1.40、现有网关及正式APK，仅补充[验收脚本](../../scripts/verify-plugin-manager-android.mjs)与测试包，未修改产品代码或重启服务。

- [脚本批准报告](../../artifacts/plugin-manager-script-approval-android.json)，08:29:52 UTC：通过手机原插件管理界面安装[专用测试包](../../tests/fixtures/script-approval-plugin/package.json)。首次安装被原pnpm策略阻止，脚本未执行；点击原“允许这些脚本并重试”后，安装日志出现固定标记。测试脚本只输出标记，不访问文件、环境变量或网络。测试包未启用，随后从原界面卸载，恢复原包清单、锁文件和批准配置。
- 原批准配置以pnpm返回的完整包名及来源选择器为准，不能缩写为裸包名。原[批准服务](../../../deepseek-harness/packages/boot/plugin-manager/src/build-approval.ts)把批准持久保存，卸载不会自动删除。验收清理仅移除本次测试选择器，核对其余配置未变后恢复原文件；这不代表产品卸载会撤回脚本授权。
- [下载期间撤权报告](../../artifacts/plugin-manager-install-revoked-android.json)，08:34:48 UTC：真实pnpm下载开始后，收回管理权限，手机原管理界面及操作记录立即销毁；以聊天权限重连后无法访问。临时恢复权限后查询同一操作，电脑收到[有效但非DSH插件的测试包](../../tests/fixtures/non-bundle-plugin/package.json)，原管理器拒绝安装，手机显示原失败回执。没有重新提交安装，三份profile配置哈希未变；两次HTTP请求属于下载行为，不等于两次安装提交。
- [最终权限检查](../../artifacts/plugin-manager-denied-android.json)，08:36:18 UTC：再次收回临时管理权限，手机明确拒绝管理，保留聊天授权与原绑定。测试包及脚本批准已清理，无对应下载进程残留，031待批准设备未操作。DSH源码PID19608、网关PID57392保持，真实Key和服务地址未改。

测试工具的两次修正单独留证：[选择器断言失败](../../artifacts/plugin-manager-script-approval-selector-android.json)是验收程序误用裸包名，未批准脚本；[下载重试超时](../../artifacts/plugin-manager-install-revoked-download-retry-android.json)是故意损坏的归档触发pnpm重试，最终自然失败，未执行取消。随后改用有效非插件包获得明确失败结果，不能将这两项称为产品缺陷修复。

两个正式阶段均无页面控制台错误，截图已检查。执行需显式设置`DSHM_RUN_LIVE=1`、`DSHM_PROFILE_DIR`及设备序列号，再运行`node scripts/verify-plugin-manager-android.mjs script-approval`或`install-revoked`；后者需要在脚本提示后配合桌面撤权/恢复，结束必须收回权限。脚本执行中取消由上方独立实测覆盖；applying阶段竞态、电脑重启后的未知结果和完整设备撤销仍待验收。

### 0.1.40：长安装与结果恢复

来源：[电脑回执](../../../plugin/src/plugin-operations.ts)、[手机适配](../../src/remote-plugin-operations.mjs)、[操作记录](../../src/ui/RemotePluginOperations.jsx)。保留原管理组件和原RPC结果，将安装、卸载、包/组件开关拆为短提交与只读查询。单纯扩大30秒超时无法解决丢失响应，因此选择电脑有限回执；不扩大其他RPC时限。

网关/Host分别核验管理权限，记录按hostId+deviceId隔离。手机只提交一次，断线后只查同一编号；同编号在保留期内必须匹配原参数，同设备pending期间拒绝另一笔新写入。Relay实例最多64条，完成后保留1小时，pending不按时间驱逐。电脑重启或插件重载更换generation，旧查询明确失败；不承诺跨重启幂等或磁盘持久化。断线/取消读取/撤权不回滚已开始操作，显式取消仍走原cancelInstall和too-late边界。撤权后新写入与查询均拒绝。

手机“最近插件操作”可在页面重建后查看/取消本设备pending；不自动重装或恢复脚本批准。旧Host无能力字段时保留旧RPC路径，不保证长安装恢复；需同步更新三端。更新电脑插件后须重启DSH，不能只凭页面版本判断代码已加载。

2026-09-25 08:16:23 UTC起的[MuMu报告](../../artifacts/plugin-manager-install-long-android.json)：等待45,012ms，期间网关23868→57392真实重启，原弹窗仍running且可取消；第二笔下载后重新加载Remote WebView，丢弃原页面内存后查询唯一pending并取消。两次下载连接退出，package.json、pnpm-lock.yaml、pnpm-workspace.yaml哈希保持。测试服务不发送包内容、不执行脚本，最终无测试pnpm进程。两张截图已检查，无横向溢出。覆盖下载阶段，不代替applying、完成安装与脚本执行后异常。

首次[旧运行时报告](../../artifacts/plugin-manager-install-long-old-runtime-android.json)保留：包元数据已0.1.40，但“立即启用”未替换旧代码，故无新能力、断线仍失败。仅结束已核对测试URL的pnpm子进程10188后，以原源码命令重启DSH为19608；测试增加能力入口前置检查后通过，没有重试未知写入。原profile仍只有维护中的plugin包。

后端54、插件109、手机258项测试、后端/插件类型检查、Web/APK及Android lint通过；真实PostgreSQL项未启用。自动回归覆盖去重、原始失败、过期/容量、身份隔离、换代/缺失回执与撤权停止读取。0.1.40、新网关和APK已安装；08:18:21 UTC权限收回验证通过，聊天/绑定、031待批准、Key/地址保持。下载阶段撤权和脚本批准已由上方实测补齐；电脑重启未知结果、脚本运行中取消、applying竞态和任意第三方插件完整异常仍待验收。共用denied报告路径保存最新检查。

### plugin-install-cancel-v1：取消实际安装进程

2026-09-25 07:39:31 UTC真实[修复前报告](../../artifacts/plugin-manager-install-cancel-before-android.json)：手机提交只在本机监听、保持下载挂起且不发送包内容的tgz地址；电脑pnpm确实开始下载，点击取消后超时为request_timeout_outcome_unknown。观测到启动父进程退出而该测试URL的pnpm Node子进程57552仍存活，随后仅清理了这个已核对的测试进程。没有重试未知结果的安装。

[兼容补丁](../../../plugin/compatibility/plugin-install-cancel/README.md)在原runProfilePnpm与viewProfilePackage启用execa 10的killDescendants，覆盖安装/卸载取消、查询取消与超时。保留原取消确认、清单回滚和too-late边界；没有改手机原组件或把断线当取消。最初隔离的直接Node进程对照未复现pnpm.cmd原路径，因此不用它宣称RED；同一真实MuMu路径才是修复前后依据。

[修复后报告](../../artifacts/plugin-manager-install-cancel-android.json)，07:50:25 UTC：取消返回编辑保留地址且可再次提交，取消并关闭也正确退出；两次均先观测到真实下载开始，再确认连接退出，package.json、pnpm-lock.yaml、pnpm-workspace.yaml哈希不变。取消提示截图已检查；测试服务finally关闭，无安装包内容、无脚本执行、无新测试包。内置浏览器确认电脑仍只有原plugin包。

7项进程/安装恢复回归和严格类型检查通过，手机脚本语法检查通过。本轮只改兼容补丁、验收脚本与文档，未重建App或改网关；旧手机253项和APK/lint计数属于前一轮。三文件补丁已安装，DSH源码PID21580，网关60668、插件0.1.39保持。[权限收回](../../artifacts/plugin-manager-denied-android.json)07:51:46 UTC手机拒绝管理，聊天/绑定与031待批准状态保留，Key和模型地址未动。

该批之后，长安装与网关断线查询由上方0.1.40接入；通用RPC仍保持30秒超时。下载阶段撤权和脚本批准另已验证，脚本执行中取消、applying竞态需继续验收。本批不代表完整R13完成；denied报告路径会随最新验收更新。

### client-entries-v1：保留未变化插件页面

2026-09-25采用[受维护的原加载器补丁](../../../plugin/compatibility/client-entries/README.md)：新增syncSelected，保留完整依赖表，只增量更新选定apply入口。手机保留原管理页实例，不模拟恢复路径；完整诊断清单仍显示由手机承担和等待接口的模块。旧电脑无此方法时维持原重建，模块bootstrap改变归入核心重建。

回归先证实更新另一个模块会使本地计数1变0；补丁后修改、移除、重新加入与重连均保持1，桌面布局未加载，移除样式和最终全局清理通过。7项核心/安装回归、严格类型检查、手机253项、Web/APK构建及Android lint通过。核心测试首次清理误用ctx.dispose，改为与生产相同的拥有者fiber.dispose后通过；产品逻辑不受该测试错误影响。

本机已安装3文件补丁及新版APK，DSH源码入口PID7536、网关仍60668，插件仍0.1.39。真实MuMu的[组件关闭](../../artifacts/plugin-manager-component-off-android.json)07:28:39 UTC和[恢复](../../artifacts/plugin-manager-component-on-android.json)07:29:15 UTC均navigationReset=false，包始终启用；电脑原详情分别同步关闭/运行中。截图已检查，没有左侧裁切。

[安装与包启停](../../artifacts/plugin-manager-install-android.json)07:29:47 UTC、[清理](../../artifacts/plugin-manager-cleanup-android.json)07:30:01 UTC通过，电脑列表确认测试包消失。初次安装断言在原弹窗关闭、启用尚未结束时读取旧值失败；补充等待原开关启用完成后重跑成功，不以重复写入掩盖未知结果。[收回权限](../../artifacts/plugin-manager-denied-android.json)07:31:28 UTC手机拒绝管理，基本聊天和031保留，真实Key及模型地址未动。实际安装的恢复未执行，副本恢复已通过；完整在途撤销、任意插件依赖更新及Worker仍待验收。

### 组件启停与安装失败：当前证据和已知问题

以下为修复前复现记录；组件、安装、清理和拒绝报告已被上方最新验收覆盖，不能将旧时间与当前文件混用。

2026-09-25，插件0.1.39与既有新版App，无产品代码改动；扩展[真实Android验收脚本](../../scripts/verify-plugin-manager-android.mjs)的component-off/component-on/install-failure阶段：

- [安装失败](../../artifacts/plugin-manager-install-failure-android.json)，07:06:06 UTC：手机提交项目内[故意无效的归档](../../tests/fixtures/invalid-plugin.tgz)，真实pnpm报TAR校验失败、退出1且added0。原界面显示失败详情和重试，返回编辑保留路径，可关闭并刷新列表，没有误报安装成功。未执行重试或安装脚本；这不覆盖网络失败、安装中取消等其他路径。
- [组件关闭](../../artifacts/plugin-manager-component-off-android.json)，07:11:34 UTC；[重新开启](../../artifacts/plugin-manager-component-on-android.json)，07:11:48 UTC：独立测试包0.0.2始终启用，只有dshm-partial-ui-verification组件改变；内置浏览器分别核对电脑“已关闭”和“运行中”。手机截图已检查，缩放后无左侧裁切。
- **修复前缺陷**：两次切换均记录navigationReset=true，手机原详情退回列表。脚本第一次关闭等待超时，但电脑操作实际已成功；后续脚本只重新打开详情读取结果，不重放写入。随后由上方增量补丁修复，严格验收模式禁止此绕行。
- [手机卸载](../../artifacts/plugin-manager-cleanup-android.json)，07:12:07 UTC：测试包清理，手机和电脑列表均仅剩原安装包。收回临时管理权限后，[拒绝报告](../../artifacts/plugin-manager-denied-android.json)07:12:47 UTC确认不加载管理组件，保留聊天授权，未操作031或真实Key。

根因来自原[手机图同步](../../src/remote-plugins.jsx)：非core图变化也执行release/bootstrap/activate，卸载未变化的原管理页，其内部view回到list。原ClientEntries.sync会遍历全部modules，不能直接使用。当前已通过上方syncSelected补丁保留完整解析图和独立apply名单；没有复制原加载器到手机，也没有通过DOM重选掩盖实例丢失。

本轮仅增加测试脚本/失败归档及文档，不重建App、不宣称修复导航或完成R13；此前全量测试计数属于上一轮。

### 0.1.39：网页搜索当前边界与验收

[搜索入口](../../src/remote-web-search-settings.jsx)复用原CardForm、ValueField及PluginConfigForm控制次数；没有照搬原整卡的Web密码框，Key和服务地址分别复用DSHM原生密码窗口及目的站点确认。这一取舍保留原控件/持久化行为，同时不向页面提供假的credentials服务。三个区域独立保存，未承诺一次提交全部字段。

[Host Key](../../../plugin/src/computer-key.ts)只调用describe/set/unset，页面只得状态；target固定为web-search-deepseek，禁止任意引用和跨目标响应。搜索literal Key非空时只读，不回显；自定义apiKeyEnv仍明确拒绝。默认引用可能与电脑聊天共用DEEPSEEK_API_KEY，界面和原生窗口提示更换/移除会共同生效。[Host地址](../../../plugin/src/computer-endpoint.ts)核对原搜索源码的独立环境回退，引用原包默认常量；返回origin而非含隐私完整旧URL。generic settings仅开放maxUses，不能写apiKey或baseURL。

2026-09-25真实MuMu与内置浏览器对照：

- [读取与取消](../../artifacts/plugin-manager-search-inspect-android.json)，06:56:20 UTC：次数5且无覆盖；搜索站点为官方origin、Messages；已配置Key，打开原生密码窗口后取消，网页无password输入；地址输入测试域并核对后取消，没有保存。
- [次数保存](../../artifacts/plugin-manager-search-write-android.json)，06:57:00 UTC：5→6后重新读取为6/已覆盖，电脑原网页搜索配置同步显示6。
- [恢复默认](../../artifacts/plugin-manager-search-restore-android.json)，06:57:18 UTC：恢复5/无用户覆盖，电脑同步且覆盖标记消失。未执行模型/搜索请求，未写真实Key或地址；退出清除测试地址草稿。
- 原生隔离测试使用TEST_NATIVE_ONLY，不连接真实电脑：默认/搜索target、错误provider拒绝、取消、写入确认、未知结果锁定、语言切换均通过。真实入口首次脚本用Android返回只收起键盘，等待取消超时；改用观测到的原生取消按钮后通过，未重复任何凭据写入。
- 搜索界面[截图](../../artifacts/plugin-manager-search-inspect-android.png)已检查；外层420px缩放591px内容，scrollLeft=0，无左侧裁切。临时管理权限已收回；[拒绝报告](../../artifacts/plugin-manager-denied-android.json)06:59:47 UTC确认手机拒绝管理，保留聊天授权，设备031不变。

插件105、后端54、手机253项测试通过，后端另有独立PostgreSQL1项默认跳过；类型检查、三端构建、Android测试APK/正常APK与lint通过。正常新版App和插件0.1.39已安装，DSH源码入口PID71516、网关PID60668（后续需重新核对）。真实Key/地址更换、非默认引用、实际搜索调用与其他完整R13异常未验证；以下版本/PID/计数为历史记录。

### 原管理容器

入口为「Remote 选项 → 电脑插件 → 管理电脑插件」。DSHM 提供全屏容器和返回，明确渲染原 `main` 插槽的 `plugins` 局部组件，不启动桌面 root/layout，不打开远端网页或 iframe。安装检查、进度、取消、启停、卸载确认及配置子插槽沿用原控制器和电脑 profile。

插件0.1.36与新版网关额外放行原 `pluginInventory/list`，只接受空参数。原清单提供模块身份、启用/运行状态和管理标记；不扩展通用 settings/credentials 或任意 HTTP。网关与 Host 分别核验管理授权。旧电脑提示更新；断线不展示可操作管理组件。失败写入不自动重试，在途断线、模块重建与未知结果的完整专项仍待验证。

原组件的 Modal 使用 body portal，不能让安装窗口落在原生 dialog 的 inert 区域。DSHM 全屏容器与原弹窗保持同层级体系，后台聊天设为 inert、退出恢复；Android 返回先交给原弹窗，下一次回到插件列表。原聊天 DOM 保留。

原管理页与插件配置继续经过外层等比缩放，用户可在插件列表覆盖。实测发现 `overflow:hidden` 会被浏览器按缩放前宽度自动横滚137px，裁切左侧；[共享外层组件](../../src/ui/MobilePluginFrame.jsx)改为开启自适应时使用 `overflow:clip`，关闭后仍 `auto`。不修改插件内部样式；轮尾、扩展节点和工作流共享修复。

## 实际验证

[脚本](../../scripts/verify-plugin-manager-android.mjs)通过实际 Android WebView/UI，不直接调用写入 RPC、不注入模块替身。临时授予现有 DSHM Android 管理权限，不改 Key、模型地址、业务插件或聊天内容。

| 入口 | 结果与证据 |
| --- | --- |
| 普通聊天授权 | 拒绝进入管理组件；收回权限后重连再次通过，[denied](../../artifacts/plugin-manager-denied-android.json)，05:52:46 UTC |
| 列表与弹窗 | 真实官方/已安装包、输入后取消、Android 返回优先关闭安装弹窗、退出恢复聊天；[verify](../../artifacts/plugin-manager-verify-android.json)，05:50:13 UTC |
| 手机安装与启停 | 提交已审阅的项目内测试包0.0.2，立即启用、关闭再开启；电脑列表同步已启用，[install](../../artifacts/plugin-manager-install-android.json)，05:50:40 UTC |
| 手机卸载 | 原二次确认卸载独立测试包，电脑原列表确认消失；[cleanup](../../artifacts/plugin-manager-cleanup-android.json)，05:50:46 UTC。手机报告处于重读阶段，不单凭该截图证明最终卸载 |
| 缩放与返回 | 最终APK弹窗关闭及Android返回后，外层scrollLeft=0、子项left=0；420px容器缩放557px内容，[截图](../../artifacts/plugin-manager-verify-android.png) |

本机已安装插件0.1.36及新版APK，DSH源码入口 PID68016、网关 PID14184（后续操作重新核对）。测试包已清理、临时管理权限已收回，保留聊天授权、绑定、Key和历史；未操作待批准设备031。

后端51项通过、独立PostgreSQL1项默认跳过；插件101项通过；手机原246项全量通过，另新增能力策略用例及其文件5项通过。后端类型检查、三端构建、Android lint通过。[原组件回放](../../scripts/verify-remote-plugin-slots.mjs)通过，新增缩放开启不能横滚/关闭可横滚断言；旧定时文案空格断言先失败，改为允许合法空白后通过。

## 待完成

- 网页搜索真实Key/地址写入与实际搜索请求仍待专项；Subagent新会话实际指定模型调用已由[真实父子请求日志](#子任务模型授权的实际调用2026-10-03)验证，不能继续笼统列为待验。通用settings/credentials未开放，已接入配置不代表任意插件配置可用。
- 安装取消、脚本批准与运行中取消、下载阶段收回权限、网关断线、页面重建、DSH重启未知结果和应用阶段取消过晚已通过上方实际MuMu专项；不再把这些场景整体列为未验证。大型安装日志、其他安装形态/失败、副作用边界与完整第三方配置仍需补齐，已通过的取消测试不代表可回滚任意安装脚本副作用。
- [Worker资源在途撤销](./remote-current.md#worker资源在途撤销2026-09-26)和[已运行Worker随设备撤销退出](./remote-current.md#文件写入中撤销与插件线程释放2026-09-26)有独立设备证据。动态插件审批/运行/重连/电脑重启已有专项；动态运行器实际撤销、双设备目录同步、历史工具卡片Android及更广第三方服务仍待完成，见[当前矩阵](./remote-current.md#完成矩阵)。不能以单个插件通过推定任意第三方兼容。

## 0.1.37：原插件数值配置

[手机注册](../../src/remote-plugin-settings.jsx)直接复用上游 BashCard、AgentLoopCard 和对应 CardForm 控制器，仅以[局部 scope](../../src/remote-plugin-settings.mjs)适配 Host 数值投影。沿用原 `plugins.item` 页面和外层缩放；没有重写表单内部，也没有提供假的通用 settings 或 credentials 服务。选择局部适配，是因为直接开放原 describe 可能泄漏联合类型、未知字段和凭据头；另做整套手机表单会重复维护既有 UI。

[共享协议](../../../backend/packages/protocol/src/remote-settings.ts)扩展既有 `remote.settingsRead/settingsWrite` 的可选 namespace，仅允许 `shell` 与 `agent-loop`；省略时维持原五项 DeepSeek 设置契约。分别只接 `timeoutMs/maxOutputBytes` 与 `maxParallelToolCalls`。网关和 Host 都保留管理权限检查，协商增加 `pluginSettings`。

[Host](../../../plugin/src/computer-settings.ts)按字段校验 value/base/user 数值，不返回 schema、cwd、pwshPath、环境或任意未知字段；所有写入仍交原 SettingsProvider.mutate。快照绑定设备连接、namespace、原服务身份、resolved对象和revision，五分钟到期、一次使用；每个 namespace 的快照独立。手机不重发结果未知的写入，电脑外部变更/换代会使旧表单不可写，重新读取会丢弃旧草稿。

2026-09-25真实 MuMu：

- [读取](../../artifacts/plugin-manager-config-inspect-android.json)：终端120000/64000、Agent循环10；无Key读取或聊天发送。
- [保存](../../artifacts/plugin-manager-config-write-android.json)，06:11:47 UTC：手机超时120000→120001，重读后显示已覆盖；内置浏览器的电脑原配置页确认120001。
- [恢复](../../artifacts/plugin-manager-config-restore-android.json)，06:12:04 UTC：手机恢复120000及默认继承，电脑页面同步移除“已覆盖”。输出上限与并发数量只读，没有写入。
- [收回权限](../../artifacts/plugin-manager-denied-android.json)：手机重连后不加载管理组件。绑定和聊天权限保留。

插件102、后端52、手机250项通过，PostgreSQL独立测试1项默认跳过。类型检查、三端构建、Android lint、既有原组件隔离回放通过。新 namespace 的权限拒绝、快照隔离、继承投影、拒绝秘密/跨域字段、外部变更禁写及未知结果不重试均有自动测试；真实在途断线/撤销及非超时字段写入仍待专项。

当前实际 DSH PID61784、网关PID69592（操作前重新核对）；本机插件0.1.37与新版APK。此前0.1.36一节为历史证据。

## 0.1.38：Subagent 原配置卡

[手机注册](../../src/remote-plugin-settings.jsx)复用原SubagentCard、限制控制器、模型控制器及subagentCardFace，保留两部分独立namespace/revision和统一保存按钮。比较另写手机表单与局部scope接入后，继续采用后者以保留原验证、草稿、可用模型分组和失效路由呈现；未修改插件内部布局。其外层仍使用用户控制的等比缩放。

协议新增固定`subagent.maxDepth/maxActiveSubagents`与`subagent-model-selection.enabled/allowedModels`。allowedModels仅接受非空provider/model组成的严格对象数组，拒绝重复路由和未知字段；布尔/数组不能进入其他namespace的数值字段。模型卡通过scope.mutate一次提交两个顶层字段，并保留草稿expectedRevision；原Host服务仍校验“开启时至少一个模型”，原子持久化/广播。原配置只影响新会话的模型授权，不改变已开始会话。新能力`subagentSettings`防止旧插件误显示该卡。

模型目录使用既有原`session.modelCatalog`，设置/adapter变更重新读取目录；连接换代丢弃旧模型草稿和目录。scope仅接受固定顶层操作，不暴露通用settings或credentials；沿用管理授权、按namespace隔离的一次性快照和未知结果不重发。

2026-09-25真实MuMu（普通入口→Remote→电脑插件→管理电脑插件→Subagent）：

| 检查 | 结果与证据 |
| --- | --- |
| 原值/目录/草稿 | 深度1、并行8且无覆盖，模型选择关闭。打开草稿读到电脑的两个DeepSeek模型、勾选后返回再进入，开关仍关闭；[报告](../../artifacts/plugin-manager-subagent-inspect-android.json)，06:33:23 UTC，[模型截图](../../artifacts/plugin-manager-subagent-model-draft-android.png)已查看 |
| 保存同步 | 手机深度1→2，保存并重新读取；内置浏览器电脑原页显示2和已覆盖，[报告](../../artifacts/plugin-manager-subagent-write-android.json)，06:32:53 UTC |
| 恢复 | 手机恢复默认，重读1/无覆盖；电脑原页即时恢复1、移除覆盖标记，[报告](../../artifacts/plugin-manager-subagent-restore-android.json)，06:33:08 UTC |
| 收回权限 | 收回现有DSHM Android临时管理权限，手机重连不加载管理组件；[报告](../../artifacts/plugin-manager-denied-android.json)，06:33:59 UTC。基本聊天授权、绑定、Key和历史保留，031仍待批准 |

真实模型授权未保存、并行8未修改、没有模型消息或Key操作。原模型服务隔离测试覆盖开启空列表拒绝、两个字段原子保存、版本冲突拒绝和恢复继承；手机scope测试覆盖旧草稿版本/嵌套路径拒绝。这些自动测试不代替模型授权真实写入与新会话生效验收。

后端53、插件103、手机251项通过，独立PostgreSQL1项默认跳过；三端构建、插件typecheck和Android lint通过。测试脚本最初将说明按钮误判为覆盖标记，已改为检查“恢复默认”，在写入前修正并重跑；产品默认继承未被破坏。当前实际插件0.1.38、DSH PID62484、网关PID65060和新版APK，前文版本/PID为历史记录。
