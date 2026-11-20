# Remote 首页会话排序、相对时间与草稿会话

- 状态：已在 `feat/remote-home-activity-order` 提交，待合并、未发行；本轮只改 `app` 仓库，DSH、电脑插件与中转未修改。维护：手机端维护者；核验：2026-11-20。
- 用户验收项：电脑端按时间实时排序、相对时间实时变化、空白草稿会话保留并置顶。

## 问题与原因

电脑端的项目文件夹分组里，会话按更新时间倒序显示；选中第 5 条发消息后，该会话会立即排到该分组第一。手机端不做这件事：首页行直接沿用会话列表快照的 `ids` 顺序。

该顺序只在建连时确定一次：电脑返回的 `session/list` 按 `updatedAt` 排序，之后客户端对 `api-session/activity` 只更新 `updatedAt`、不重排数组（`applyMutation` 的 `activity` 分支明确不产生展示顺序），刷新时 `mergeOrderedBaseline` 又刻意保留既有相对顺序。因此手机端在进程存活期间不会因为发消息而移动任何一行，只有重启 App 才会重新取一次初始顺序；点“刷新会话”也不重排。

相对时间的失效是另一处：[RemoteWorkspace](../../src/ui/RemoteWorkspace.jsx) 原来的时钟只在“工作区展开”开启、且未进入任何会话、未筛选任何工作区时启动，间隔 30 秒。进入某个项目文件夹后时钟直接停止，从聊天返回或刚进入列表也不会立即重算，所以那一页的时间会冻结。

草稿会话的问题：首页过滤掉全部空白会话，写了一半的新聊天退出后从列表消失；再点“新建会话”会新建另一个空会话，之前那条草稿既看不到也回不去。

参考对照：电脑端默认排序方式为“按更新时间”，在每个工作区分组渲染前按 `updatedAt` 倒序重排（`ui-workspace` 的 `orderByRecency` 与 `orderBy: 'updated'` 默认值），这正是手机端缺失的一层。

## 实现

1. [orderChatsByActivity](../../src/remote-home-workspaces.mjs) 按 `updatedAt` 倒序排列会话，时间相同按标识升序保证稳定，空白会话固定在最前；不修改传入数组。
2. [homeChatRows](../../src/remote-home-workspaces.mjs) 统一负责首页行投影：归档、工作区筛选、搜索命中过滤之后排序，并把“草稿有文字或附件”的空白会话一并纳入；搜索视图与归档视图不展示空白会话。
3. [draftChatTitle](../../src/remote-home-workspaces.mjs) 取草稿第一个非空行作为行标题（超过 40 字截断），只有附件时用第一个附件名，都没有时用“新聊天”。
4. [RemoteWorkspace](../../src/ui/RemoteWorkspace.jsx) 的“新建聊天”按钮：存在带内容的空白会话时直接进入它，否则沿用原来的选择工作区或新建流程，不再产生被草稿掩盖的新空会话。
5. 相对时间改为：进入列表（退出会话、切换工作区筛选、关闭弹层、组件挂载）、切回前台（`visibilitychange`）立即重算一次，之后每 60 秒一次；进入聊天时停止计时。时钟只重算展示用时间，不发起任何请求，排序与文案都在这同一次渲染里更新。
6. [restoreDrafts](../../src/remote-model.mjs) 让首页在列出空白会话前读取本机草稿库，App 重启后带草稿的空白会话仍会出现，而不是只在本次输入过的草稿可见。
7. 分组的展开与收起仍完全由用户偏好决定：草稿行位于所属工作区分组最前，分组收起时同样收起。

首页会话行契约（`view.sessions`、`view.workspaceGroups`）只增加了 `draft` 标记，标题与时间仍由宿主投影提供，因此预装的“Remote 新版首页”插件无需改动即可显示草稿行；平铺的“最近会话”列表保持显示日期，不改为相对时间。

## 验证

| 项 | 结果 |
| --- | --- |
| `node --test tests/remote-home-workspaces.test.mjs` | 14 项通过（活动倒序、同时间兜底、排序后再取最近 5 条、草稿行纳入与过滤、标题规则、相对时间分档） |
| `npm run build:web:ci` | 通过；仅既有 `已是最新版本` 重复键告警 |
| `npm test` | 495 项中 484 通过 / 11 失败；失败项与同时刻 `main` 基线完全一致，均为本机 `../deepseek-harness` 目录联接指向 `artifacts/ci/official-source-alpha2`，其文档预览组件上游文本与用例期望版本不符（`Document source changed: office/OfficeBody.tsx`） |
| 真机 / MuMu | 未执行，待用户验收 |

验证环境说明：为了让上述构建与用例在本机运行，工作区根目录建立了两个不属于任何仓库的目录联接（`deepseek-harness` → `app/artifacts/ci/official-source-alpha2`、`backend/packages/protocol/node_modules/zod` → `app/node_modules/zod`）。

## 边界与未做

- 手机上固定为“按更新时间”排序，不提供电脑端那样的“手动拖动/置顶”入口。
- 相对时间降到每分钟一次刷新，因此“N 秒”文案只会在定时点恰好落在中间时出现，多数时候是“刚刚 → 分钟”。
- 搜索结果的顺序仍由电脑返回的内容命中顺序加本地标题命中组成，本地命中同样按最近活动排列。
- 电脑端当前空白会话即使没有内容也会显示；手机端只显示有草稿内容的空白会话，避免长期积累空会话。
