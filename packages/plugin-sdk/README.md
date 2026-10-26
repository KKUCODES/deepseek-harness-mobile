# DSHM Plugin SDK（实验版）

构建可独立安装的 **DSHM 手机 Remote 首页插件**。当前仅开放 `dshm.remote.home`，API 主版本为 `1`；不是 DSH 电脑插件 SDK，也不提供任意 npm 包运行环境。

此 SDK 尚未发布到 npm。先在 DSHM 源码目录执行：

```sh
mkdir artifacts/plugin-sdk
npm pack ./packages/plugin-sdk --pack-destination ./artifacts/plugin-sdk --ignore-scripts
```

然后在独立插件工程中安装生成的 `dshm-plugin-sdk-0.1.0.tgz`，作为开发依赖。工程不依赖 DSHM 私有源码或上游 DSH；手机不需要安装此 SDK。

```sh
npm install --save-dev /path/to/dshm-plugin-sdk-0.1.0.tgz
```

工程的 `package.json` 最小内容：

```json
{
  "name": "@example/my-home",
  "version": "1.0.0",
  "description": "我的 Remote 首页。",
  "type": "module",
  "scripts": { "build": "dshm-plugin-build" },
  "dshm": {
    "displayName": "我的首页",
    "entry": "index.jsx",
    "interfaceApi": 1,
    "surface": "dshm.remote.home"
  }
}
```

安装 SDK 后请保留 npm 自动写入的 `devDependencies`。`index.jsx`：

```jsx
import React from 'react';
export const name = '@example/my-home';
export const inject = ['slots'];
export const mobileInterface = { apiVersion: 1, surface: 'dshm.remote.home' };
export function apply(ctx) {
  ctx.slots.register({ name: mobileInterface.surface }, Home);
  // 需要订阅或定时器时，用 ctx.effect(() => 清理函数) 注册清理。
}
/** @param {import('@dshm/plugin-sdk').HomeProps} props */
function Home({ home }) {
  return <section className="my-home">
    <h1>{home.view.title}</h1>
    <button onClick={home.actions.menu}>{home.t('Remote 选项')}</button>
    {home.view.sessions.map(item => <button key={item.id}
      disabled={home.view.busy || home.view.connection !== 'connected'}
      onClick={() => home.actions.session(item.id)}>{item.title}</button>)}
  </section>;
}
```

安装 SDK 后运行 `npx dshm-plugin-build`，默认读取当前工程 `package.json` 中的 `dshm.entry/interfaceApi/surface/displayName`，输出 `dist/<name>-<version>.dshm-plugin`。

可选 `--root <工程目录>`、`--out <输出文件>`、`--version <x.y.z>`。公开类型从 `@dshm/plugin-sdk` 导入；运行时只允许 `react`（由宿主提供同一实例）。代码与资源必须完整打包，图片、字体使用内联资源，CSS 作为文本由组件管理；不支持 Node、安装脚本、原生模块、独立 CSS 文件或动态分块。

此包本身是可移动的构建工具；打包进 `.tgz` 后不包含 DSHM 或 DSH 源码。首次安装构建依赖需联网，构建后的插件在手机上不需要 npm、Node 或中转资源下载。

把生成文件传到手机，在「插件 → 手机 → 从文件安装」选择并确认信任。更新同一插件必须递增 `x.y.z` 版本；修改包名时同步修改代码中的 `name`。停用、卸载或加载失败回退到 App 默认首页。插件不能代替聊天、审批和电脑连接层。

组件收到 `{ home }`。完整字段见此包自带的 `index.d.ts`：只读的工作区/会话/连接状态，导航、搜索、打开会话、新建入口和阅读位置操作。安装/更新/启停不释放宿主持有的会话和草稿。运行状态由宿主确认；没有打开 Remote 时是待加载。

样式应限定自己的根节点，首页优先读取公开手机色板 `--dshm-bg` / `--dshm-text` / `--dshm-subtle` / `--dshm-secondary` / `--dshm-border`，前景和背景成对使用。同一首页槽的常用 `--dsw-alias-*` 背景、文字及边框别名映射为手机色板供旧插件使用；电脑皮肤仍保留在聊天和局部界面。禁止全局 reset、访问私有 DOM/模型/原生桥、在加载时执行电脑操作。资源与 CSS 应由组件携带和清理，SVG按原字节base64内联，避免引号破坏CSS url()。事件与定时器使用 `ctx.effect` 释放。异步加载/激活/释放最多等待 8 秒；同步死循环无法被同线程超时中断。

仅安装可信来源。插件与页面共享 JavaScript 环境，不是权限沙箱；SHA-256 只是完整性检查，不是签名或作者认证。当前不提供插件市场、npm 自动安装、依赖自动解析、自动更新或旧版本自动回滚。构建包上限 2 MB，手机最多安装 32 个外部包，API v1 只支持 Remote 首页。旧 preview.13 APK 没有此外部安装器，不能只靠插件文件获得宿主新能力。
