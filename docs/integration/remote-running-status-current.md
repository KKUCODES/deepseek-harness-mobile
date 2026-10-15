# Remote 等待首段输出时的思考提示

2026-10-15，手机端维护者核验；任务 [KKC-57](https://linear.app/kkcodes/issue/KKC-57)。改动已随[公开preview.3](../releases.md#已核验范围)提交发布，下方保留本地候选记录。只修改 DSHM，不修改、重打包 DSH 本体、SDK、电脑插件或中转后端。

## 原因与接入

手机停止按钮已经出现，说明原会话 `running` 状态已同步。空白来自渲染遗漏：新版 DSH 的 `ChatFlow` 在消息列表之后单独挂载 `RunningStatus`；它不是聊天消息节点。DSHM 接入了原消息节点，但没有接入这个独立组件。

采用原组件接入，而不是重新维护一套手机时钟和动效。alpha.1/alpha.2 的派生别名导出只读参考源码中的 `RunningStatus`，由 `dshm.chat.running` 会话插槽挂到自有聊天正文尾部。原组件负责文字、每秒计时、鲸尾和文字扫光、辅助技术提示及减少动态效果。手机只补充位置、最低14px字号和旧WebView的颜色兼容。旧基线没有独立可导出的组件，回退为本地化活动文案，不伪造计时。

- 正式入口：[RemoteWorkspace](../../src/ui/RemoteWorkspace.jsx)中的正文，主聊天与旁栏聊天共用。
- 会话隔离：[插槽与SessionProvider](../../src/remote-plugin-slots.jsx)，只在原会话已打开、`running` 且通道连接时显示；旁栏使用自己的会话引用。
- 时间来源：[开放轮次起点](../../src/remote-running-status.mjs)取原 `timeline.turns` 中最近开放轮次的 `turn.start.time`。重入不会从手机挂载时刻重新计时；没有起点只显示活动文案。持续时间沿原组件按设备当前时间减原事件时间显示，不新增校时协议。
- 颜色：[宿主样式](../../src/ui/remote-product.css)在不支持 `color-mix` 的旧WebView中，以原主题的蓝色令牌回退。现代浏览器仍使用原深浅主题混色。

本机MuMu不支持原组件动画鲸尾所需的未前缀CSS mask能力，沿用上游静态鲸尾回退；这不影响活动文字和时长。浏览器已检查原文字动画实际挂载。没有改造插件内部界面或第三方缩放规则。

## 验收矩阵

| 入口/状态 | 验证与结果 |
| --- | --- |
| 原空白复现 | 协议回放中的真实页面：停止按钮可见、无助手输出、活动提示数量0；`artifacts/running-status-before.json`及截图 |
| 等待首段/缺失开轮记录 | 修复后即时显示活动文案；缺少边界不显示虚构时长 |
| 原开轮起点/持续计时 | 75秒前的原事件回放显示约1分15秒，后续每秒更新；2项纯函数用例覆盖关闭轮次、缺失和无效时间 |
| 首段/结束/停止/失败 | 原投影首段出现后仍仅一个活动提示；原结束、取消和失败事件撤下提示，草稿保持 |
| 断线/重连/切换 | 离线不保留旧运行提示，重连恢复；不串到其他会话 |
| embedded聊天分支 | 同一正式RemoteWorkspace以embedded入口挂载，等待提示只有一个，原结束事件撤下；实际子会话导航沿既有回归，本专项不冒充真实Android子任务运行 |
| 两种主题与尺寸 | 320/420px、深浅主题均14px、原动画存在、无页面横向溢出；减少动态效果仍有可访问状态文案 |
| MuMu真实运行 | 正常App读取用户已有“你是谁”会话，修复前没有提示；覆盖安装后恢复查看同一会话，原开轮起点保持，活动时长从12分52秒更新到12分53秒；`artifacts/remote-running-android-after.png` |
| MuMu自然结束 | 同一原会话自然结束后提示与停止按钮均消失；最终 `artifacts/remote-running-android-settled.json`通过，原空草稿哈希保持、无模型消息发送 |
| 旧WebView颜色 | 正常APK内临时DOM样式探针测得蓝色 `rgb(65, 118, 230)`、14px，随即移除；只证明样式回退，不冒充新的运行轮次 |

[浏览器专项](../../scripts/check-remote-running-status.mjs)经[正式插槽验证入口](../../scripts/verify-remote-plugin-slots.mjs)加载生产样式顺序；使用原会话状态与协议投影回放，不冒充真实模型调用。原APNG资源由隔离HTTP服务器按受限文件名提供。完整旧基线Remote页面回归、497项Node测试、官方alpha.2 Web构建、Android构建与lint通过。

真实Android驱动为[只读同一轮检查](../../scripts/verify-running-status-android.mjs)。没有发送新消息、停止用户任务、修改模型、申请新权限或更改绑定。安装重启后用正常 `model.select` 恢复之前查看的会话，不声称App自动恢复到了该聊天。等待截图实际为浅色；深色显示由浏览器回放验证，不把用户原截图当作修复后Android深色证据。

补测中的失败保留：第一轮安装后曾停在首页，驱动补上读取原sessionId并恢复查看；后来补采颜色时该轮已自然结束，旧“仍在运行”断言失败，因此新增独立 `--settled` 检查。后者没有重新发起模型轮次，也没有把结束状态改回运行。安装路径哈希守卫首次未接受Android的`~~`目录前缀，收窄修正字符集后重新核对通过。专项曾尝试从旧夹具的子会话菜单进入新版旁栏，但该夹具未提供对应清单响应，停在读取页；改用已有embedded挂载入口检查该正式渲染分支，不伪造原子任务协议。

## 当前本地候选

- APK：`artifacts/releases/DSHM-2026-10-15-running-status.apk`，13,486,919字节。
- SHA-256：`fbdc4b838e3a03fe36ac8cadc1b8c46a63315a36aa47fc0e6ae1f43ff6c5a5fe`。
- 正常包 `dev.dshmobile.validation.officialtest` 已覆盖安装，168份Web资源与构建目录一致，设备上已安装APK哈希相同。
- 原聊天和连接保留，Host未重启；该阶段仅本地验收，公开发行结果另见上方链接。
