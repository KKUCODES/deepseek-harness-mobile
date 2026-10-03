# 核心聊天与连接契约核对

- 状态：下列具体行为已有证据；R01 的过期和待批准设备被拒绝提示已补齐真实手机验收，不代表完整 Remote 已完成。
- 维护角色：项目协作 Agent；最近核验：2026-10-04。
- 依据：用户确认的聊天中心定位、[完整需求编号](../../../docs/project-knowledge/knowledge/decisions/2026-09-23-mobile-architecture-and-scope.md)、当前源码、下列报告原始字段及驱动断言。

## 同一套聊天界面

[普通聊天](../../src/OrdinaryApp.jsx)与[Remote消息](../../src/ui/RemoteMessage.jsx)直接使用同一个[ChatMessage](../../src/ui/ChatMessage.jsx)，维护用户消息、回复和思考内容的布局。[普通输入](../../src/ordinary-composer.jsx)与[Remote输入](../../src/ui/RemoteComposer.jsx)使用同一个[MobileComposer](../../src/ui/MobileComposer.jsx)；Remote在其中接入原DSH编辑器、文件引用及提交状态。[主聊天和旁栏](../../src/remote-sidebar-chat.jsx)均由DSHM的RemoteWorkspace组合。共用展示组件不意味着两个模式共享凭据、历史或运行上下文。

这是源码调用关系的核验，不以“看起来相同”证明复用；文件内的局部HTML预览也不等于加载电脑整站。实际APK内117个Web文件、插件0.1.75的73个运行文件与当前构建一致，执行[产物检查器](../../scripts/check-delivery-artifacts.mjs)返回ok=true。本轮没有改动生产代码或重新安装APK。

## 具体行为与证据

