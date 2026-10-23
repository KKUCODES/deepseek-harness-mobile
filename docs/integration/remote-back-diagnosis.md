# Remote 项目聊天系统返回失效排查

- 状态：本地修复和返回专项回归完成，已随preview.9/code11公开预发布；[云端签名与APK匿名下载核验](../releases.md#已核验范围)通过。下方保留修复前诊断。[发行任务](https://linear.app/kkcodes/issue/KKC-80)。
- 维护角色：DSHM 手机端维护者；最近核验：2026-10-24。
- 用户反馈版本：preview.7；[任务 KKC-79](https://linear.app/kkcodes/issue/KKC-79)。

## 已确认原因

`src/ui/RemoteWorkspace.jsx` 的系统返回 effect 使用 `act`，但依赖数组没有包含它。`act` 根据 `busy` 更新，系统返回回调却可能保留进入聊天期间 `busy=true` 的旧函数。

实际入口是点击会话列表：点击先经 `act` 标记忙碌，`model.select` 改变选中会话并安装返回回调，读取完成后解除忙碌，但返回 effect 不会随之更新。随后系统返回被报告为已处理，旧 `act` 却直接退出，没有调用 `model.back()`。左上角箭头使用当前渲染的 `act`，所以可以正常返回。

修复前 `git diff v0.1.0-preview.7 590b013 -- src/ui/RemoteWorkspace.jsx` 无差异；`590b013` 为 preview.8 后文档提交，这两个版本都有该实现。此复现不依赖 DSH、中转服务、键盘或第三方插件。

## 验证范围

| 路径 | 实际检查 | 结果 |
| --- | --- | --- |
| 实际 RemoteWorkspace + RemoteModel，合成会话，点击真实会话列表按钮 | 三次进入后调用系统使用的 `window.dshmHandleBack()`；无弹窗、无插件返回处理，箭头已可用 | 三次均返回 true，选中会话不变，`model.back` 调用数不增加 |
| 同一页面、同一次进入后的左上角箭头 | 三次点击 | 三次均调用 `model.back` 并退出聊天 |
| 对照：直接调用 fixture 的 model.select | 绕过列表的 `act` | 两种返回均正常，不能替代真实点击入口验收 |
| MuMu Android 12/API32 原生返回 | 独立未配对诊断 App，运行时替换页面 handler 为计数器，ADB 返回键 | 原生事件到达 JS 一次 |
| 独立 Android 16/API36 原生返回 | 同类计数器，分别 ADB 返回键和屏幕边缘滑动手势 | 两种输入分别到达 JS 一次 |

浏览器复现使用当前正式组件、官方 rc.2 SDK 与现有合成 transport fixture；没有调用真实模型或读取用户聊天。原生检查仅证明所测设备能将事件交给页面，不等同于已在真实配对的项目聊天上完成整条手势复现，也不覆盖所有 Android/OEM。反馈用户的 Android 版本和键盘状态仍未知。

原先直接选择 fixture 会话的测试绕过了列表动作的忙碌状态，因此没有暴露此问题。后续回归应从点击项目/会话列表开始，而非只调用 model.select。

本地证据：`artifacts/back-diagnosis/browser.mjs`、`browser.json`、`browser.log`、`native.mjs`、`native.json`、`native.log`，均为忽略的诊断产物。三轮浏览器复现无页面异常。独立模拟器已卸载诊断 App 并退出；MuMu 已结束临时诊断进程并返回原用户 App，未清数据。

## 修复方案与当前验证

在 [RemoteWorkspace](../../src/ui/RemoteWorkspace.jsx) 的系统返回 effect 补齐 `act` 依赖：选择会话的忙碌期结束后更新回调，沿用当前动作保护。相比新增稳定回调和最新状态引用，补齐依赖不引入新的状态维护，改动范围更小。原生 Android 返回实现及弹窗、插件设置、全局页面、侧栏面板、文件/命令/输出窗口、聊天、工作区的分层顺序保持。

[专项检查](../../scripts/check-remote-back-navigation.mjs)接入[现有浏览器回放入口](../../scripts/verify-remote-plugin-slots.mjs)，使用现有 `holdSelection` 暂缓选择完成。原实现先在读取结束后的返回断言失败；修复后通过：

| 入口与状态 | 已验证结果 |
| --- | --- |
| 列表点击进入，读取尚未结束 | 保留忙碌保护，不提前退出聊天 |
| 读取完成后系统返回 | 退出聊天，不再被旧忙碌状态拦截 |
| 连续列表点击进入，系统返回/箭头各三次 | 均正常返回 |
| 项目列表→会话→返回→再次进入 | 返回原项目列表，草稿保留；再返回可退出项目，根列表交还原生 |
| 自有弹窗；插件菜单→插件弹窗→插件面板 | 每次只关闭当前上层，不越级退出聊天 |
| 全局插件页面覆盖侧栏；插件设置页 | 全局页面先关闭、下层侧栏保留；插件设置先于聊天关闭 |

执行命令：

```powershell
node scripts/verify-remote-plugin-slots.mjs --back-navigation
node scripts/verify-remote-plugin-slots.mjs --back-navigation --official-alpha2
node --test tests/*.test.mjs
node scripts/build-web.mjs --latest-candidate --official-candidate --official-rc21
```

rc.2 和 alpha.2 专项通过，无页面错误；540 项 Node 测试和官方 rc.2 手机页面构建通过。回放项目数据直接送入真实工作区 model 的 baseline，测试关注导航和生命周期，不将其描述为已验证电脑工作区推送协议。

Android 16/API36 独立模拟器、手势导航模式2：在无配对的 `.rc21test` 原生 RemoteActivity 注入当前 rc.2 组件回放包，保留原生返回实现。点击真实列表进入后，ADB 返回键和屏幕边缘手势均退出聊天；自有弹窗、插件菜单、原插件弹窗、插件面板再到聊天逐层返回通过。只在诊断页面暂时绕过 CSP 以加载本地回放脚本，不修改产品安全策略。此检查不等于真实配对聊天或物理手机验收；当时未生成或安装含修复的新APK。后续preview.9由Actions构建、签名并公开发布，本轮仅核验下载包身份与签名，未覆盖用户模拟器App。

证据为 `artifacts/remote-back-navigation-0.2.1-rc.2.json`、`artifacts/remote-back-navigation-0.2.1-alpha.2.json`、`artifacts/back-diagnosis/regression-before.log`、`regression-final.log`、`node-tests.log`、`web-build.log`、`native-after.json`、`native-after-final.log`。原生报告包含所注入包的摘要。

额外的旧基线 `--motion` 检查在连续六次切换全屏后，偶发报 `transformOrigin: 'left top' !== ''`。恢复原返回代码对照时也得到一次通过、一次同点失败，故不能将此专项计为稳定通过；原有动效问题未混入本次修复。相关日志为 `motion-after.log`、`motion-after-retry.log`、`motion-baseline.log`、`motion-baseline-repeat.log`。返回专项本身通过，不依赖该全屏动画检查。
