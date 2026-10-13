# 新版插件安装的结果核对

- 状态：固定新版两种入口的下载/脚本/修复/applying阶段手机与核心Host同时结束、冷恢复摘要/历史及清理通过。本轮36原源码/启动字节、原完整构建与355资源精确恢复归档，三个目录原属性恢复；SDK第四/第六轮明确磁盘不足、第五轮依赖状态失败均保留。SDK打包需增加Q盘空间，实际载体及完整新版仍待验，见[SDK当前状态](../../../plugin/compatibility/latest-upstream/source-runner-profile-resolution.md#sdk-打包与源码恢复)。
- 维护角色：DSH Mobile 项目协作 Agent；最近核验：2026-10-06。
- 基线：DSH `0.2.1-alpha.1`，提交 `5badb15009ae1756c3afe0ae0cef1faafc290ccc`，独立插件候选 `0.1.76-latest.0`。
- 来源：[上游实际安装管理器](../../../plugin/artifacts/latest-source-check/packages/boot/plugin-manager/src/index.ts)、[原手机管理控制器](../../../plugin/artifacts/latest-source-check/packages/client/ui-plugin-manager/src/client/manager-store.ts)、[中转策略](../../../backend/packages/protocol/src/remote-policy.ts)、[Android 驱动](../../scripts/verify-latest-live-install-restart-android.mjs)、[独立测试残留清理](../../scripts/cleanup-latest-live-script-install.mjs)。

## 已修复的缺口

新版原插件管理器在安装回执丢失后调用 `pluginManager/waitForInstall(requestId)`。它等待仍在进行的原安装，不会提交第二次安装；没有在途记录时返回 `null`。原组件据此显示“未能获取安装结果”，不能把它当作安装成功或取消成功。

此前手机自己的“最近插件操作”已经能显示未知结果，但中转名单遗漏这项原查询。保留管理组件的源码入口实际显示 `remote_operation_denied`，一直停在“安装状态尚未确认”，不能释放原待办。现补齐该入口，仍需管理权限，只接受 UUID 安装请求编号及原 `args` 信封。网关允许传输经核验的新版查询；Host 根据实际版本再校验，旧版不公布也不转发该入口。没有增加安装重试或通用管理调用。

修改协议后须重新构建配套网关和插件并重启测试服务。当前仅重建独立新版候选；无需更新手机 APK，日常旧版安装与支持声明保持。

## 下载中真实退出与恢复

使用已配置的独立测试 home 和 `dev.dshmobile.validation.latesttest`，沿 DSHM 自有页面打开原管理组件。手机提交本机 HTTP 归档地址，真实 pnpm 发起 GET 后服务器暂停响应，不发送任何包字节。核对原 `run.json` 的启动 PID、实际下载 socket 的 PID，并从 Windows 进程父链确认都属于本次隔离 Host；随后结束这棵拥有的进程树及本轮控制器，按原参数恢复同一 home、网关端口和绑定。

这模拟电脑端进程整体退出，不实际重启用户电脑。不会为了观察超时而重启服务；每次退出均发生在已经确认的真实下载阶段。

| 核验 | 固定源码 `pnpm dsh web` | npm 发布 CLI |
| --- | --- | --- |
| 真实下载后 Host 换 PID，同一 WebView `timeOrigin` 保持 | 通过 | 通过 |
| 原管理弹窗取得 `null` 后显示未知结果 | 实际通过，原组件保留 | 发布入口重新装配组件；手机摘要保留，不借用源码弹窗证据 |
| 最近操作的原编号/地址为 unknown，折叠后仍有提醒 | 通过 | 通过 |
| 单次 GET、下载连接关闭、记录的进程先于测试清理退出 | 通过 | 通过 |
| package.json、pnpm-lock.yaml、pnpm-workspace.yaml 原哈希保持 | 通过 | 通过 |
| 原测试聊天的分页事件及完整投影值保持、空草稿/管理 false 恢复 | 通过，收尾另行读回核验 | 通过 |

源码证据：[第四轮场景](../../../plugin/artifacts/latest-runtime-check/latest-live-source-install-restart-attempt-4.json)、[未知记录截图](../../../plugin/artifacts/latest-runtime-check/latest-live-source-install-restart-unknown.png)、[独立收尾核验](../../../plugin/artifacts/latest-runtime-check/latest-live-source-install-restart-finish.json)。第四轮的功能断言均通过，但末尾脚本误用“关闭”定位实际“关闭窗口”，因此场景报告整体仍为失败；权限与原聊天已在 finally 恢复，收尾命令再次读取原记录、配置和已退出 PID 后通过。保留两个报告，不把场景报告改成成功。

发布证据：[修复候选完整场景](../../../plugin/artifacts/latest-runtime-check/latest-live-install-restart-attempt-4.json)、[未知记录截图](../../../plugin/artifacts/latest-runtime-check/latest-live-install-restart-unknown.png)、[原聊天恢复](../../../plugin/artifacts/latest-runtime-check/latest-live-install-restart-attempt-4-restored.png)。原 Host `41216` 恢复为 `44980`，下载启动/实际下载 PID `19804/5288` 已退出；完整报告通过，下载只有一个请求、连接已关闭、无页面错误。

## 安装脚本取消与退出恢复

同一 App、home 和配对继续使用现有[有界脚本夹具](../../tests/fixtures/script-cancel-plugin/postinstall.mjs)：脚本只打印自身 PID 并等待90秒，不读写文件、环境变量或网络。每轮从这份夹具打包独立本地归档，真实 pnpm 执行；没有替换安装器、模拟脚本结果或改变日常配置。

手机先从原组件提交归档，原 pnpm 拒绝未批准脚本，管理弹窗提供“允许这些脚本并重试”。核对这时包清单/锁文件恢复、来源限定的待批准项及未执行脚本；手机明确批准后，等待实际 PID 输出，并确认该进程仍存活且没有完成输出，才取消或结束拥有的 DSH 树。首次失败和批准重试是两次不同原请求，取消回执按第二次真实操作 ID 核对，不能按同一包地址误计为重复安装。

| 核验 | 固定源码 `pnpm dsh web` | npm 发布 CLI |
| --- | --- | --- |
| 未批准脚本实际拒绝，手机明确批准后真实脚本运行 | 通过 | 通过 |
| 点击取消，手机收到确认时原启动/脚本 PID 已退出 | 通过，17540/52320 | 通过，4916/46540 |
| 取消恢复包清单/锁文件，原管理器保留脚本批准 | 通过 | 通过 |
| 脚本运行中结束拥有的 DSH 树，原启动/脚本 PID 先于测试清理消失 | 通过，42168/69496 | 通过，32064/34728 |
| 同一 WebView 重连；原操作 unknown、折叠提醒、无重试按钮 | 通过，10120→14404 | 通过，44980→62340 |
| 原管理弹窗经实际 null 回执显示未能获取结果 | 通过，组件保留 | 组件重新装配，仅确认手机未知摘要 |
| 原聊天分页事件/完整投影、空输入及管理 false 恢复 | 通过 | 通过 |

取消证据：[源码完整报告](../../../plugin/artifacts/latest-runtime-check/latest-live-source-script-cancel.json)、[实际取消界面](../../../plugin/artifacts/latest-runtime-check/latest-live-source-script-cancel-cancelled.png)；[发布第三轮完整报告](../../../plugin/artifacts/latest-runtime-check/latest-live-script-cancel-attempt-3.json)、[实际取消界面](../../../plugin/artifacts/latest-runtime-check/latest-live-script-cancel-attempt-3-cancelled.png)。取消后运行记录已由原安装器移除；测试工具仅在配置恰好为原值加本测试来源时清理批准，拒绝覆盖其他修改。

退出证据：[源码完整报告](../../../plugin/artifacts/latest-runtime-check/latest-live-source-script-restart.json)、[未知记录](../../../plugin/artifacts/latest-runtime-check/latest-live-source-script-restart-unknown.png)；[发布完整报告](../../../plugin/artifacts/latest-runtime-check/latest-live-script-restart.json)、[未知记录](../../../plugin/artifacts/latest-runtime-check/latest-live-script-restart-unknown.png)。两种入口的报告完整通过、页面错误0，真实 Windows 父链核对后才结束拥有的 DSH 进程树，不结束日常 DSH 或模拟器。

**脚本运行中退出并非磁盘无变化。** 实际两轮均保留原 package.json，但 pnpm-lock.yaml 留下测试包记录，已批准的来源策略也仍存在；手机正确报告未知，不能宣布自动取消或原状态已回滚。没有自动重装。驱动核验结果后仅移除本测试批准，随后独立清理工具使用原 `runPluginCommand` 执行离线安装，不运行脚本；这属于测试清理，不是 DSHM 自动修复。

源码清理工具先对本测试来源设置明确拒绝，避免执行脚本，实际原安装器退出0；包清单、锁文件和workspace配置三个摘要与中断前完全一致，node_modules测试包和run.json均不存在。见[源码清理报告](../../../plugin/artifacts/latest-runtime-check/latest-live-source-script-restart-cleanup.json)。发布首次清理虽然实际移除了包并恢复锁文件，但 pnpm 返回 `ERR_PNPM_IGNORED_BUILDS` 并留下同一来源的未决定项，因此[原报告仍失败](../../../plugin/artifacts/latest-runtime-check/latest-live-script-restart-cleanup.json)；核对该项和无运行进程后仅清理它，[独立只读复核](../../../plugin/artifacts/latest-runtime-check/latest-live-script-restart-cleanup-verified.json)证明三个摘要及包/运行记录已精确恢复。没有改写失败报告为通过。

发布首轮验证器误把来源限定键写成绝对路径，新版 pnpm 实际保存 profile 相对路径，因此在批准前断言失败，脚本未运行；原记录[保留](../../../plugin/artifacts/latest-runtime-check/latest-live-script-cancel.json)。核对精确测试来源后清理待决定项，改按同一归档相对路径核验。第二轮实际取消已完成，但验证器按地址计算两次原请求而失败；[记录](../../../plugin/artifacts/latest-runtime-check/latest-live-script-cancel-attempt-2.json)保留，第三轮按真实 operationId 完整通过。这两次修正都仅修改验证器，不放宽生产协议或脚本审批。

在手机项目执行：`node scripts/verify-latest-live-install-restart-android.mjs --script-cancel` 或 `--script-restart`；需要真实已配对 `.latesttest` App 和明确的 ADB/设备环境。重启场景输出 readyForHostExit 后由本机控制器核对拥有的树、结束并恢复同一 home；不能在未见真实脚本 PID 时模拟退出。报告排他创建，可用 `--attempt-2` 等保留新一轮；旧失败不覆盖。独立清理命令为 `node scripts/cleanup-latest-live-script-install.mjs`，`--verify`仅只读复核，缺少原场景证据或混入其他依赖/来源时拒绝。

## 普通安装脚本的手机超时页

沿用前节仅打印PID并等待90秒的实际脚本夹具，与不兼容升级后的修复超时分开验证。启动器只在原隔离home加载十秒等待配置；手机原管理页先拒绝未批准脚本，再明确批准同一归档的实际来源并重试。真实脚本PID和原run.json存活后等待原管理器结算，不主动取消或结束Host。

原弹窗显示“插件安装失败”和“安装超时”，failure.kind=timeout、code=operation-error；原requestId与手机操作摘要中的原安装编号一致。实际日志包含脚本开始及原十秒无输出终止诊断，没有脚本完成标记。手机确认失败前启动/脚本PID已退出，run.json消失；原package.json和锁文件恢复，脚本批准按官方语义暂时保留。摘要为未完成，观察期间未自动重试；原界面保留供用户主动使用的重试按钮，不把失败当作未知结果。

| 核验 | 固定源码入口 | npm发布入口 |
| --- | --- | --- |
| 原失败分类/主文案、同一请求编号、实际PID退出、未完成回执 | [第二轮通过](../../../plugin/artifacts/latest-runtime-check/latest-live-source-script-timeout-attempt-2.json)，启动/脚本18860/69620，原requestId 9b2d8be3-a1cc-4d60-8b61-539f1b3548e1 | [完整通过](../../../plugin/artifacts/latest-runtime-check/latest-live-script-timeout.json)，68956/28116，43ccc7e5-d41d-49cd-9af4-28df32fd4248 |
| 实际失败画面 | [源码](../../../plugin/artifacts/latest-runtime-check/latest-live-source-script-timeout-attempt-2-timeout.png) | [发布](../../../plugin/artifacts/latest-runtime-check/latest-live-script-timeout-timeout.png) |
| 独立原安装器清理、测试包移除与三配置摘要恢复 | [通过](../../../plugin/artifacts/latest-runtime-check/latest-live-source-script-timeout-attempt-2-cleanup.json) | [通过](../../../plugin/artifacts/latest-runtime-check/latest-live-script-timeout-cleanup.json) |
| 停止拥有的Host后核对并精确移除诊断overlay | [通过](../../../plugin/artifacts/latest-runtime-check/latest-live-source-script-timeout-attempt-2-overlay-removed.json) | [通过](../../../plugin/artifacts/latest-runtime-check/latest-live-script-timeout-overlay-removed.json) |

两种入口的同一WebView、原60条分页历史/完整投影、主聊天/空草稿和management=false保持，页面错误为空。驱动仅移除本测试脚本批准并核对原策略；node_modules的测试残留另通过原runPluginCommand离线且忽略脚本的安装清理，退出0后确认测试包和run.json不存在、三个配置摘要精确恢复。这是独立测试清理，不宣称任意脚本副作用自动回滚。

源码[首轮失败](../../../plugin/artifacts/latest-runtime-check/latest-live-source-script-timeout.json)发生在验证器读取React缓存的原安装状态时，实际[页面](../../../plugin/artifacts/latest-runtime-check/latest-live-source-script-timeout-failure.png)已经显示安装超时。原配置/策略/主聊天/管理恢复，[独立清理](../../../plugin/artifacts/latest-runtime-check/latest-live-source-script-timeout-cleanup.json)保留失败并核对原摘要后通过；不把首轮报告改成通过。验证器改为短轮询两个实际fiber缓存分支，再严格核对原requestId和DOM失败状态，第二轮完整通过。未修改生产状态、分类或手机APK。

运行方式：先在后端启动`node scripts/start-latest-live.mjs --resume --diagnose-install-timeout`，SOURCE加`--source`；手机项目执行`node scripts/verify-latest-live-install-restart-android.mjs --script-timeout`，需要前述真实设备/原配对环境。通过后执行`node scripts/cleanup-latest-live-script-install.mjs --timeout`，对应轮次加`--attempt-2`；仅首轮已记录读取失败的独立清理使用`--failed-probe`，不替代场景验收。停止拥有的控制器与Host后，在后端执行`node scripts/remove-latest-install-timeout-overlay.mjs --script`，对应轮次亦加`--attempt-2`，最后恢复正常SOURCE入口。[恢复核对](../../../plugin/artifacts/latest-runtime-check/latest-live-script-timeout-normal-restored.json)通过实际原手机重连、同WebView/原历史投影、配置摘要、测试包/运行记录/诊断移除及管理false，Host33600存活，两个诊断flag均为false；[当前聊天画面](../../../plugin/artifacts/latest-runtime-check/latest-live-script-timeout-normal-restored.png)保持。手机进程结束后的安装摘要、单独Host退出遗留子进程、最终源码恢复及原8项总标准仍待完成。

## 修复期间取消与超时

原修复在3秒超时后启动器退出，但脚本及写入子进程仍运行，超过20秒未结算；源码写入计数1→201。补丁为捕获输出的修复启用整个进程树终止，并将超时传入原PackageResult分类；取消仍等待恢复旧版本。两种构建产物真实pnpm超时/取消及实际Android取消均通过，完整来源、失败和报告见[修复专项](../../../plugin/compatibility/latest-upstream/package-repair.md)。

手机沿原管理页明确批准旧脚本，提交不兼容组件升级；实际修复开始后点击取消，1.5秒内不提前结算。响应释放后原run、脚本与写入子进程均退出，写入停止，旧版及三个配置原字节恢复，手机原操作编号显示“已取消”。原详情页卸载测试包后，全部配置、原聊天分页历史/完整投影、同WebView与空输入保持，管理false恢复。发布[第四轮](../../../plugin/artifacts/latest-runtime-check/latest-live-release-repair-cancel-attempt-4.json)和[源码整轮](../../../plugin/artifacts/latest-runtime-check/latest-live-source-repair-cancel.json)各自完整通过。

发布驱动重连等待与卸载入口错误保留；第三轮实际取消通过，但后续原卸载遇到EPERM，独立清理与第四轮结果分开记录，未宣布EPERM根因已修复。此新夹具确实只写自身包内测试标记，区别于前节仅等待的90秒夹具；不代表任意副作用回滚。手机修复超时分类/详情的后续证据见下方，不借用operations结果。

### 手机修复超时分类和详情

两种真实入口沿原管理器配置把隔离profile的等待时间临时缩短至十秒，不替换安装/回执流程。手机原管理页明确批准旧脚本、安装旧版，再升级不兼容组件；第二次旧版修复请求和实际写入PID均核验。修复超时后原弹窗failure.kind=timeout、code=incompatible-version，原requestId与手机摘要的原requestId一致；手机按官方规则优先显示兼容拒绝，展开安装详情实际显示“node_modules could not be reinstalled”，不宣称重装成功。

实际失败显示前修复启动/脚本/写入PID已退出，写入连续300ms停止，原run.json清理；仅两次原脚本请求，无自动重试，摘要为未完成。旧版文件及三个旧版安装后的配置字节保持；原详情页卸载测试包后，测试前三配置、同WebView、原60条分页历史/完整投影、主聊天/空输入和management=false恢复。发布[第二轮报告](../../../plugin/artifacts/latest-runtime-check/latest-live-release-repair-timeout-attempt-2.json)与源码[完整报告](../../../plugin/artifacts/latest-runtime-check/latest-live-source-repair-timeout.json)通过；发布首轮错误期待“安装超时”主文案的失败与原卸载清理保留。没有修改原兼容拒绝的优先级。

停止各自拥有的Host后，精确测试overlay、配置摘要/权限/已退出PID核对并移除，[发布](../../../plugin/artifacts/latest-runtime-check/latest-live-release-repair-timeout-attempt-2-overlay-removed.json)与[源码](../../../plugin/artifacts/latest-runtime-check/latest-live-source-repair-timeout-overlay-removed.json)证据通过；正常SOURCE恢复且诊断false。具体启动、移除命令和真实截图见[修复专项](../../../plugin/compatibility/latest-upstream/package-repair.md#手机修复超时的分类与详情)。此证据不代替普通安装脚本超时的主文案或手机进程结束后的摘要恢复。

## 修复运行中DSH退出恢复

两种入口均在第二次旧版修复脚本、写入子进程和原run.json真实运行后结束整棵DSH进程树，再恢复同一home/App/配对。实际修复进程和写入先于恢复停止；手机同一操作编号显示未知结果、没有重试按钮，折叠后的提醒仍可见，没有自动重装。旧版v0.0.1及旧版安装后的三个配置原字节、同一WebView、原60条分页记录/完整投影保持。SOURCE原弹窗还沿waitForInstall(null)释放为unknown；RELEASE不保留该弹窗，证据按入口区分。

手机原详情页随后卸载专用包，原管理器核对旧进程并接管运行记录，没有手动删锁。三个测试前配置、主聊天/空输入和management=false均恢复。SOURCE[第三轮完整报告](../../../plugin/artifacts/latest-runtime-check/latest-live-source-repair-restart-attempt-3.json)与RELEASE[完整报告](../../../plugin/artifacts/latest-runtime-check/latest-live-release-repair-restart.json)通过；[SOURCE](../../../plugin/artifacts/latest-runtime-check/latest-live-source-repair-restart-attempt-3-unknown.png)和[RELEASE](../../../plugin/artifacts/latest-runtime-check/latest-live-release-repair-restart-unknown.png)保存实际未知结果画面。

SOURCE首轮未执行外部结束动作，等待超时，修复自然完成后残留的专用包经原管理器独立卸载；第二轮在重连按钮消失时验证器超时，没有安装或脚本请求。原失败与独立清理保留，详见[修复专项](../../../plugin/compatibility/latest-upstream/package-repair.md#修复中整棵dsh树退出)。这是进程树退出的实际验收，不等同电脑OS重启、仅Host退出或任意脚本副作用回滚。

## 仅结束Host的Windows残留进程观察

源码入口的第二轮实际只结束核心Host28508，没有使用`/T`且尚未停止控制器：启动包装器62528仍在，原运行记录中的安装启动器8724已退出，但脚本17364与写入子进程12800仍存活。见[直接结束证据](../../../plugin/artifacts/latest-runtime-check/latest-live-source-repair-host-only-attempt-2-core-exit.json)。随后两种实际operations入口的独立profile探针确认：同一原写锁和写入前保护会允许`pnpm --version`通过，而旧脚本/写入仍活着；没有并发修改文件。原保护缺口已确认，当前安装尚未修复。官方原生Job范围的独立原型通过调用者退出、取消与超时，尚未加入现行31文件租约或Android运行组合，见[证据与正式接入待办](../../../plugin/compatibility/latest-upstream/package-repair.md#原写入前保护的实际缺口及原生进程范围原型)。

[首轮](../../../plugin/artifacts/latest-runtime-check/latest-live-source-repair-host-only.json)和[第二轮](../../../plugin/artifacts/latest-runtime-check/latest-live-source-repair-host-only-attempt-2.json)均保持失败：验证器错误要求包括启动器在内的所有安装PID存活，且等待SOURCE包装器退出不等同核心Host退出。首轮后续正常停止控制器还可能结束其完整子树，不能用该轮推断残留保护行为。第二轮直接结束证据及失败时实际脚本/写入PID仍存活的记录独立保留。

旧脚本退出后，两轮均通过手机原管理器独立卸载，原管理器自行核对并清除过期run.json，没有手动删除运行记录或锁。[首轮清理](../../../plugin/artifacts/latest-runtime-check/latest-live-source-repair-host-only-cleanup.json)与[第二轮清理](../../../plugin/artifacts/latest-runtime-check/latest-live-source-repair-host-only-cleanup-attempt-2.json)核对三配置原摘要、测试策略、原历史/投影和主聊天恢复，临时管理权限已收回。正常SOURCE Host72052已恢复，MuMu实际设备窗口显示原聊天页；日常DSH/App/Key保持。后续需在残留脚本存活期间核验真实下一次写入保护，此场景仍未通过。

## 原生范围接入后的实际手机复验

发布五文件候选已与同一MuMu独立App、原配对及持久聊天接通，无需重建APK。[第三轮完整报告](../../../plugin/artifacts/latest-runtime-check/latest-live-release-repair-host-only-native-installed-attempt-3.json)通过核心Host单独退出：未带/T、未先结束控制器/安装树，记录范围/脚本/写入进程在恢复之前死亡、TCP关闭、300ms写入保持。恢复后原编号unknown、无重试，折叠提醒保持；原管理器核对死记录，手机明确卸载/重新安装，再卸载清理。原三配置字节、分页历史及投影、同WebView、空草稿/主聊天和管理false恢复。12会话/2106原事件另经[完整只读重启审计](../../../plugin/artifacts/latest-runtime-check/latest-live-native-mobile-release-after-report.json)核验，原消息和投影保持，不把60条页面核对冒充全历史核对。

首轮重复添加完全相同归档使原DSH提示“无法从依赖变更中确定安装了哪一个包”，测试误等done；第二轮新安装已完成，但原页面自动进入详情，最终卸载驱动误找列表入口。两次原失败及独立清理保留；修正为原管理器先卸载后新安装，卸载支持列表/已打开详情两种实际入口，未改变产品分类或重试策略。详细五文件、九场景/五项进程、原取消超时与原回归证据见[电脑端范围](../../../plugin/compatibility/latest-upstream/package-repair.md#发布运行器与真实手机核心host退出)。

固定源码`pnpm dsh web`的[第二轮](../../../plugin/artifacts/latest-runtime-check/latest-live-source-repair-host-only-native-installed-attempt-2.json)亦完整通过核心Host单独退出、原unknown/接管、重新安装/卸载及全部恢复；[全历史审计](../../../plugin/artifacts/latest-runtime-check/latest-live-native-mobile-source-2-after-report.json)证明同12会话/2106原事件、投影和绑定准确保持。源码首轮仅收尾异步详情导航的驱动定位失败，[独立清理](../../../plugin/artifacts/latest-runtime-check/latest-live-source-repair-host-only-native-installed-cleanup.json)保留；循环重读实际列表/详情后复验，没有修改产品结果。

发布五文件原生组合的[实际手机修复取消](../../../plugin/artifacts/latest-runtime-check/latest-live-release-repair-cancel-native-installed.json)亦完整通过：取消仍等待旧版修复，结算前实际进程退出、TCP关闭/写入停止，原取消回执、配置/历史和临时管理权限恢复。

SOURCE36原源码/启动载荷完整恢复，原构建354.948秒退出0，355资源原摘要及Git干净核验并[排他归档](../../../plugin/artifacts/latest-runtime-check/latest-live-source-lease-package-range-native-final.json)，正常RELEASE服务已恢复。真实打包载体、手机摘要冷恢复和全部新版标准仍待验。此处新状态覆盖上节旧保护缺口的现行判断，旧失败证据保持；日常App/DSH/Key未更换。

## 手机与电脑都结束后的安装摘要

现已将[操作控制器](../../src/remote-plugin-operations.mjs)的未确认摘要接入原[严格事务存储](../../src/remote-drafts.mjs)。电脑可能接收写入前先提交本机摘要；存储失败不发安装。只保存展示白名单，不保存请求参数、完整回执或凭据，下载地址移除登录信息/查询/片段；按中转来源、设备及指纹隔离，最多64条、保留一小时，移除本机绑定一并清理。核心重建仍交接同一内存记录；释放模型等操作结算后才关闭数据库。

重开只恢复核对摘要，先取得电脑授权列表再呈现。当前Host能确认原编号时沿用真实进行中/完成状态；Host已重启且没有原回执则显示unknown。已确认结果移除本机摘要，保存失败不改写原电脑结果。没有自动安装、重新提交参数或恢复脚本批准；原取消按钮只在电脑确认原安装仍进行中时保留。

[存储/操作/草稿28项](../../tests/remote-plugin-operations.test.mjs)、[摘要边界](../../tests/remote-plugin-journal.test.mjs)及聊天/工作区草稿/通知120项通过。新版Web构建、Android assembleDebug/lintDebug通过；首轮构建误用系统Java8而配置失败，改用已有Android Studio JBR21且仅设置构建进程环境后成功，没有改全局Java。原APK已备份，独立UID覆盖安装；[165资源及安装字节核对](../../artifacts/latest-live-draft-receipt-apk-plugin-journal.json)通过，APK SHA256 `58921967f03c2a2d8e6b2c9dfdfc623052dbb7ddbfb291684013d2863111114b`。日常旧App/Key未替换。

发布五文件原生组合的[第三轮实际MuMu](../../../plugin/artifacts/latest-runtime-check/latest-live-install-restart-cold-phone-attempt-3.json)完整通过：手机实际提交HTTP归档，真实pnpm已发一次GET、原严格摘要pending落盘后，结束App29093；再只结束已核验的核心Host22636，范围55732/下载14724自动退出、TCP关闭，恢复前核验完成。同home/绑定/端口恢复Host69352、冷开App31413/新WebView，原操作`5bcc91f4-c73c-4ff3-834e-2e15e2385bd5`显示unknown，展开没有重试按钮，折叠仍有提醒；下载始终一次。三配置字节、真实分页/投影、主聊天与空输入保持，management=false恢复。MuMu实际设备窗口已切到前台并截图核对。

首轮选择WebView早于Android主进程出现，[原失败](../../../plugin/artifacts/latest-runtime-check/latest-live-install-restart-cold-phone.json)保留；第二轮等待进程时没有处理pidof“尚未存在”的退出1，[原失败](../../../plugin/artifacts/latest-runtime-check/latest-live-install-restart-cold-phone-attempt-2.json)亦保留。两轮权限均收回，收尾旧页面关闭错误不记为原聊天恢复通过。驱动仅补充实际进程等待，不改产品或重复原写入。三轮之间的Host变化使原单跳重启审计[按设计拒绝](../../../plugin/artifacts/latest-runtime-check/latest-live-cold-plugin-summary-after-report.json)；新增独立history模式不声称审计全部中间进程链，仍完整核验原身份、地址、全部事件/消息前缀与投影，[12会话/2106事件通过](../../../plugin/artifacts/latest-runtime-check/latest-live-cold-plugin-summary-history-report.json)、新增标记0。原after模式与失败报告保持。

固定源码重新按原安装器准备36文件候选，默认堆完整构建344.975秒通过。[实际下载阶段冷恢复](../../../plugin/artifacts/latest-runtime-check/latest-live-source-install-restart-cold-phone.json)亦通过：包装器13052、真正监听的核心Host65384、安装范围45016/下载16532分别核验；结束App31413后只结束核心Host，安装进程及TCP先于恢复退出。恢复同home/绑定/端口的包装器73208及冷开App7913/新WebView，原编号`cf4c6059-889e-4caa-8700-5d1cf0f1fc29`显示unknown，无重试、仅一次GET，三个配置与原分页/投影保持，临时管理权限收回。[原单跳全历史审计](../../../plugin/artifacts/latest-runtime-check/latest-live-source-cold-phone-after-report.json)通过12会话/2106原事件及完整投影，新增标记0。

### 安装脚本运行中手机与Host同时结束

沿原管理页安装仅输出PID并等待90秒的专用夹具。未批准时原管理器拒绝，手机明确批准后实际脚本存活且本机pending摘要已落盘，才结束App并单独结束核心Host；未结束包装器或整树来冒充原生范围自行退出。源码[整轮报告](../../../plugin/artifacts/latest-runtime-check/latest-live-source-script-restart-cold-phone.json)通过：包装器73208/核心37020、范围56164/脚本23344，App7913→10662，恢复包装器27376，原操作`117040ca-4a67-4a91-9251-43815b74ddb4`保留unknown及折叠提醒。发布[整轮报告](../../../plugin/artifacts/latest-runtime-check/latest-live-script-restart-cold-phone.json)也通过：核心19368、范围66616/脚本14168，App10662→13059、Host22000，原编号`a235f2a7-fa0f-4daa-a19d-f86e2c03f04a`保持。两轮脚本进程均在恢复前退出，新WebView没有原安装弹窗，仍可核对原摘要；不重复批准、不自动重装。

两轮都实际留下测试包的锁文件条目，不宣称产品自动回滚。独立清理分别通过[源码](../../../plugin/artifacts/latest-runtime-check/latest-live-source-script-restart-cold-phone-cleanup.json)与[发布](../../../plugin/artifacts/latest-runtime-check/latest-live-script-restart-cold-phone-cleanup.json)：只显式拒绝本次测试来源，使用原安装器离线清理，三个配置字节、测试包与run.json精确恢复。临时管理权限收回、原主聊天和空草稿保持；[源码](../../../plugin/artifacts/latest-runtime-check/latest-live-source-cold-return-after-report.json)与[发布](../../../plugin/artifacts/latest-runtime-check/latest-live-release-cold-script-after-report.json)原单跳审计均通过12会话/2106原事件、地址/消息前缀/投影，新增标记0。

载体切换不能沿用要求同载体的after审计：源码准备后的原[失败报告](../../../plugin/artifacts/latest-runtime-check/latest-live-source-cold-entry-after-report.json)按设计拒绝release→source，保留而不改写。审计器新增显式carrier入口，仍校验拥有的停止记录、原绑定和全部历史，只允许源码/发布之间实际切换；[source→release](../../../plugin/artifacts/latest-runtime-check/latest-live-source-cold-back-release-carrier-report.json)通过。原after/history同载体断言保持，未用当前历史一致来伪称全部中间进程链通过。

当前已证实两种入口的下载/脚本阶段手机冷恢复。修复/applying阶段、其他设备、实际SEA/Electron/TTY、18项补丁最终去留与全部8项新版总标准继续，不能记为完整新版已交付。本轮SOURCE36已停止，完整原构建349.892秒退出0；36原源码/启动载荷、Git干净及355前端资源原摘要逐项核验，已[排他归档](../../../plugin/artifacts/latest-runtime-check/latest-live-source-lease-package-range-cold-final.json)。正常发布Host22000与App13059保留，管理false、原主聊天/空草稿及MuMu前台画面核对通过。旧租约归档仍保留，未覆盖它冒充新轮恢复。

## 发布入口 applying 阶段的手机冷恢复

固定发布入口与原独立App的[第二轮完整报告](../../../plugin/artifacts/latest-runtime-check/latest-live-release-applying-cold-phone-attempt-2.json)通过。驱动是[真实原管理页专项](../../scripts/verify-latest-live-applying-cold-android.mjs)，没有修改生产代码、重建APK或读取Key。两个测试包沿原安装器实际安装；辅助包只在真实 `plugin-manager/install-state` 的 applying 事件上延长原 HMR 排队，控制文件位于本轮排他临时目录，最长45秒自动释放。保留原安装、取消和回执实现，未制造安装结果或注入聊天事件；这不是任意插件加载内部崩溃的验证。

手机实际看到 applying、原pnpm已完成、目标依赖已写入且 `run.json` 不存在，原操作 `7f53b568-1027-4550-b36f-dfba425f05df` 的严格pending摘要落盘后，先结束App16572，再单独结束已核验的核心Host51112（不带/T）。原HMR控制记录在核心结束后仍为holding，证明没有等队列自然结束再冒充中断。原控制器随后正常清理拥有的服务；因核心被强制结束，原监督命令退出1，不能记为自然成功退出。

恢复同home/绑定/地址为Host11712，冷开App28871与新WebView，原编号显示无法确认结果，展开无按钮、折叠仍有提醒；目标包文件保持。`noRetry` 在该报告具体证明没有重试按钮，不以此字段单独声称已逐包统计所有后台请求。摘要不包含安装payload，测试没有重放请求；安装/查询实现仍沿既有严格协议。

两个专用包经手机原管理页逆序卸载，测试前三配置字节逐项恢复，原60条分页历史与完整投影、主聊天/空草稿/workspace-write和management=false保持，页面错误为空，驱动终态退出0。另有[单跳全历史审计](../../../plugin/artifacts/latest-runtime-check/latest-live-release-applying-cold-after-report.json)：12会话/2106原事件、原消息前缀/投影/地址/绑定保持，新增恢复标记0；该审计也包含首轮失败后的独立清理，没有中间Host切换。

[首轮失败](../../../plugin/artifacts/latest-runtime-check/latest-live-release-applying-cold-phone.json)仅因驱动仍按“添加插件”名称寻找已改标题的已安装弹窗，未进入目标安装或结束App/Host。原管理页[独立清理](../../../plugin/artifacts/latest-runtime-check/latest-live-release-applying-cold-phone-cleanup.json)通过包卸载、三个原摘要和撤权/聊天恢复；没有覆盖失败报告。驱动修正为根据原 `data-install-phase` 定位真实弹窗，并接受原完整包名标签，第二轮沿相同实际入口通过。

### SOURCE 补验与失败边界

真实 `pnpm dsh web` 的[第三轮完整报告](../../../plugin/artifacts/latest-runtime-check/latest-live-source-applying-cold-phone-attempt-3.json)通过：操作 `39c4e02f-f8a6-4f5b-a39b-f21f547e7c82`，包装器30828、实际核心9196，App6597先结束；驱动在DSH树外按实际监听PID执行 `taskkill /PID 9196 /F`，不带/T、不结束包装器。实际辅助模块URL及PID9196另已核验，安装阶段/严格摘要/run.json均核对；核心退出后控制记录仍holding。恢复包装器20152、冷开App12296/新WebView，原unknown、无重试按钮及折叠提醒、目标文件、原60条历史/投影保持。两个专用包经原管理页卸载，测试前三配置字节、空草稿/主聊天/workspace-write与management=false精确恢复，页面错误为空，驱动退出0。

[SOURCE单跳全历史审计](../../../plugin/artifacts/latest-runtime-check/latest-live-source-applying-cold-after-report.json)保持12会话/2106原事件、地址/消息前缀/投影/原绑定，新增恢复标记0。随后停止拥有的SOURCE服务并恢复同home正常发布Host14292，[明确载体切换审计](../../../plugin/artifacts/latest-runtime-check/latest-live-applying-source-return-carrier-report.json)也通过同一完整历史与权限。切换最初未等SOURCE ready就启动的两个只读探针在 `process.kill` 处ESRCH退出、未读取历史；后来的单跳和返程载体报告分别核对各自实际入口，不冒充最初探针通过。

SOURCE[首轮](../../../plugin/artifacts/latest-runtime-check/latest-live-source-applying-cold-phone.json)实际进入applying并结束App，但外部核心结束动作晚于35秒等待期，finally先释放了门闩；随后才结束核心，不算正确时序通过。原失败及[原管理页独立清理](../../../plugin/artifacts/latest-runtime-check/latest-live-source-applying-cold-phone-cleanup.json)保留，三个原摘要/历史/权限恢复。第二轮自动结束驱动的[原失败](../../../plugin/artifacts/latest-runtime-check/latest-live-source-applying-cold-phone-attempt-2.json)为未出现门闩记录，未进入结束步骤；原管理页卸载/配置/聊天/权限恢复通过。门闩缺失根因未确证，不能声明为产品故障或已修复产品缓存。第三轮改用每次独立包名/控制路径，并核对实际加载模块URL/PID，测试门闩最长85秒且原arm有90秒上限；生产代码、旧夹具和APK不变。

这补齐两种入口该时序的实际冷恢复；实际SEA/Electron/TTY、其他插件内部应用副作用及原总范围继续待验。SDK第三轮在SEA注入exe时失败、原报告和产物保留；本轮原36文件/根启动字节、原完整构建352.172秒退出0、355资源精确恢复及Git干净已核验并[排他归档](../../../plugin/artifacts/latest-runtime-check/latest-live-source-lease-package-range-applying-final.json)。首次非TTY恢复构建失败和严格限定该失败的重试证据见[SDK打包与源码恢复](../../../plugin/compatibility/latest-upstream/source-runner-profile-resolution.md#sdk-打包与源码恢复)。当前正常发布服务和实际MuMu主聊天保留。

## 下载专项的失败记录与边界

发布修复阶段首轮[实际MuMu冷恢复](../../../plugin/artifacts/latest-runtime-check/latest-live-release-repair-host-only-native-installed-cold-phone.json)完整通过，[全历史审计](../../../plugin/artifacts/latest-runtime-check/latest-live-release-repair-cold-after-report.json)保持12会话/2106原事件。源码同项[首轮失败](../../../plugin/artifacts/latest-runtime-check/latest-live-source-repair-host-only-native-installed-cold-phone.json)在审批前缺包，脚本请求0，原配置/权限及主聊天恢复，失败保留。正式运行器显式绑定源码tsconfig、新36文件完整构建后，[源码第二轮](../../../plugin/artifacts/latest-runtime-check/latest-live-source-repair-host-only-native-installed-cold-phone-attempt-2.json)与[新发布第二轮](../../../plugin/artifacts/latest-runtime-check/latest-live-release-repair-host-only-native-installed-cold-phone-attempt-2.json)均完整通过：手机先结束，单独结束实际核心Host，恢复前范围/脚本/写入进程死亡、TCP关闭且写入停止；新App/新WebView保留原unknown/折叠提醒/无自动重试、旧版及三配置保持。原管理器接管死记录、明确重新安装及卸载后，原配置/历史/主聊天/空草稿与management=false恢复。两个单跳全历史审计和源码→发布切换审计均保持12会话/2106原事件、完整投影及绑定，新增恢复标记0。新载荷、实际参数验证器失败记录、SDK未解除限制及本轮源码恢复见[电脑端正式修正证据](../../../plugin/compatibility/latest-upstream/source-runner-profile-resolution.md#正式修正与两个实际手机入口)，不替代applying阶段或完整新版验收。

- 发布首轮及第二轮尚未提交安装：管理授权变化关闭旧连接，驱动未重连或重复点击禁用中的重连按钮。修正实际连接等待，管理权限每次均收回。
- 发布第三轮已通过全部未知结果、配置及历史断言，返回聊天被未关闭的插件窗口遮挡；[原失败](../../../plugin/artifacts/latest-runtime-check/latest-live-install-restart-attempt-3.json)和[独立恢复](../../../plugin/artifacts/latest-runtime-check/latest-live-install-restart-finish.json)保持。第四轮使用修复候选完整通过。
- 源码前两轮保留原等待查询被拒绝的证据；[第二轮原页面](../../../plugin/artifacts/latest-runtime-check/latest-live-source-install-restart-attempt-2-failure.png)明确显示 `remote_operation_denied`，不是模型或网络失败。第三轮查询修复已生效，[实际原未知弹窗](../../../plugin/artifacts/latest-runtime-check/latest-live-source-install-restart-attempt-3-failure.png)保留；驱动过早等待“添加插件”尚未完成，未算整轮通过。
- [策略测试](../../../backend/tests/plugin-install-recovery-policy.test.ts)覆盖两版协商和参数拒绝；真实 HTTP/WS/SQL [网关权限测试](../../../backend/tests/remote-permissions.test.ts)拒绝基本权限设备；[旧 Host 适配器](../../../plugin/tests/remote-adapter.test.ts)独立拒绝原查询。相关后端五项、适配器45项、手机操作记录10项通过；新旧类型、协议/网关及独立候选构建通过。

下载专项只证明下载阶段整体退出；它本身未执行脚本，不能借用后来脚本或修复专项的证据扩大该报告范围。上方各专项分别验证脚本拒绝/批准、取消，以及不兼容组件后修复中的进程树退出/未知恢复，不证明任意安装脚本副作用可回滚。只杀 Host 而遗留子进程、手机进程结束后的持久安装摘要、其他系统/网络时序仍需分别核验。原新版管理器保留运行记录并在下一次写入前核对旧进程；没有手动删除原写入锁或运行记录。原检查继续开始不代表任意崩溃自动恢复均通过。

旧13项/31文件租约原字节、启动载荷、Git干净与355资源已通过完整恢复，并排他归档。本轮修复组合亦为13项/31文件，完整构建348.74秒；切回同一home的RELEASE入口后，恢复构建332.28秒，31原文件、根启动载荷、Git干净及355原资源摘要通过，详见[31文件恢复归档](../../../plugin/artifacts/latest-runtime-check/latest-live-source-lease-before-package-range.json)。正式原生范围已加入独立13项/36文件源码候选；环境类型与默认堆打包两次失败均保留，首轮完整恢复240.11秒、第二轮恢复230.71秒均通过36原文件/启动载荷/Git干净及355原资源核对。带类型的runner导出修正后，默认堆完整构建343.323秒、九个实际运行场景、86项原回归及原安装器调用者退出/修复取消/超时三项范围验证均通过，详见[新候选与失败依据](../../../plugin/compatibility/latest-upstream/package-repair.md#正式源码原生范围候选与构建诊断)。SOURCE36租约保持ready、最终恢复尚未执行；当前手机及发布DSH尚未接入新范围，打包载体和手机原场景仍待验，不能记为完整手机仅Host退出已修复。MuMu独立App已通过实际安卓设备窗口核对并切到前台；日常DSH、Key和App没有替换，其余KKC-24标准继续，不发布完整新版支持声明。