| 需求 | 已核对的证据与结论 | 覆盖边界 |
| --- | --- | --- |
| R01 配对 | [链接入口](../../artifacts/remote-pair-link-android.json)证明分享预填、一次消费、现有绑定不变、无效协议拒绝；[实际领取](../../artifacts/remote-pair-valid-claim-android.json)证明批准前无会话权限；[批准](../../artifacts/remote-pair-valid-connected-android.json)进入自有页面；[撤销](../../artifacts/remote-pair-valid-revoked-android.json)移除页面并拒绝重连。[异常及恢复](../../artifacts/pair-failures-android.json)补齐自然过期、待批准时拒绝及新链接重新配对。相机范围见[专项](./camera-permission-current.md) | 当前原协议将电脑拒绝待批准设备记为revoked；手机显示明确的授权失效与重新配对指引，不宣称能区分所有失效原因。实际操作与独立包范围见下节。 |
| R02 连接恢复 | [实际DSH/网关恢复](../../artifacts/remote-current-service-recovery-connected.json)两组均recovered、originalPanelMounted、draftPreserved=true；[此前恢复](../../artifacts/remote-readiness-recovery-final.json)保留 | 按报告日期、服务和场景证明，不宣称所有网络条件。 |
| R03 搜索与归档 | [正文搜索](../../artifacts/remote-search-android.json)覆盖标题/正文、工作区范围、归档排除和打开原会话；[乱序搜索](../../artifacts/search-order-android.json)拒绝旧摘要；[设置恢复归档](../../artifacts/settings-unarchive-android.json)还原后重新归档并保持草稿 | 当前电脑未开启正文搜索时仅显示标题搜索，以[当前入口](../../artifacts/current-search-android.json)为准。 |
| R04 会话管理 | [管理报告](../../artifacts/remote-mobile-manage-android.json)与[驱动的--manage分支](../../scripts/verify-remote-mobile-android.mjs)共同证明已有工作区新建、真实模型回复、改名、归档/恢复、整段分支保留回复及清理；[按轮分支](../../artifacts/remote-mobile-turn-fork-android.json)证明只保留选中轮次前缀，原会话不变。[新建导航](../../artifacts/new-chat-navigation-android.json)和[快速新建](../../artifacts/new-chat-rapid-android.json)证明空会话进入和原聊天恢复 | 管理旧报告收尾assistantMessages=0是返回聊天仍在加载时采样，不拿它证明最终历史已加载。分支内容由驱动在归档前明确断言。 |
| R05 历史与导出 | [原会话ZIP完整性](../../artifacts/session-export-integrity.json)核对记录和附件；[包含子会话](../../artifacts/session-export-descendants-android.json)有不同导出字节数及标记；[附件导出](../../artifacts/session-export-attachments-android.json)和[当前完整文件交付](./files-delivery-current.md)独立覆盖保存 | 普通session-export报告两次同字节数不能单独证明子会话已被包含。实际实时输出与分页仍沿各自专项。 |
| R08 模型双向同步 | [手机改模型](../../artifacts/remote-models-phone-to-pc.json)为Pro→Flash；[电脑改回后的手机观察](../../artifacts/remote-models-pc-to-phone.json)expected=Pro，随后手机改Low；[恢复](../../artifacts/remote-models-restored.json)expected=High。[双端现场记录](./remote-current.md#模型双向同步与输入框点击2026-09-24)记载电脑真实菜单观察 | 三份JSON由手机采集；电脑界面观察依据现场记录，不能说JSON独立证明电脑画面。当前生成期间禁切换见[队列专项](./remote-current.md#当前正式app队列操作2026-10-03)。 |
| R15 工作区管理 | [改名](../../artifacts/remote-workspace-rename-android.json)renamed=true；[排序](../../artifacts/remote-workspace-sort-android.json)记录真实顺序，[驱动](../../scripts/verify-remote-workspaces-android.mjs)断言目标确为最后一项；[移除](../../artifacts/remote-workspace-remove-android.json)须先确认；[保留](../../artifacts/remote-workspace-preserved-android.json)证明聊天可读和文件未变；[收权](../../artifacts/remote-workspace-revoked-android.json)保持原聊天授权 | 移除的是注册，未删除目录；不新增创建工作区能力。 |
| A01 模式隔离 | [正式普通入口报告](../../artifacts/ordinary-boundaries-android.json)及[驱动](../../scripts/verify-product-boundaries.mjs)验证普通页无Remote桥、Remote页无普通桥、拒绝Key/剪贴板读取和非法请求；[本轮真实请求](../../artifacts/ordinary-without-remote-android.json)证明Remote连接失败期间普通聊天仍收到DeepSeek完整回复。[RemoteActivity](../../android/app/src/main/java/dev/dshmobile/validation/RemoteActivity.kt)、[OrdinaryBridge](../../android/app/src/main/java/dev/dshmobile/validation/OrdinaryBridge.kt)保留不同origin和主框架检查 | 早期mode-isolation报告actualRemoteRoundtrip=false，旧离线返回报告只验证输入框。本轮补齐同一次断线中的真实请求，断开的是MuMu到中转的通道，不冒充电脑物理关机或手机断网。 |
| A02 插件契约与释放 | [默认缩放与点击](../../artifacts/live-partial-verify-android.json)、[作者声明及用户覆盖](../../artifacts/live-partial-author-android.json)、[卸载](../../artifacts/live-partial-unloaded-android.json)均有具体布尔断言；[Worker生命周期](../../artifacts/plugin-manager-worker-lifecycle-android.json)覆盖停用/断线/重连/卸载及资源失效；[Worker在途撤权](../../artifacts/worker-revocation-android.json)丢弃4163字节、释放Worker/页面并拒绝重连；[文件在途撤权](../../artifacts/file-revocation-android.json)清理暂存且不交付 | [当前目录](./plugin-compatibility.md)中的29 active/26 mobile/4 waiting只表示状态。真实契约证据不保证未知第三方代码正确清理自身副作用；未获管理权限和排除项不算实现缺失。 |
| A03 故障与未知结果 | [实际DSH安装中重启](../../artifacts/plugin-manager-install-restart-android.json)记录下载已开始、断线、同WebView显示结果未知、原配置保持，requests仅1项；[实际首次加载恢复](../../artifacts/remote-initial-android-final.json)及[网关/DSH恢复](../../artifacts/remote-current-service-recovery-connected.json)分别覆盖首次和已有页面恢复 | 安装未知结果不可自动重发，不以手机已点击当作电脑确认。网页回放、真实网络暂缓与模型请求分别记录；不把某个故障类型扩展为所有操作的异常证明。 |
| A06 数据与诊断 | [旧草稿迁移](./draft-migration-current.md)覆盖真实旧数据恢复、提交后移除旧值及新值优先；[缓存清理](../../artifacts/remote-cache-android.json)有清理、重启和草稿恢复；[诊断](./diagnostics-current.md)区分普通/远程、在线/离线及原生版本 | 只证明已覆盖的数据格式，不外推所有历史APK。版本拒绝另由当前传输单测与正式页面回放核验，不能用安装成功代替迁移。 |

## 当前回归与下一步

本次重新执行配对链接、工作区、传输、会话视图、草稿与恢复六组Node测试，**30项通过，零失败/跳过**，见[本轮结果](../../artifacts/core-contract-audit-tests.log)。[版本传输测试](../../tests/remote-transport.test.mjs)明确检查协议/DSH版本不匹配时不发布能力、不能调用后续RPC。这些是隔离测试，不能冒充Android现场。

R01两项具体证据缺口由下节关闭。真实反馈提交/撤回仍按[目的地限制](./feedback-current.md)等待手动准备，不将本轮配对核验作为解除限制的依据。其余编号继续以[总验收表](./completion-audit.md)及各专项为准。

## Remote不可用时的普通聊天实测（2026-10-04）

正式MuMu日常App先记录17条普通聊天的逐条摘要，再退出App，仅移除该设备的`tcp:8787`反向映射。DSH44728、网关24312保持运行，手机访问模型的网络保留。正常打开App后，Remote真实连接显示“连接未完成，请重试。”且没有工作区；返回普通聊天，新建专用会话，经原生模型通道向DeepSeek Flash发送唯一标记并收到完整一致回复，实际用量44输入/21输出tokens。回复完成时映射仍不存在、Remote仍不可用，两页面没有对方模式的原生桥。

通过普通聊天自身“删除聊天→确认删除”清理本轮记录后，原17条聊天逐条SHA-256一致。恢复原`tcp:8787`映射，点击Remote重新连接，原“DSHM Remote 联调提示”16条回复和空草稿恢复；日常设备active、management=false，两个电脑服务PID未变。没有读取Key、修改配置或发送Remote消息。

[最终报告](../../artifacts/ordinary-without-remote-android.json)ok=true、errors=[]；[断线画面](../../artifacts/ordinary-without-remote-offline.png)、[真实普通回复](../../artifacts/ordinary-without-remote-reply.png)及[恢复画面](../../artifacts/ordinary-without-remote-restored.png)保留。首次调试连接早于App就绪，以及恢复检查误用CSS类导致超时，均记录为驱动失败；等待原进程及使用生产data-testid后完成，没有以重启服务规避故障。该专项证明普通聊天不依赖Remote可用性，不代表手机本身离线也能请求模型。

## 配对异常与重新配对实测（2026-10-04）

当前源码构建独立UID包`dev.dshmobile.validation.pairingtest`，在MuMu Android 12连接实际DSH44728及网关24312。电脑操作使用现有[本机管理接口](../../../plugin/src/management.ts)的正常登录和pair/revoke/approve动作；手机全部经可见输入框、按钮和原生桥。未修改时钟、数据库有效期、Host授权实现或生产代码，也未清除日常App数据。

1. 电脑正常生成五分钟链接，声明到期时间为UTC16:36:39.274；期间先验证另一条新链接的拒绝路径。
2. 独立包领取新链接后显示等待批准，无工作区；核对设备名与实际公钥指纹后，电脑对该pending设备执行与“拒绝”相同的revoke动作。手机点击“我已在电脑批准”显示“连接授权已失效，请移除本机绑定后重新配对”，仍无会话访问。[实际画面](../../artifacts/pair-failures-rejected-android.png)已查看。原协议不单独保留rejected状态，此处不伪造更具体的原因。
3. 手机移除这条已失效绑定。UTC16:37:06.067才提交第一步的过期链接，显示“链接已过期或已被领取”，无指纹/绑定、电脑设备总数不增加，提交后的链接字段清空。[实际画面](../../artifacts/pair-failures-expired-android.png)已查看，报告不保存任何配对key。
4. 在同一页面填写电脑新生成的链接，领取、核对指纹、批准后正常进入自有Remote工作区；打开专用“DSHM Remote 联调提示”，读到16条回复且草稿为空。没有发送模型消息。随后电脑撤销新测试身份，手机移除绑定、停止独立包。
5. [完整报告](../../artifacts/pair-failures-android.json)全部检查通过，errors=[]。两条测试设备均revoked；所有原设备的状态和管理权限与开始时一致。日常App回到原聊天、16条回复、空草稿，原DSHM Android仍active且management=false。

[独立构建](../../artifacts/pair-failures-isolated-build.log)及[恢复普通构建配置](../../artifacts/pair-failures-normal-build.log)成功。重新构建的普通APK字节与旧产物不同，未将其安装到日常App；从仍安装的日常版本取回APK、核对原SHA-256后恢复交付文件，最终仍为`37b9eaea3218ef5523caf4bd5f038c2fd234cb6230a39ef08ed10fa37dbd11db`。独立包SHA、重建包SHA及恢复结果均写入报告；最终产物检查仍为117个Web文件、插件0.1.75/73个运行文件一致。独立包只用于本次相同源码的异常入口验证，不冒充原日常安装包重新执行了所有场景。
