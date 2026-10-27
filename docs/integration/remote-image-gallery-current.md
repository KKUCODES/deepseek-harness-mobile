# Remote 原聊天图片画廊与局部恢复

- 状态：本地实现，未提交、推送或发行。维护：手机端维护者；核验：2026-10-27；[KKC-120](https://linear.app/kkcodes/issue/KKC-120)。
- 原因与修复前证据见[含图空白诊断](./remote-image-blank-diagnosis.md)。没有修改DSH、电脑插件、中转或旧适配分支；此前未提交的UI工作保留。

## 实现与边界

[RemoteImages](../../src/ui/RemoteImages.jsx)直接导入同一SDK的原`ui-attachment/src/MessageImage.tsx`中的`ImageGallery`及原`messageImageLabels`、conversation字典，不再把文档`ImageBody`用作聊天缩略图。缩略图尺寸、相册布局、原图portal和关闭/焦点恢复仍由原组件实现。

[RemoteFiles](../../src/ui/RemoteMessage.jsx)将相邻图片合为画廊，用户、助手和默认工具结果使用同一入口。与原DSH的UserContent一致，`file`附件保留文件卡及文件授权，点击后查看；不能仅因扩展名为PNG就将file伪装为image附件读取。旧文件预览的字节图片也通过原图库打开原图，正式文档面板继续走完整原文档宿主。

[插件插槽](../../src/remote-plugin-slots.jsx)同时声明、接通旧`conversation.message.images`和新`conversation.chat.user.images` / `conversation.chat.message.images`。优先领域席位、无条目时回退旧席位，再使用原画廊；默认图片不绕开第三方图片呈现。第三方及原附件插件均经真实插槽测试，rc.2原内容工厂`conversation.images.content`也实际加载验证。保护层仍走既有MobilePluginFrame布局和用户自适应开关，不按插件名称分支。

`RemoteImageBoundary`放在共用聊天节点内部，并保护每次图片插件呈现。渲染异常和图片解码错误只撤下图片，保留正文与重试；没有改变原SlotCore本体或其通用退让规则。读取失败继续使用原画廊自己的加载/重试状态。日志仅记录异常类别，不输出正文、图片或附件身份。

[RemotePluginImageUrls](../../src/remote-images.mjs)继续使用既有会话授权、64MiB额度和最多两张并发读取，完成完整字节验证后才发布Blob URL。原`load/peek`合同保留；手机额外提供按指定失败URL清除缓存的`forget`，同图多处重试不会取消另一处新读取；释放会话、失败或取消后的迟到数据不会生成新URL。原附件不可变，缓存不跨会话共享。

[返回接线](../../src/remote-modals.mjs)只把可见portal模态层的返回映射为原组件Escape合同。[Android RemoteActivity](../../android/app/src/main/java/dev/dshmobile/validation/RemoteActivity.kt)也接通该合同，避免原生返回先退出底层聊天。事件从portal冒泡到document和window，兼容原图库与公共Modal各自的监听位置；菜单先关闭，原设置、全局面板、旁栏的返回顺序保留。没有修改原ImageLightbox或复制另一套原图窗口。

## 回归证据

修复前新增真实Workspace回归在首张成功图片处超时，与诊断中的`useTabInfo`异常及整段空白一致；没有仅靠占位或浅层组件测试宣布修复。

| 验收项 | rc.2 / alpha.2 |
| --- | --- |
| 原Session快照、实时接收、双图用户消息与助手图片、重新进入 | Edge与MuMu隔离WebView通过 |
| 原图窗口、关闭按钮、系统返回保留当前聊天 | Edge与MuMu隔离WebView通过 |
| 附件读取失败、PNG解码失败、显式重试 | 正文保留并恢复图片，两环境通过 |
| 原画廊同步呈现异常、第三方图库异常 | 局部错误及重试，未撤下dshm.chat.node，两环境通过 |
| 原附件插件、新/旧第三方图片席位 | 实际启用/停用后恢复原画廊，两环境通过 |
| 工具图片、其他聊天仍可打开、真实旁栏会话、文件身份和旧图片文件预览 | 两环境通过 |
| 缓存清除/URL回收/迟到读取/并发额度 | Node测试通过 |

运行入口：

```text
node --test tests/*.test.mjs
node scripts/verify-preview15-history.mjs --images
node scripts/verify-preview15-history.mjs --images --alpha2
node scripts/verify-remote-images-android.mjs
node scripts/verify-remote-images-android.mjs --alpha2
node scripts/verify-remote-images-android.mjs --navigation
node scripts/verify-preview15-history.mjs --navigation
node scripts/verify-preview15-history.mjs --terminal
```

主要回归：[真实入口检查](../../scripts/check-remote-images.mjs)、[隔离图片协议](../../tests/fixtures/remote-image-chat.jsx)、[缓存测试](../../tests/remote-images.test.mjs)。图片由测试画布产生，不包含用户海报或原聊天内容。Android回归使用独立调试UID，不读取正式包Key；经普通聊天抽屉实际进入RemoteActivity，再运行测试并注入真实Android返回键。没有放宽Remote CSP，测试夹具使用页面既有允许的Function执行离线内存产物。未启用图片夹具时不替换其他回归的传输或错误采集。

578项Node测试通过；两SDK图片专项、rc.2连续历史及导航回归通过。实际RemoteActivity导航另外验证菜单/弹窗/插件设置/旁栏返回优先级及草稿保持。网页构建、Android release构建及lint通过。

图片专项在减少动画环境执行，以隔离已确认但本次未修复的[FlowMotion合同问题](./remote-reasoning-diagnosis.md)。不能将专项通过理解为思考动画故障也已修复。原正式含图会话的重开和原图查看另外实际验证，未向模型发送新消息；实时、多图及异常分支使用隔离协议，不能冒称正式配对全场景验收。

构建曾因PowerShell未引用Gradle参数、JVM UDP绑定失败而中断；引用参数并在本次进程使用IPv4选项后恢复。未修改系统网络配置或DSH。README已核对，本次为现有图片能力修复，没有新增公开使用步骤或扩大承诺。

## MuMu正式包验收

原签名覆盖安装`dev.dshmobile.validation.officialtest`，版本`0.1.0-preview.15`、code25；保留聊天、Key、配对和插件状态。安装包`artifacts/DSHM-preview15-images.apk`，SHA256为`5d3e8424077cbad30e4ebfd0679d400902a01065c81d89cab80369d88a2adcec`，已安装base.apk哈希一致；211个网页资源逐文件核对与构建产物一致，签名证书与此前包一致。

通过实际电脑连接重新打开「DSHM 真实 DeepSeek 长聊天测试」中的「这个是什么」，原海报和原回答同时显示；点击原图、注入Android返回键后原图关闭，仍留在同一聊天且正文可读。截图和安装核对报告留在忽略的`artifacts/image-fix-real-image.png`、`artifacts/image-fix-installed.json`。没有发送新消息、改变模型设置或操作审批。MuMu最终停留在该会话，未提交、推送或发布。
