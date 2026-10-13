# 新版程序文件写入验收

状态：显式指定已有文件的修复候选已在原失败工作区、原文件路径及同一手机会话通过固定源码与 npm 发布入口的实际修改/回读、只读拒绝及结果/历史；全部8对象权限和字节精确恢复。28项原生对照、越界拒绝、重复无改动、明确拒绝ACL的实际回滚及缺WRITE_DAC/非本人所有/junction拒绝也通过。独立人工工具CLI和恢复说明已提供；文件符号链接输出分支尚未实测，其他完整新版标准仍待完成。原失败保留。维护角色：DSHM 兼容验证。最近核验：2026-10-06。

固定目标仍为 DSH `0.2.1-alpha.1` / `5badb15009ae1756c3afe0ae0cef1faafc290ccc`，候选插件 `0.1.76-latest.0`。本项使用原源码 `pnpm dsh web`及 npm 发布 `node dsh/lib/bin.js web`、真实网关和独立 MuMu App；不是伪造工具结果，不改变日常旧版支持声明。

## 实际结果

在已有专用 PTC 会话中，从手机原输入框各提交一次原 `run_code`。程序直接 `await import('node:fs/promises')`，对一个排他创建的随机测试文件执行 `writeFile` 和 `readFile`，输出中文及 emoji 并返回原字符串。只允许一个原调用，不申请升级权限、不执行内部工具、Shell、联网或重试。

| 场景 | 原结果与磁盘证据 | 手机范围 |
| --- | --- | --- |
| 仅可查看 | 第14轮 `call_00_HWFQmBx1eWcyav0PIgZM9240` 已输出启动标记；实际 `writeFile` 返回 `EPERM`，原 `CODE_RUN_FAILED` 及 `sandbox: read-only; enforcement: partial; operation denied` 保持。文件全文仍为 `DSHM_PTC_FILE_BEFORE\n`。 | 同一工具详情和重新进入历史均展示原结果；无重试。 |
| 工作区内修改 | 第15轮 `call_00_FqgbqvMsHVc6mVV4ps0B9757` 已输出启动标记；实际 `writeFile` 仍返回 `EPERM`，原策略确为 `workspace-write`。文件全文未变，本项失败。 | 未把模型解释或可写投影当成执行成功；原错误保留，未重发请求。 |

[验证器](../../scripts/verify-latest-live-ptc-file-android.mjs)将发送、观察、历史和恢复分开。只读首个观察因“工具详情”位于插件盒子外而定位超时，保留[失败记录](../../../plugin/artifacts/latest-runtime-check/latest-live-source-ptc-file-read-only-first-selector-failed.json)。修正定位后只观察同一请求，见[只读结果](../../../plugin/artifacts/latest-runtime-check/latest-live-source-ptc-file-read-only-android-observe.json)、[历史重入](../../../plugin/artifacts/latest-runtime-check/latest-live-source-ptc-file-read-only-android-replay.json)与[原权限恢复](../../../plugin/artifacts/latest-runtime-check/latest-live-source-ptc-file-read-only-android-return.json)。

可写失败证据：[一次请求与精确程序](../../../plugin/artifacts/latest-runtime-check/latest-live-source-ptc-file-workspace-write-seed.json)、[原结果和磁盘摘要](../../../plugin/artifacts/latest-runtime-check/latest-live-source-ptc-file-workspace-write-android-observe.json)、[失败后字节/会话恢复](../../../plugin/artifacts/latest-runtime-check/latest-live-source-ptc-file-workspace-write-android-return-failed.json)。恢复报告的 `passed=false` 保留测试失败含义，`failedScenarioCleaned=true` 仅说明清理完成。

## 已定位的差异与尚未证明的原因

原官方诊断脚本在已授权的 UUID 测试工作区根目录核对并补充当前用户缺失的目录权限，复读 `WRITE_DAC/WRITE_OWNER=true`，只有一项根目录变化。原 Medium 令牌、所有者、祖先目录和文件内容未改变；见[官方完整报告](../../../plugin/artifacts/latest-runtime-check/latest-live-source-ptc-file-acl-recovery/acl-report-6ba4dc510c74443e8beb55635650b54f.jsonl)。这解决了此前程序启动前 `grantWrite` 的 Win32 5，不等于本次实际文件写入通过。

实际根目录有原工作区 capability ACE 和 Low 标签，已有失败文件却没有继承这些条目，且文件继承未被保护；Q盘为本地 NTFS。独立调用原 `AclSandbox` 的原 `init/spawn/wait` 接口也复现差异：已有文件返回 `EPERM/exitCode=1`，根目录授权后新建的专用副本成功写入并回读 `NATIVE_WRITE/exitCode=0`。见[独立原沙箱探针](../../../plugin/artifacts/latest-runtime-check/latest-live-source-ptc-file-native-probe-valid.json)。该探针无需手机、网关或模型参与，因此问题已定位到电脑文件沙箱/目录权限传播这一层；尚未证明传播为何没有落到旧文件。

