# Remote 浅色与圆按钮图标诊断

后续修复与验收见[当前主题实现](./remote-theme-current.md)。下文保留修复前的原因与探测证据。

- 状态：原因已验证；产品修复尚未实施。
- 维护角色：手机端维护者。
- 最近核验：2026-10-26。
- 任务：[KKC-104](https://linear.app/kkcodes/issue/KKC-104)。

## 结论

手机的浅色设置没有丢失。真实 MuMu 连接中，原生 `appearance.read` 返回 `preference: light`，Remote 的 html 为 `data-ds-theme-source=light`、`colorScheme=light`，body 没有 `data-ds-dark-theme`。电脑上的强度皮肤通过全局 `--dsw-alias-*` 色板覆盖页面颜色，产生深色背景及浅色文字。

首页插件背景/文字读取公共色板，圆按钮底色却由 body 的暗色标记切换固定值。上述组合使按钮保持浅色底，图标继承皮肤的浅色前景，几乎没有对比度。这不是屏幕宽度或安装器丢失代码。

拆分另有资产回归：独立首页的 `Icon` 使用手写 SVG 路径，未沿用原页面的 Figma SVG。此前运行管理验收不能证明其视觉保真；现有主题测试也漏掉了“手机明确浅色、电脑皮肤提供深色色板”的组合。

## 真实入口与单变量验证

入口为 MuMu 中原签名 App → Remote → 原电脑连接 → 外部安装的首页插件 0.2.0。没有修改 Key、配对、主题偏好或插件启停，没有调用模型。

| 条件 | 页面背景 | 文字 | 圆按钮背景 |
| --- | --- | --- | --- |
| 原始浅色偏好，电脑皮肤生效 | rgba(30,27,25,0.94) | rgb(244,241,232) | rgb(238,241,247) |
| 仅临时设置 body 暗色标记 | 同上 | 同上 | rgb(39,43,53) |
| 仅临时停用注入公共色板的皮肤样式表 | rgb(255,255,255) | rgb(15,17,21) | rgb(238,241,247) |

每次探测等待 350ms 让已有颜色过渡结束，再采样计算样式。所有临时 DOM/样式表更改均在 finally 中恢复，并复查回到原始数值。结束覆盖安装同原签名的非调试候选 code20，未卸载应用；公开 release 元数据未修改。后续公开 APK 版本码需高于本地20。

本次只进行诊断，没有新增功能测试或修改产品代码，没有修改 DSH 或混入旧插件适配分支。未验证真实手机及其他电脑主题组合。

## 通用修复方向（待实施）

1. 明确手机外观偏好与电脑皮肤对手机壳层、聊天区域的作用范围和优先级，通过公共主题契约处理，不按单个皮肤包名特判。
2. 同一控件的背景、前景、边框从一致的语义色板获取；不能用一个主题信号选背景、另一个信号选前景。
3. 独立插件携带原 Figma SVG 文件，复用资产而非手画近似路径，保持公开首页 API 边界。
4. 回归覆盖浅色/深色/跟随系统、电脑主题覆盖、插件启停及默认首页回退；从真实 Remote 入口验证计算样式与截图。

## 事实来源

- [首页样式](../../packages/remote-home-design/styles.mjs)、[独立首页图标](../../packages/remote-home-design/index.jsx)。
- [手机外观同步](../../src/phone-appearance.mjs)、[Remote 入口](../../src/RemoteApp.jsx)。
- [原 Figma 图标组件](../../src/ui/system/Icons.jsx)、[资产来源](../../src/ui/assets/remote/README.md)。
- [现有首页验收](../../scripts/verify-mobile-interface.mjs)。
- [Figma 原稿](https://www.figma.com/design/4O2ww8JdFAYnZRLVo7on83/DSHM?node-id=21-2277)：用户提供的15:3是画布，实际首页为21:2277，已读取设计上下文和截图。
- 本地忽略的诊断证据：`artifacts/tests/remote-theme/diagnosis.json`、`before.png`、`figma-overview.png`；签名恢复产物 `DSHM-diagnosis-restored.apk`。
