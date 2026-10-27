# Remote 首页界面插件 API v1

状态：首页接口已公开，连接页扩展为preview.15本地候选，尚未发行；维护：DSHM 手机端维护者；核验日期：2026-10-27。来源：[本地页面宿主](../../src/remote-interface-host.jsx)、[加载器](../../src/mobile-interface-plugins.mjs)、[首页投影](../../src/ui/RemoteWorkspace.jsx)、[独立样例](../../packages/remote-home-design/index.jsx)。从[开发指南](./development.md)开始，连接页见[当前验收](../integration/remote-connection-plugin-current.md)，预装与外部安装分别见原专题。

## 加载和声明

界面模块使用现有 Cordis 生命周期、公开 `slots` 服务。v1 提供根作用域单选槽 `dshm.remote.home`；preview.15 本地候选新增可选 `dshm.remote.connection`。两处由同一个本地运行实例提供，连接前即可加载，不依赖电脑 SDK/RemoteModel。页面槽按手机实际宽度承载，不使用桌面局部组件的等比缩放。已发布 preview.14 仍只有首页槽。

```jsx
import React from 'react';
export const name = '@example/mobile-home';
export const inject = ['slots'];
export const mobileInterface = { apiVersion: 1, surface: 'dshm.remote.home' };
export function apply(ctx) {
  ctx.slots.register({ name: mobileInterface.surface }, Home);
}
function Home({ home }) {
  return <section>
    <button onClick={home.actions.menu}>{home.t('Remote 选项')}</button>
    {home.view.sessions.map(item => <button key={item.id}
      disabled={home.view.busy || home.view.connection !== 'connected'}
      onClick={() => home.actions.session(item.id)}>{item.title}</button>)}
  </section>;
}
```

作者在 `package.json` 声明 `name/version/description/dshm.entry/dshm.displayName/dshm.interfaceApi/dshm.surface`，由[SDK](../../packages/plugin-sdk/README.md)编译为完整 `.dshm-plugin` 文件；无需编辑宿主目录或新增包名判断。原生文件安装器登记包后，[统一管理器](../../src/phone-plugins.mjs)动态发现目录，由Remote宿主激活。[界面加载器](../../src/mobile-interface-plugins.mjs)校验API主版本/目标槽和模块名，使用 `ctx.plugin(module)` 激活，释放fiber时回收注册，不保存另一份选择。卸载、停用、模块或渲染失败时使用默认首页；异步加载、激活和释放各有8秒上限，不阻塞核心连接。失败后显式重试，不自动循环加载。

新版首页以完整`.dshm-plugin`包预装到APK资产，也可独立从文件安装更新；两种来源都通过同一安装器写入私有副本，再由同一加载器读取内容摘要地址。首页源码不直接导入宿主JS。预装规则见[预装专题](../integration/preinstalled-phone-plugins-current.md)。不接受来自配对链接、聊天正文或网络参数的脚本地址。当前没有 npm 下载、依赖解析、在线市场或自动升级能力，也未合入之前独立适配分支。插件与宿主共享运行环境，接口限制不是 JavaScript 安全沙箱；安装器检查摘要不代表作者认证。

## owner props

### 可选连接页（preview.15 本地候选）

包格式和`mobileInterface.surface`保持`dshm.remote.home`，作为既有界面选择组，不改变安装器协议。同一模块用可选注入注册连接页，旧宿主没有该槽时仍能运行首页；旧首页包在新宿主也继续可用，连接页回退默认视图。

```jsx
export function apply(ctx) {
  ctx.slots.register({ name: 'dshm.remote.home' }, Home);
  ctx.slots.inject('dshm.remote.connection', () =>
    ctx.slots.register({ name: 'dshm.remote.connection' }, Connection));
}
function Connection({ connection: { view, actions, parts, t } }) {
  return <section>
    <button onClick={actions.back}>{t('返回普通聊天')}</button>
    <h1>{view.title}</h1><p>{view.description}</p>
    {view.unpaired ? parts.fields : parts.identity}
    {parts.diagnostics}
    {view.readError && <button onClick={actions.retryRead}>{t('重试读取')}</button>}
    <button disabled={view.actionDisabled} onClick={actions.primary}>{view.actionLabel}</button>
  </section>;
}
```

连接页owner仅含`{ connection }`。其`apiVersion/locale/t`与首页一致；`view`包括`phase/status/paired/unpaired/pending/waiting/connecting/reading/readError/busy`、已翻译的`title/description/error/actionLabel`、`server/insecure/actionDisabled`。`paired:null`表示本机连接信息尚未读出，`phase:ready`时该页不挂载。

`actions`只有`back/menu/scanCamera/scanImage/primary/retry/retryRead`，由宿主检查状态并执行。`parts.fields/identity/diagnostics`是宿主持有的React节点，放在对应区域即可；不得剖析节点实现或移除必要的配对/诊断入口。`[data-connection-fields]`及`[data-connection-field="link"|"name"]`是表单样式钩子，插件样式须限定自身根。配对链接、Key、设备凭据和原生桥不在公开view/actions中；界面切换不清空表单控制器。