独立探针首个版本的内联程序换行错误产生 `SyntaxError`，没有执行文件操作，保留[首个报告](../../../plugin/artifacts/latest-runtime-check/latest-live-source-ptc-file-native-probe.json)；随后核对两个文件仍为原字节，再用正确程序独立验证。不能用首个 exitCode=1 宣称复现权限失败。

[Microsoft 的接口说明](https://learn.microsoft.com/en-us/windows/win32/api/aclapi/nf-aclapi-setnamedsecurityinfow)描述 `SetNamedSecurityInfoW` 会将可继承条目传播至已有子对象。当前观察与预期不一致，后续需要对照原目录、子文件权限及原调用验证，而不是手工改权限、递归覆盖用户文件、直接切为完全权限，或把“新文件可以写”替代“已有文件可以修改”的完整目标。

## 清理与后续

[独立清理脚本](../../../plugin/scripts/cleanup-latest-live-ptc-file-grant.mjs)只核对本次随机文件和固定隔离目录：两份模型探针文件恢复原字节，独立沙箱副本确认原输出后移除，原 workspace grant 撤销，Low 标签清理。随后使用本次官方备份恢复原 DACL；[清理报告](../../../plugin/artifacts/latest-runtime-check/latest-live-source-ptc-file-grant-cleanup.json)和[精确恢复核对](../../../plugin/artifacts/latest-runtime-check/latest-live-source-ptc-file-acl-restored.json)证明所有者、保护及 DACL 字节相同。

原 Host69680/控制器13940正常停止，PTY80297结算0；原 home 的 `cleanup.json` 核对 Host69680、CIM两进程消失后，同一 home/16901端口恢复源码 Host71332/控制器11624，PTY49036保持运行。原配对和管理false保留；[实际Android恢复](../../../plugin/artifacts/latest-runtime-check/latest-live-source-ptc-file-restored-android.json)核对 PTC 会话未运行、权限为 workspace-write，再返回原主聊天，未加载 iframe。30源码租约仍需在全部专项结束时恢复。

后续对照与两种入口实际手机的进展见下节；发布入口已通过有权限新工作区对照，原失败目录仍未修复，下一步确定缺少权限时的正式处理。新目录成功不能替代原失败目录的修复，也不能关闭完整可写标准。其他内部工具、自动审核、其他通知类型及完整新版交付仍待验；任务保持 [KKC-24](https://linear.app/kkcodes/issue/KKC-24) In Progress。

## 独立原生最小复现与单变量对照

在项目产物内新建 UUID 目录，预先创建根目录文件与嵌套文件；不使用实际模型会话的工作区，不修改日常 DSH。使用[诊断器](../../../plugin/scripts/diagnose-latest-acl-inheritance.mjs)调用固定源码的原 `AclWriteGrant` 和受限 `AclSandbox`，逐对象读取真实 DACL/Low 标签及原生返回值。诊断器是排查入口，不是交付补丁；各阶段排他写入报告，拒绝覆盖已有证据。

先复现原授权的 Win32 5，再在这个随机目录使用官方脚本修复且复读权限；[完整报告](../../../plugin/artifacts/latest-runtime-check/latest-acl-inheritance-recovery/acl-report-8912ab262b05435b8c543be5c4672d9a.jsonl)记录只添加根目录当前用户的非继承 FullControl。原调用和对照如下：

| 变量 | 原生结果与已有对象 | 实际受限文件操作 |
| --- | --- | --- |
| 原三项合并设置，`DACL \| LABEL` | `SetNamedSecurityInfoW` 返回 0；根目录有 capability、容器删除拒绝与 Low，已有文件和子目录均没有 capability 或 Low。 | 两个已有文件在 workspace-write 下均 `EPERM/1`，新文件可写；read-only 三种写入都被拒绝。 |
| 同一描述符的 Tree 接口，`TREE_SEC_INFO_SET` | 合并设置、仅 DACL、仅 LABEL 均返回 0，没有逐对象回调，已有对象未改变。 | 不把返回 0 当成整棵树授权成功。未使用 RESET、RESET_KEEP_EXPLICIT、取消或重试。 |
| 撤销后由同一原 grant 拆分为 DACL、LABEL 两次设置 | 两次均返回 0；已有文件和子目录出现继承 capability，但仍没有 Low。 | 同样的六项原受限操作仍得到“五项拒绝、可写新文件成功”；已有文件修改未修复。 |

证据：[原合并调用及前后 ACL](../../../plugin/artifacts/latest-runtime-check/latest-acl-inheritance-grant-after-repair.json)、[六项原生操作](../../../plugin/artifacts/latest-runtime-check/latest-acl-inheritance-probe-valid.json)、[Tree 逐对象诊断](../../../plugin/artifacts/latest-runtime-check/latest-acl-inheritance-tree-inspect.json)、[拆分设置](../../../plugin/artifacts/latest-runtime-check/latest-acl-inheritance-split-grant.json)、[拆分后的六项操作](../../../plugin/artifacts/latest-runtime-check/latest-acl-inheritance-probe-split.json)。首个 probe 因 read-only 错传 writeSid 在启动前被原参数校验拒绝，保留[失败报告](../../../plugin/artifacts/latest-runtime-check/latest-acl-inheritance-probe.json)，不能将其算作文件操作拒绝。

这组对照排除了“只有手机或网关路径导致写入失败”以及“只是授权缓存未刷新”。在本机固定版本与目录中，拆分调用会改变 DACL 的传播结果，却不足以修复已有文件写入。Low 标签为何未传播、安全保留原边界的完整修复方案仍待核实；没有据此修改生产沙箱、去掉原拒绝条目、降低受限令牌要求或递归赋予用户文件 FullControl。Tree 函数、回调与 Koffi 签名依据 [Microsoft TreeSetNamedSecurityInfoW](https://learn.microsoft.com/en-us/windows/win32/api/aclapi/nf-aclapi-treesetnamedsecurityinfow)、[PROG_INVOKE_SETTING](https://learn.microsoft.com/en-us/windows/win32/api/accctrl/ne-accctrl-prog_invoke_setting)及[Koffi 回调文档](https://koffi.dev/callbacks)核对；原源码的安全设计见[官方说明](../../../plugin/artifacts/latest-source-check/.agents/notes/implemented/feature/2026-09-19-windows-acl-mandatory-integrity-confinement.md)。

对照结束后精确核对并移除两份新建原生文件，调用原 grant 撤销，再使用这一 UUID 目录的官方备份恢复 DACL。[恢复核对](../../../plugin/artifacts/latest-runtime-check/latest-acl-inheritance-restore-verify.json)证明根目录、已有文件、嵌套目录及文件的全部 DACL/Low 条目与初始读取相同，两份原文件均保持 `BEFORE\n`。[最终诊断审计](../../../plugin/artifacts/latest-runtime-check/latest-acl-inheritance-audit.json)为 `diagnosisVerified=true`、`existingWritesCompatible=false`，退出码 1 明确保留兼容失败，不能以清理或诊断成功关闭可写验收。本轮没有改变实际 Host71332 的授权缓存或生产代码。

### 已有文件的安全标签写入权限

在上述精确恢复后，[child-rights 原生报告](../../../plugin/artifacts/latest-runtime-check/latest-acl-inheritance-child-rights.json)用 `CreateFileW / OPEN_EXISTING` 分别检查四个对象的 `WRITE_DAC` 和 `WRITE_OWNER`：八项检查中普通权限写入均可打开，安全标签所需的 `WRITE_OWNER` 均返回 Win32 5。用原源码构造的 Low ACL，对两份已有文件直接调用仅 `LABEL_SECURITY_INFORMATION=16` 的 `SetNamedSecurityInfoW`，也均返回 5。全部四对象的 DACL/标签和两个原文件字节仍与恢复前相同，没有改变实际 Host、启用特权或手工放宽权限。

[Microsoft SECURITY_INFORMATION](https://learn.microsoft.com/en-us/windows/win32/secauthz/security-information)明确标签写入需要 `WRITE_OWNER`，与普通 DACL 写入权限分开；原官方修复脚本只向目录添加非继承权限，不能据此认为已有文件也获得标签写入权限。这证明直接逐文件补 Low 在当前权限布局下仍会失败，尚不足以解释原合并调用跳过传播的全部原因，也不是修复方案。[上游类似报告](https://github.com/deepseek-ai/deepseek-harness/discussions/8383)记录其他版本的标签传播现象，未提供经过本项目验证的修复；本机固定版本结论仍以独立原生证据为准。

### 在创建时指定权限的原生对照

[新诊断器](../../../plugin/scripts/diagnose-latest-acl-created-security.mjs)只通过 `CreateDirectoryW` 在创建项目产物中的排他 UUID 测试目录时指定当前用户权限；没有给已有用户文件补权限、修改所有者、启用特权或更换受限令牌。原 `AclWriteGrant` 与 `AclSandbox` 仍来自固定源码的真实发布库。接口依据为 [CreateDirectoryW](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createdirectoryw)、[SECURITY_ATTRIBUTES](https://learn.microsoft.com/en-us/windows/win32/api/wtypesbase/ns-wtypesbase-security_attributes)与[描述符转换](https://learn.microsoft.com/en-us/windows/win32/api/sddl/nf-sddl-convertstringsecuritydescriptortosecuritydescriptorw)。

首组在创建时指定当前用户可继承 FullControl，比较原合并设置与拆分设置，两组共28项原受限文件操作：已有根文件、嵌套文件与新建文件在 workspace-write 下均可写；read-only 全部写入和两个模式跨工作区/工作区外写入、删除均被原 `EPERM` 拒绝。原合并调用本身也能传播 capability 与 Low，不能根据先前缺权限目录的表现认定 API 必须拆分。见[首组报告](../../../plugin/artifacts/latest-runtime-check/latest-acl-created-security.json)。

第二组只改变继承给子对象的 `WRITE_OWNER=0x80000`，本人权限掩码分别为 `0x1701ff` 与 `0x1f01ff`。测试根目录在创建时保留相同的本人非继承 FullControl，根 DACL 保护标记也相同；子文件与嵌套目录允许正常继承。两组都使用原合并调用，共28项受限操作。缺此位时根 grant 返回0，已有文件却没有 Low/capability、实际写入 `EPERM`，新建文件可写；有此位时已有对象继承 Low/capability，实际写入成功。只读及跨工作区/外部写入、删除仍全部被拒绝。源文件分别保持 `BEFORE\n` 或核对为 `AFTER\n`，见[单变量报告](../../../plugin/artifacts/latest-runtime-check/latest-acl-created-security-write-owner-only-explicit-root.json)。

[只读审计](../../../plugin/scripts/audit-latest-acl-created-security.mjs)逐项比较两组创建后的真实权限，证明去除该位后描述符相同，检查实际 Low 继承、56项原生操作及测试目录均已移除；[审计报告](../../../plugin/artifacts/latest-runtime-check/latest-acl-created-security-audit.json)明确 `originalWorkspaceFixed=false`、`productionSandboxChanged=false`。这证明当前独立复现受该权限差异控制，不代表任意 Windows 权限布局或全部文件系统都已验证。

首轮单变量描述符没有保护根 DACL，Windows 对父目录的继承重算又移除了测试根的本人权限，原 grant 撤销报 Win32 5；只完成无权限半组，不能算整组通过。[原失败报告](../../../plugin/artifacts/latest-runtime-check/latest-acl-created-security-write-owner-only.json)保持 `AggregateError`，所有排他创建的对象已移除。随后仅修正测试根的创建描述符，并在不同 UUID 目录执行上述完整单变量对照，没有复用或重写失败证据。

### 固定源码的有权限工作区实际手机写入

[准备器](../../scripts/prepare-latest-live-ptc-owned-android.mjs)在原独立 home 创建 `ptc-owned-project-cb85b6eb-5e7a-4748-9b6e-dc2de04fa515`，创建时指定当前用户可继承 FullControl，通过原电脑 `workspace/create` 登记。手机只在这个已有工作区新建聊天、改名并选择原 PTC 模式；手机创建电脑目录的能力没有开放。见[准备报告](../../../plugin/artifacts/latest-runtime-check/latest-live-source-ptc-owned-android-prepare.json)。

SOURCE Host71332/30源码租约、原网关和同一独立 Android App，在 `session-69baec5f-7e20-443d-9c9b-c69038d1d15f` 各只提交一次真实 `run_code`：

| 场景 | 原调用与实际磁盘 | 手机界面与历史 |
| --- | --- | --- |
| read-only | 第1轮 `call_00_ZopSct9cK5sfds3fGrD12028` 实际 `writeFile` 被原 EPERM 拒绝，文件全文与摘要保持；没有提权、嵌套工具或重试。 | 原 `CODE_RUN_FAILED`、partial 提示、中文标记及历史重入通过。 |
| workspace-write | 第2轮 `call_00_UvCPWzDBoWaznGeMjVkI9411` 修改预先创建的已有文件，再实际 `readFile`，返回原中文/emoji正文及对象；原工具成功、磁盘全文/摘要与请求相同。 | 原详情和重新进入历史显示同一结果，原 partial 提示保持，没有假结果或重发。 |

执行器沿用[原手机验收器的 owned 参数](../../scripts/verify-latest-live-ptc-file-android.mjs)，读取入口增加一个严格限定的新测试会话文件，仍验证原 home、固定 commit、路径归属和真实原记录。证据为[只读结果](../../../plugin/artifacts/latest-runtime-check/latest-live-source-ptc-owned-file-read-only-android-observe.json)、[只读历史](../../../plugin/artifacts/latest-runtime-check/latest-live-source-ptc-owned-file-read-only-android-replay.json)、[权限恢复](../../../plugin/artifacts/latest-runtime-check/latest-live-source-ptc-owned-file-read-only-android-return.json)、[可写结果](../../../plugin/artifacts/latest-runtime-check/latest-live-source-ptc-owned-file-workspace-write-android-observe.json)、[可写历史](../../../plugin/artifacts/latest-runtime-check/latest-live-source-ptc-owned-file-workspace-write-android-replay.json)及[文件/会话恢复](../../../plugin/artifacts/latest-runtime-check/latest-live-source-ptc-owned-file-workspace-write-android-return.json)。[实际手机详情截图](../../../plugin/artifacts/latest-runtime-check/latest-live-source-ptc-owned-file-workspace-write-observe.png)已核对原调用代码与实际返回内容。

源码阶段两份专用文件已恢复 `DSHM_PTC_FILE_BEFORE\n`，会话回到 workspace-write，手机返回原主聊天，设备管理权限保持 false。随后在同一 home 和原配对切换发布入口，结果及最终清理见下节。原失败工作区保持原权限与失败报告，没有以新目录通过宣称它已修复；原缺权限目录的处理及完整新版支持仍待验。

### npm 发布入口及最终清理

源码 Host71332 正常停止后，同一 home、16901 网关、配对与原历史由发布 Host76784 恢复，命令为 `node dsh/lib/bin.js web`。验收器核对实际发布 DSH `0.2.1-alpha.1` 与候选插件 `0.1.76-latest.0`，不通过源码入口代替发布结果。App PID8314 保持，设备管理 false。

| 场景 | 原调用与实际磁盘 | 手机界面与历史 |
| --- | --- | --- |
| read-only | 第3轮 `call_00_tF05DxqZ7Ce3jLNGoMUp3850` 实际 `writeFile` 被原 EPERM 拒绝，已有文件全文不变；只有一次原调用。 | 原详情、partial 提示、历史重入及原权限恢复通过。 |
| workspace-write | 第4轮 `call_00_hSGuIRE5pv8CfGk6rv5v9612` 实际修改已有文件并回读中文/emoji正文，磁盘 SHA256 `26b2b4325482234552f5960c0bf7c4d6b820ed9c5ea1d79a4767f7db12f40054`。 | 原结果、详情、partial 提示及历史一致，恢复 BEFORE 和 workspace-write 后返回原主聊天，无重发。 |

证据：[发布只读结果](../../../plugin/artifacts/latest-runtime-check/latest-live-ptc-owned-file-read-only-android-observe.json)、[发布只读历史](../../../plugin/artifacts/latest-runtime-check/latest-live-ptc-owned-file-read-only-android-replay.json)、[发布只读恢复](../../../plugin/artifacts/latest-runtime-check/latest-live-ptc-owned-file-read-only-android-return.json)、[发布可写结果](../../../plugin/artifacts/latest-runtime-check/latest-live-ptc-owned-file-workspace-write-android-observe.json)、[发布可写历史](../../../plugin/artifacts/latest-runtime-check/latest-live-ptc-owned-file-workspace-write-android-replay.json)及[发布文件恢复](../../../plugin/artifacts/latest-runtime-check/latest-live-ptc-owned-file-workspace-write-android-return.json)。

首次发布 start 在连接暂停普通 WebView 时等待抽屉按钮超时，发生于种子创建与消息发送之前；[失败摘要](../../../plugin/artifacts/latest-runtime-check/latest-live-ptc-owned-release-open-failed.json)明确不是原验收器报告，保留原错误且原因未证明。重新核对实际 Remote 前台与页面后执行同一尚未发送的阶段，无重启或重复模型请求。

[清理器](../../scripts/cleanup-latest-live-ptc-owned-android.mjs)核对四组真实观察/历史/恢复报告和四个 BEFORE 文件，仅归档本次专用聊天。首次随后引用发布包不存在的内部 `lib/types/ffi.js` 失败；[原失败报告](../../../plugin/artifacts/latest-runtime-check/latest-live-ptc-owned-cleanup.json)保留，未执行 grant 撤销或删除。发布包实际只公开原 grant，内部类型目录只有声明文件；修正为原发布公共 `AclWriteGrant` 执行撤销，已经核验的同版本源码 FFI 只用于读取真实 Win32 描述符。

`--resume` 从原主聊天核对已归档会话的原 seq94 和页面 SHA256，再对已创建 UUID 根路径及四个文件逐项校验。原 grant 撤销后，五对象均无 capability ACE 或 Low 标签；原电脑接口移除工作区注册，核对文件字节后逐文件移除，再删除空目录，无递归删除。最终 projection 与页面记录保持，见[清理恢复报告](../../../plugin/artifacts/latest-runtime-check/latest-live-ptc-owned-cleanup-resumed.json)。原失败报告不覆盖，手机保持原主聊天。固定源码30文件租约仍用于后续专项，尚未最终恢复；不能因此将完整新版支持或原缺权限工作区记为通过。

## 显式已有文件修复候选（2026-10-06）

已核对固定版本原诊断脚本：它只给检查链中的目录添加当前用户的非继承FullControl，不为请求的已有文件补WRITE_OWNER。因此即使以失败文件为Path运行原脚本，已有文件仍可能不能继承原沙箱的Low标签与capability。原28项对照再次复现：workspace-write的新文件成功，根目录/嵌套已有文件均EPERM；不能用目录修复返回0宣称文件已可写。

两种选择是让原沙箱在授权时自动改整个目录树，或沿用官方显式诊断/恢复工具补齐所指定文件的权限前提。当前候选采用后者：不改变原受限令牌、GRANT_MASK、grant缓存、工具体或生产启动；不自动修复用户项目或递归给文件FullControl。最终交付仍须在原失败目录和两种实际Host/手机入口验证后判断，当前不是生产使用建议。

[候选变换](../../../plugin/compatibility/latest-upstream/acl-repair.mjs)只接受固定原脚本SHA256 `adba89f3b10692302723d231d003cdf365311effaff996d32416f9531e3b63d9`，生成项目产物中的独立脚本，原源码资产未改、31文件租约未增加。目录沿用原修复行为；显式指定的文件必须位于AllowRoot内、由当前用户所有且有有效WRITE_DAC，才补TakeOwnership（WRITE_OWNER）。原reparse/系统路径拒绝、独立备份、实际访问复读、验证失败的逆序回滚及拒绝退出码2保留。没有更换所有者或给沙箱SID添加改权限能力。

.NET的Allow规则会自动附带Synchronize；实际新增ACE为`0x180000`，这不是FullControl。本组原文件已有Synchronize，聚合原权限后实际新增位仅`0x80000`；其他原ACE、所有者和SACL在修复前后保持。依据：[Microsoft AddAccessRule](https://learn.microsoft.com/en-us/dotnet/api/system.security.accesscontrol.filesystemsecurity.addaccessrule?view=net-10.0)、[LABEL所需权限](https://learn.microsoft.com/en-us/windows/win32/secauthz/security-information)。不能将这一已验证布局扩大为任意Windows权限布局。

[原生驱动](../../../plugin/scripts/diagnose-latest-acl-created-security.mjs)的`repair-existing`在排他UUID目录预先创建四个真实文件，两组都从子对象缺WRITE_OWNER的同一布局开始；根目录已有原沙箱的站立删除拒绝。原脚本组和候选组分别在文件存在之后执行修复，随后由同一原AclWriteGrant的合并调用和原AclSandbox执行真正Node文件操作，没有替换Win32结果、模拟沙箱或新建文件代替旧文件。

| 范围 | 原脚本组 | 候选组 |
| --- | --- | --- |
| workspace-write修改根目录已有文件及回读磁盘 | EPERM、BEFORE不变 | 成功、实际AFTER |
| workspace-write修改嵌套已有文件 | EPERM、BEFORE不变 | 成功、实际AFTER |
| workspace-write新建文件 | 成功 | 成功 |
| read-only下三种写入 | 全部EPERM | 全部EPERM |
| 两种模式跨工作区/外部写入和删除 | 全部EPERM，外部原件不变 | 全部EPERM，外部原件不变 |
| 修复结束后的恢复 | 原沙箱撤销，再按官方备份恢复，全部实际描述符与初始一致 | 同样恢复、描述符一致 |

[完整报告](../../../plugin/artifacts/latest-runtime-check/latest-acl-created-security-repair-existing-original-refusal-code.json)记录两组各14项原生操作，`existingRepairVerified=true`，而`existingWritesCompatibleInControlledCreation=false`明确包含刻意保留的原失败组，不代表候选失败。候选还实际拒绝AllowRoot外同属当前用户的文件，退出2、所有对象权限和文件全文不变；再次修复已就绪文件退出0、描述符不变且没有新增备份。全部创建对象已按固定名称逐项移除，未递归删除。

首轮[失败](../../../plugin/artifacts/latest-runtime-check/latest-acl-created-security-repair-existing-first.json)把原grant撤销后有意保留的防删除拒绝当成未恢复；下一轮从正常站立规则开始后，[失败](../../../plugin/artifacts/latest-runtime-check/latest-acl-created-security-repair-existing-standing-deny.json)又误要求.NET新增ACE严格为0x80000，实际带原已存在的Synchronize。修正验收断言后[28项对照](../../../plugin/artifacts/latest-runtime-check/latest-acl-created-security-repair-existing-synchronize-accounted.json)通过。后续[越界断言失败](../../../plugin/artifacts/latest-runtime-check/latest-acl-created-security-repair-existing-boundary-and-repeat.json)只因误要求退出1，原官方明确拒绝为2；最终完整报告核对实际拒绝及未改动后通过。所有失败保持，所创建对象均已移除，没有把原失败改成成功。

本轮没有对原实际工作区或手机会话应用修复，也没有重建APK、读取Key或改生产沙箱。下一步应在Host停止且原权限/文件备份完整的条件下，对原失败测试文件使用这一明确修复，恢复原Host后验证手机只读拒绝和workspace-write实际修改/回读，再在发布入口核对并恢复原描述符与字节。原失败目录的正式处理、明确拒绝ACL/非本人所有文件等修复负例、31文件最终恢复与原8项总标准仍未完成。

### 原失败工作区的两个实际手机入口（2026-10-06）

上述候选阶段的待验项现由实际原路径补齐。[限定准备/修复/恢复器](../../../plugin/scripts/repair-latest-live-original-files.mjs)只接受原隔离UUID home和已存在的7文件工作区，核对原EPERM报告与两份旧seed；[只读快照](../../../plugin/scripts/snapshot-latest-live-original-files.ps1)记录所有者、DACL、保护标志，原Win32读取逐条DACL/Low标签，保存全部字节。见[准备](../../../plugin/artifacts/latest-runtime-check/latest-live-original-files-prepare.json)与[原始快照](../../../plugin/artifacts/latest-runtime-check/latest-live-original-files-repair-before.json)。

原SOURCE Host76412和控制器均实际退出、原cleanup核对后，对两份旧文件执行候选，只有工作区根和两个显式文件生成官方独立备份。其他5文件、安全标签、所有者、保护和字节保持，原路径未替换，见[修复报告](../../../plugin/artifacts/latest-runtime-check/latest-live-original-files-repair.json)。手机验收器新增`repaired`模式复用旧file路径，生成独立新标记/记录，不覆盖旧失败seed或结果。

| 实际入口 | 只读原调用 | 工作区可写原调用 | 实际结果 |
| --- | --- | --- | --- |
| SOURCE Host47492，pnpm dsh web，13项/31文件 | `call_00_JZ7IUNTX01aWzUUE8nFj9120`，初始seq307 | `call_00_dZDBGEseB01LFv4R4UUR3216`，初始seq330 | 只读原EPERM/BEFORE保持；原失败文件成功write/read中文和emoji，磁盘SHA256 `34153a167842ed18606492186d2d4fe43754048bf509d9244af94ddf75a073cb`。 |
| RELEASE Host34616，node dsh/lib/bin.js web，候选0.1.76-latest.0 | `call_00_m8TktI8gfqePA5YxEXuG7703`，初始seq351 | `call_00_ET_TGgfaMPwswTQqwvsI0Wb7718`，初始seq373 | 相同只读拒绝；同一原失败文件实际write/read，磁盘SHA256 `bac0c6d7268ecab0d42bf7ac7b9d93fba8b4eb7294d36b884a812bde24b7445c`。 |

四组各一次实际run_code，没有Shell、嵌套工具、联网、提权或重试。原partial提示保持；两种入口的原结果、手机详情、历史重入和字节/会话恢复均通过，16个发送/观察/历史/恢复阶段退出0。代表证据：[源码只读](../../../plugin/artifacts/latest-runtime-check/latest-live-source-ptc-repaired-file-read-only-android-observe.json)、[源码可写](../../../plugin/artifacts/latest-runtime-check/latest-live-source-ptc-repaired-file-workspace-write-android-observe.json)、[源码历史](../../../plugin/artifacts/latest-runtime-check/latest-live-source-ptc-repaired-file-workspace-write-android-replay.json)、[发布只读](../../../plugin/artifacts/latest-runtime-check/latest-live-ptc-repaired-file-read-only-android-observe.json)、[发布可写](../../../plugin/artifacts/latest-runtime-check/latest-live-ptc-repaired-file-workspace-write-android-observe.json)、[发布历史](../../../plugin/artifacts/latest-runtime-check/latest-live-ptc-repaired-file-workspace-write-android-replay.json)、[发布字节/会话恢复](../../../plugin/artifacts/latest-runtime-check/latest-live-ptc-repaired-file-workspace-write-android-return.json)。[源码手机详情](../../../plugin/artifacts/latest-runtime-check/latest-live-source-ptc-repaired-file-workspace-write-observe.png)实际核对原路径、代码与返回正文。

发送前首次[标题断言失败](../../../plugin/artifacts/latest-runtime-check/latest-live-source-ptc-repaired-file-read-only-open-failed.json)发生于原列表异步导航尚未完成、标题仍Remote时，未创建seed或提交请求。只为验收入口添加等待真实RemoteModel所选id/标题完成，未改产品导航。原失败保持，随后同Host发送唯一请求。

发布Host及控制器实际停止后，原AclWriteGrant撤销工作区能力，再按本次官方备份恢复子文件和根。全部8对象的完整原DACL、保护、所有者、Low标签和字节与初始快照一致，见[精确恢复](../../../plugin/artifacts/latest-runtime-check/latest-live-original-files-restore.json)。原失败工作区保留原权限和全部历史，正常SOURCE Host18140重启供剩余专项使用；[重启后只读审计](../../../plugin/artifacts/latest-runtime-check/latest-live-original-files-audit.json)实际核对Host/控制器仍存活、8对象仍与初始一致。连接online、设备管理false，没有让文件永久拥有测试修复权限。

### 明确拒绝ACL的修复负例

[负例驱动](../../../plugin/scripts/verify-latest-acl-repair-deny.ps1)只在排他创建的UUID测试目录，给一个BEFORE文件添加明确的当前用户TakeOwnership拒绝。原候选的真实grant写入后复读仍为WRITE_OWNER=false，按原逻辑退出2并逆序自动回滚；DACL/所有者/保护、根权限和字节均保持。实际失败grant和verified restore都来自原JSONL，不能靠非零退出码推定安全。见[通过报告](../../../plugin/artifacts/latest-runtime-check/latest-acl-repair-explicit-deny-original-refusal-code.json)。专用文件和空目录逐项移除；原规则未覆盖拒绝。

首轮[失败](../../../plugin/artifacts/latest-runtime-check/latest-acl-repair-explicit-deny.json)误要求退出1，实际原逻辑将验证失败列为refused而退出2；原回滚已发生。修正断言后在新UUID目录重验完整规则/字节、失败grant和实际恢复通过，没有覆盖首轮失败。固定原资产SHA仍相同，变更一个字节的输入被`latest_acl_repair_unknown_source`拒绝；候选仅保存在项目产物，不修改31文件源码租约或自动生产启动。

原失败路径在两个真实手机入口的修复已验证。后续补齐的原生负例和人工操作入口见下节；31文件/355原资源最终恢复和原8项总标准保持，不发布完整新版支持声明。

### 原生拒绝边界与独立操作入口（2026-10-06）

[原生负例驱动](../../../plugin/scripts/verify-latest-acl-repair-refusals.ps1)实际创建排他UUID目录：当前用户和OWNER RIGHTS的ChangePermissions拒绝使原Win32检查返回WRITE_DAC=false；候选据此退出2，原日志没有备份/grant/移动/恢复权限尝试，实际文件/根描述符与BEFORE字节保持。随后测试真实Windows junction路径分量和AllowRoot本身，均实际拒绝、修改尝试0，目标及祖先描述符/字节保持。见[三项通过报告](../../../plugin/artifacts/latest-runtime-check/latest-acl-repair-native-refusals-delete-owned-fixture.json)。拒绝文件依靠未改变的DELETE权限移除，目录链接只移除链接，最后逐项删除空目录。

首次负例曾尝试从预先打开的WRITE_DAC句柄恢复测试ACL，Windows实际拒绝，见[原失败](../../../plugin/artifacts/latest-runtime-check/latest-acl-repair-native-refusals.json)。该次候选的拒绝本身已发生，但恢复失败不能记成通过；后续确认唯一BEFORE文件和UUID范围后，利用原DELETE权限移除专用对象，见[失败对象清理](../../../plugin/artifacts/latest-runtime-check/latest-acl-repair-native-refusals-failed-cleanup.json)，`restoredPermissions=false`保留事实。最终驱动不再使用这种无效恢复路径，换新UUID完成完整负例。

非本人所有先尝试在专用文件设置Administrators所有者，但当前普通令牌被Windows拒绝；[原失败](../../../plugin/artifacts/latest-runtime-check/latest-acl-repair-native-nonowner.json)保留，专用对象已恢复并清理，不伪造其他所有者。随后[现有文件只读负例](../../../plugin/scripts/verify-latest-acl-repair-existing-nonowner.ps1)使用已核对的MuMu公开许可证文件：实际所有者Administrators，当前用户不同且原Win32 WRITE_DAC=true，原候选明确以“不属于当前调用者”拒绝。文件及所有祖先的完整描述符与SHA保持，没有权限修改尝试，见[独立非所有者通过报告](../../../plugin/artifacts/latest-runtime-check/latest-acl-repair-existing-nonowner.json)。没有改软件安装、读取凭据或输出许可证正文。

已提供[独立人工工具说明](../../../plugin/compatibility/latest-upstream/acl-repair.md)及[CLI](../../../plugin/scripts/prepare-latest-acl-repair.mjs)。准备阶段先核对实际包名称、固定版本及原资产SHA，再生成项目内工具副本；不运行修复，不修改源码或原资产。实际源码和npm包经CLI生成同一已验收脚本SHA `e6389ffbdcbc6e3a50206c198ab8a348c9957681de231d1fb920aa50d6239ce0`；原资产哈希和31文件租约保持。

[入口测试](../../../plugin/tests/latest-acl-repair.test.mjs)最终实际结果10通过、1跳过：已覆盖两种真实包的CLI、无artifacts/源码产物的新克隆布局、幂等、未知包/版本/资产、冲突输出/目录/越界、拒绝回写实际包/参考源码、Windows junction输出和越出包的资产链接。文件符号链接创建被当前Windows令牌以EPERM拒绝，首次测试[失败摘要](../../../plugin/artifacts/latest-runtime-check/latest-acl-preparation-first-failure.json)保留；这一真实分支明确尚未实测，不能因测试退出0将其当作通过。所有测试副本和链接均已清理，没有启用额外权限。

工具及说明是独立候选交付，不包含在当前插件tgz，也不自动用于用户项目。手机原失败路径和限定原生权限布局已有实际证据；其他ACL布局、完整新版交付组合、31文件/355资源最终恢复及原8项总标准仍继续验收。

工具准备后再次核对原工作区：旧的`audit`命令因已有报告而拒绝覆盖，[拒绝摘要](../../../plugin/artifacts/latest-runtime-check/latest-acl-preparation-audit-existing-report-refusal.json)保留，未进入权限操作。验收器仅为audit增加独立名称，不允许repair/restore复用新名称；`audit acl-tool-entry`在同一正常Host18140实际通过，[新只读报告](../../../plugin/artifacts/latest-runtime-check/latest-live-original-files-audit-acl-tool-entry.json)确认Host/控制器仍存活、全部8对象的原权限和字节仍一致。没有为观测失败重启Host，也没有重复应用修复。
