# Remote 历史定位与发送状态修复

状态：rc.3 分支修复候选，用户已授权进入 preview.21/code31 发布流程；发行验收见[KKC-130](https://linear.app/kkcodes/issue/KKC-130)。维护角色：DSHM 手机端维护者。最近核验：2026-11-19。现场复验任务：[KKC-129](https://linear.app/kkcodes/issue/KKC-129)。

用户确认问题发生在 preview.20 Remote，手指向下滑动查看更早消息；另有切到其他 App 再回来后无法发送的偶发反馈，按钮颜色未知。

## 已确认的缺口与处理

1. 原 `loadEarlierHistory` 在请求开始时保存锚点，响应后连续三帧恢复它；虚拟列表同时维护自己的实时锚点。读者在等待期间继续滚动时，外层旧位置会覆盖新位置。旧代码回放出现 120px 回跳。当前将虚拟列表定位统一交给 `RemoteHistoryList`，非虚拟路径保持原行为。
2. 到达最早一页后，加载按钮消失使列表起点移动 60px。去掉外层恢复后，这个边界暴露出列表的旧 margin 问题。现在先更新列表起点，在补偿完成前不把中间布局当作新的阅读位置；末页回归偏差为 0。
3. rc.3 官方 `SubmitMachine` 新增 `sending`，原输入桥和按钮只识别 `adjudicating/submitting`。在挂起真实 Session.prompt 的回放中，普通通知能提前清除手机 pending/admission，使按钮恢复可点，但原状态机仍忽略重复提交。当前共享 `remoteInputFrozen`，输入桥、按钮及公开提交入口对齐官方冻结阶段，失败后保留草稿并允许重试。官方 frozen 函数未公开导出，手机边界保留同样的三阶段判断；旧版无 sending 时沿用原阶段。

比较过保留外层锚点并追加取消条件，以及由列表单独拥有定位；采用后者，避免两个恢复器竞争。发送保持官方冻结状态，不通过超时强制解锁或自动重发绕过原状态机。

源码入口：[历史调用边界](../../src/remote-history-position.mjs)、[虚拟列表](../../src/ui/RemoteHistoryList.jsx)、[输入绑定](../../src/remote-input-session.mjs)、[输入组件](../../src/ui/RemoteComposer.jsx)。上游 DSH 源码未修改，官方 Session、ScrollFollow、编辑器和提交机器继续使用。

## 验收矩阵

本轮只运行当前 DSH 0.2.2-rc.3，不启动旧版环境。

| 入口 | 已验证结果 |
| --- | --- |
| 主聊天，连续 24 批历史 | 数据保持连续，挂载组数有界，分页锚点偏差 0；草稿和会话引用保持 |
| 主聊天和旁栏，已载入历史连续 16 次往更早滚动 | 消息位置持续向更早推进，无固定位置回跳 |
| 主聊天，分页等待期间继续滚动 | 四种向更早、两种向较新滚动，响应前后偏差均 0 |
| 最后一页、失败重试 | 按钮消失后偏差 0；失败保留已读数据和草稿，可重试 |
| 列表重进、重连、实时追加、回到底部 | 阅读锚点、草稿、官方跟随控制器与插件入口保留 |
| 原 Session.prompt + 输入桥 + 公开通知/提交入口 | sending 期间普通通知不解锁、不重复提交；失败保草稿，可重试 |
| MuMu 现有 rc.3 验收包，真实电脑连接 | 同包覆盖成功、原配对保留；带草稿切出/切回 6 次正常，随后发送成功并收到新 OK 回复 |

浏览器回放使用真实 RemoteWorkspace、官方 Session/提交机器和隔离的合成传输，不代表用户那条真实长会话。MuMu 实测使用真实 DSH/中转，未清数据或新增 App 包名；正式 officialtest 的原电脑离线，未替换它的配对。

验证命令：

```sh
node --test tests/*.test.mjs
node scripts/verify-preview15-history.mjs --rc3
node scripts/verify-preview15-history.mjs --rc3 --aside-history
node scripts/verify-preview15-history.mjs --rc3 --terminal
node scripts/verify-preview15-history.mjs --rc3 --recent-chat
node scripts/verify-preview15-history.mjs --rc3 --scroll-bottom
node scripts/verify-preview15-history.mjs --rc3 --sending-state
node scripts/build-web.mjs --latest-candidate --official-candidate --official-rc3 --ci-candidate
```

588 项 Node 测试和以上页面专项通过。当前 CI rc.3 SDK 页面构建、Android debug 构建和覆盖安装通过。未选择 CI SDK 的本机旧隔离 SDK 缺少 file-drag，不能用于本轮打包；未为此修改 SDK 或上游。页面构建仍有原翻译重复键警告。

回归入口：[持续滚动与分页竞争](../../scripts/check-remote-reading-race.mjs)、[原提交阶段回归](../../scripts/check-remote-sending-state.mjs)。本地详细记录在 `artifacts/tests/preview15-history/0.2.2-rc.3-candidate-*`、`artifacts/rc3/remote-resume-send-129.json` 与同名截图。

## 尚未确认的现场范围

MuMu 的短时前后台切换没有复现用户完整的偶发失效，不能据此认定 sending 缺口就是唯一原因。用户实际长会话的特定回跳也未直接取得；当前已复现并修复上述竞争与末页位移，并覆盖用户确认的滚动方向。后续需要用户在修复候选复验；如果仍失效，记录按钮是否变灰、是否点亮但不响应、当时连接与原提交阶段，再继续定位，不添加无依据的强制解锁。

长历史仍保留官方 Session 的连续数据，只对 DOM 虚拟化；读取总数据的内存随历史增加，不宣称有界数据缓存。