停用、卸载、模块加载或任一页面渲染失败会释放同一界面模块，两页各自回退默认视图；没有注册某个可选槽时仅该页使用默认视图。重连、进入聊天不会重启界面模块。API限制不是JS安全沙箱，仍只安装可信插件。

### 首页

组件只收到 `{ home }`，包含 `apiVersion: 1`、`locale`、`t(text, values?)`、`view`、`actions`。无需获取 `RemoteModel`、原生桥、任意 RPC 或桌面 DOM。

| view 字段 | 含义 |
| --- | --- |
| `key / scrollTop` | 当前项目/归档/搜索组合的阅读标识与最近位置；宿主有界保存最多32组 |
| `title / workspace / query / archived` | 当前导航与过滤状态 |
| `ready / busy / connection` | 真实数据、操作和连接状态；断线不卸载界面插件 |
| `workspaces` | `{ id, title }[]`，电脑当前工作区的只读展示投影 |
| `sessions` | `{ id, title, running, updatedAt, snippet? }[]`，经过权限与过滤后的现有会话列表 |
| `searching / searchError / hasMore` | 宿主统一搜索状态；错误为可翻译提示，重试仍由宿主执行 |

| actions 方法 | 行为 |
| --- | --- |
| `back()` | 返回上一级项目或普通聊天；系统返回仍由宿主管理优先级 |
| `menu()` | 打开宿主 Remote 选项；界面插件统一在手机插件页管理 |
| `connection()` | 打开宿主电脑连接入口 |
| `workspace(id)` | 打开当前目录中的工作区 |
| `session(id)` | 经现有忙碌/连接检查打开当前列表会话 |
| `query(text) / retrySearch()` | 更新宿主查询或显式重试；宿主继续去抖、取消过期请求 |
| `newSession()` | 打开现有工作区选择器；实际创建仍由宿主管理 |
| `rememberScroll(top)` | 保存当前导航键的阅读位置；拒绝非有限数字 |
| `readScroll()` | 挂载时读取最新位置，避免只切换插件而宿主未重画时使用过期投影 |

`view` 是投影，插件应视作只读；禁止直接修改、缓存后重放操作，或推断未公开的私有字段。长久状态应由宿主契约或插件自己的持久化管理；任意组件私有 Hook 状态不保证跨停用/启用保留。

## 样式和生命周期

首页槽提供手机主题的公开CSS变量：`--dshm-bg`、`--dshm-text`、`--dshm-secondary`、`--dshm-muted`、`--dshm-subtle`、`--dshm-border`、`--dshm-primary`、`--dshm-on-primary`、`--dshm-success`/`--dshm-success-soft`、`--dshm-error`/`--dshm-error-soft`。背景、文字和控件应成对取同一套变量，不用电脑色板选文字、手机暗色标记选按钮底色。手机浅色/深色/跟随系统由宿主同步，插件无需订阅原生事件。

宿主在连接页和首页槽内将常用DSH背景、文字、边框及交互背景别名映射为手机色板，兼容旧页面插件；DSHM自有Remote弹窗也使用相同主题。不会清除或改写body的电脑皮肤样式，聊天、局部插槽和插件面板继续保留原有环境。插件若有自己的品牌配色，应在自己的根内同时定义前景与背景，不向body或其他页面注入规则。该边界是样式约定，不是恶意CSS隔离。

- 页面插件只占连接页或首页区域。状态/审批提示、设置弹窗、聊天、全局和侧面板仍归宿主管理；插件不应隐藏或重新实现它们。
- 样式限定插件根节点；不得对 body、通用 button/input 或宿主容器做全局 reset。样例的 style 节点跟随组件卸载。
- 默认界面和插件共用宿主导航/搜索/草稿/会话状态。切换界面不更换 RemoteWorkspace 或 RemotePluginScope 的 key，不释放会话引用。
- 断线保留已加载界面，更新连接状态并禁用写入口；恢复同步沿用现有连接实现。真正撤权、核心重建或 App 结束仍执行原生命周期。
- 输入局部插槽在离线分支重挂、`ctx.workspaces` 缺失是此前的独立限制，本次没有宣称解决全部插件生态缺口。

App 保留默认首页回退，并从预装目录初始化没有记录的完整包。用户可在「插件 → 手机」更新、启停、卸载及显式恢复，App升级不复活已卸载条目，也不自动替换已安装版本。其他来源由用户从文件安装。`DSHMMobilePlugins`只对自有主框架开放共享记录，运行报告绑定宿主租约和记录修订。没有对应宿主时显示待加载，不能把已启用当作运行中；已加载首页不因电脑断线而停用。文件安装要求原生`installerApi:1`，旧APK或网页预览不显示导入按钮。预装API和恢复入口随新APK交付，不是给旧APK发布资源包。完整状态和验证见[预装专题](../integration/preinstalled-phone-plugins-current.md)，[外部安装专题](../integration/external-phone-plugins-current.md)保留上一阶段证据。
