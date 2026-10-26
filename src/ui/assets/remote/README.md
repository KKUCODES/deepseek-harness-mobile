# Remote 设计资源

来源为本项目 [DSHM Figma 文件](https://www.figma.com/design/4O2ww8JdFAYnZRLVo7on83/DSHM)，2026-10-24 经官方 Figma MCP `get_design_context` 导出并下载。运行时只引用本地 SVG，不依赖临时 Figma 地址。

| 资源 | 设计节点 |
| --- | --- |
| phone、edit、scan、image、chevron、chevron-light、back、more、link、lock | 配对页 `21:1399` 中的原组件 |
| monitor、folder | Remote 首页 `21:2277` |
| hero-halo、hero-scan、hero-dot、arrow | PairingHero `17:357` |
| loader | LoadingToast `73:1002` |
| check、alert | 连接成功 `21:1834`、连接失败 `21:1892` |

图标和插画矢量以原 SVG 作为 mask，颜色由共享主题变量提供；插画中的外框、色块和分隔线按设计的矩形布局实现。手机系统状态栏由 Android 绘制，不复制成网页内容。字体使用 Noto Sans SC、Microsoft YaHei、系统无衬线回退栈，不额外下载字体包。
