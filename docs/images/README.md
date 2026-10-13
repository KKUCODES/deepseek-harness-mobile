# README 图片说明

[返回项目首页](../../README.md)

由 DSHM 手机端维护者维护，最近核对日期：2026-10-10。首页横幅是角色插画，下面三张图是实际 Android 界面，两者用途分开。

## 项目 Logo

[logo.png](./logo.png) 使用 2026-10-13 用户确认的第四版标志，保留完整 DeepSeek 鲸鱼和手机、电脑双向连接，已用于 README 标题与 Android 启动图标。当前 PNG 为 1254 × 1254、带透明背景，README 以 128 像素展示；与插件和后端仓库的同名副本逐字节一致。

设计过程和完整生成提示词见[品牌素材](./brand/README.md)。Logo 用于识别项目，角色横幅和真实截图继续展示用途；以下截图与横幅保持原来源和核验范围，不表示 DeepSeek 官方出品或背书。

## 日常使用截图

重新准备“整理书桌、个人网站、读书笔记、周报”的演示内容，通过真实模型请求和 Remote 操作后，在 MuMu 中截图。没有裁剪、重绘、替换文字或伪造软件界面。

| 图片 | 展示内容 | 拍摄环境 |
| --- | --- | --- |
| [ordinary-chat.png](./ordinary-chat.png) | 用三个简单步骤整理书桌，展示真实回复与收起的输入框。 | 现有 Android App，客户端 SDK `0.2.1-alpha.1`；手机直连 DeepSeek Flash。 |
| [remote-sessions.png](./remote-sessions.png) | 三个电脑项目及其最近会话。 | 配套 Android 候选、官方 DSH `0.2.1-alpha.2`、插件 `0.1.80-latest.0`。 |
| [remote-approval.png](./remote-approval.png) | 等待审批时查看 `index.html` 的实际链接文案修改。 | 同一 Remote 环境，通过“工具详情”打开；截图后完成单次审批。 |

三张图均为 786 × 1624，合计约 239 KiB。可见内容没有 Key、登录令牌、一次性配对链接、测试编号或私人聊天。截图用于展示操作，不代替完整兼容验收；普通聊天与 Remote 的 App 版本分别注明。

Remote 使用独立 DSH 数据目录和演示工作区。普通聊天只新增演示会话，拍摄后定向移除；用户原有历史、凭据和绑定不作为展示内容。原始截图及文件校验信息留在本机忽略目录 `artifacts/readme-daily-demo-1791621209550/`，文档分发使用本目录的 PNG。

## 角色横幅

[hero.png](./hero.png) 根据用户提供的蓝发鲸尾角色三视图生成，保留发色、头饰、服装与鲸尾，改为拿手机挥手、与电脑连接的场景。插画尺寸 1983 × 793，约 1.63 MiB，仅作装饰，不表示软件界面或官方背书。

使用内置 `imagegen` 编辑模式，以三视图为参考图，无需配置额外 API Key。

<details>
<summary>生成提示词</summary>

```text
Create a polished wide horizontal README hero illustration for DSHM, a mobile chat client connected to the user's computer. Use the supplied three-view character sheet as a strict character identity reference, not as an output sheet. Preserve the chibi character's blue hair with curled top tuft, blue eyes, blue whale tail, navy blue and white frilly dress, bow and headband; fully clothed, charming friendly expression. A new lively pose: on the right, she holds a smartphone comfortably and waves hello, while a small neat laptop sits nearby linked to the phone by an understated blue dotted curve, evoking continuing computer work away from the desk. No actual app screenshots, no fake UI, only a few tiny abstract chat-bubble motifs. High quality clean anime illustration, crisp edges, coherent hands and clothing, soft lighting. A restrained white and very pale blue backdrop that blends into a GitHub README, deep blue accent palette drawn from the reference. Wide 5:2 composition, generous whitespace on the left for crisp readable text, character occupies right third, tasteful and warm, not a crowded advertisement. Text rendered exactly, no extra labels: large dark-navy 'DSHM', underneath smaller simplified Chinese '离开电脑后，继续推进电脑上的工作。'. Modern plain typography, the Chinese sentence should be easily readable at a 900px display width. No badges, no version text, no 'official', no official endorsement or DeepSeek company claim, no watermarks. Output a single finished wide banner, not multiple variants.
```

</details>

## 更新约定

软件截图使用真实界面，先准备自然的演示内容，再核对版本与可见信息。替换图片时同步本页来源说明。角色插画与软件截图分开维护，首页保持简短，图片可点击查看原尺寸。
