# 手机主题与 Remote 首页图标修复

后续[历史断层诊断](./remote-history-gap-diagnosis.md)确认了负面脚本与公开接口的失败行为差异，现已由[插件历史读取兼容修复](./remote-history-api-current.md)完成分层处理，全量脚本和两SDK连续24批回归通过。以下主题轮记录保留当时的验证范围。

- 状态：实现与下列验收完成，纳入preview.14/code22；公开包结果见[发行核验](../releases.md#已核验范围)。下文code21与未发布描述保留当时本地验收阶段。
- 维护：手机端维护者；核验日期：2026-10-26；任务：[KKC-105](https://linear.app/kkcodes/issue/KKC-105)。
- 原因：[主题诊断](./remote-theme-diagnosis.md)。不修改DSH本体，不合入旧npm/插件适配分支。

## 当前规则与实现

手机浅色/深色/跟随系统仍通过原生外观镜像及原ThemePresenter同步。新增的手机色板边界只作用于Remote首页槽、默认首页与DSHM自有Surface弹窗；没有重写电脑主题服务、清空body样式、轮询覆盖插件CSS或判断具体插件包名。

| 可行方案 | 影响与取舍 |
| --- | --- |
| 全局强制覆盖电脑色板 | 改动集中，但会影响聊天、局部插件及面板，且易与电脑皮肤反复争写，不采用 |
| 手机页面边界提供语义色板 | 首页和自有弹窗一致，聊天/插件面板保留电脑环境；需覆盖默认回退、弹窗及旧页面插件别名，采用 |

[system.css](../../src/ui/system/system.css)将颜色变量与Figma组件行为样式分开。`dshm-phone-colors`提供公开`--dshm-*`色板，并在边界内映射常用DSH背景/文字/边框/交互背景别名，兼容旧首页插件；不套用`dshm-design`的通用按钮焦点/reset规则。插件自有焦点样式继续有效。该机制是样式契约，不是恶意CSS沙箱。

[首页槽](../../src/remote-plugin-slots.jsx)的主题容器在启停/失败回退间保持；不重建会话作用域。[Surface](../../src/ui/Surface.jsx)提供可选`phoneTheme`，由Remote自有弹窗入口显式使用；不改变电脑局部组件的等比缩放、原生弹窗管理或返回优先级。聊天、局部插槽和插件面板没有加入这个首页主题边界。

独立首页`0.3.1`的所有前景/背景/边框/状态配对读取同一色板，恢复本地原Figma back/more/monitor/folder/chevron/edit资源。[资产说明](../../packages/remote-home-design/assets/README.md)记录来源和原尺寸；搜索功能的既有图形不在该Figma首页帧中，本轮保留。资源副本在独立插件内，不引用宿主私有路径。

真实MuMu揭示了第二个资源问题：esbuild的原始SVG data URL含属性引号，插入CSS url()后旧WebView拒绝该值，导致mask变成方块。公共[SDK打包器](../../packages/plugin-sdk/build.mjs)现按原字节base64封装所有SVG，未修改矢量内容；已增加实际打包/工厂/组件渲染的回归。不是特化首页或某款电脑皮肤。

预装目录更新为同一完整`0.3.1`包。APK升级仍不替换已有包或复活卸载记录；现有用户需要显式从文件更新或在卸载后恢复。MuMu本次通过真实系统文件选择器和信任确认，从外部0.2.0更新至0.3.1，再覆盖安装最终非调试APK，版本与选择保留。

## 验收矩阵

| 范围 | 结果 |
| --- | --- |
| 修复前可复现 | 新增真实RemoteWorkspace/Cordis首页回放，在手机light＋电脑深色公共色板条件下失败：实际暗底浅字 |
| 页面主题 | rc.2与alpha.2均通过：light/system-dark、dark/system-light、system/light、system/dark；按钮、默认回退、菜单与重启插件配色一致 |
| 插件边界 | 自有焦点样式、第二插件公开API、错误回退、启停、阅读位置、会话/草稿、断线重连和返回优先级的专项回放通过 |
| 原资源 | 六份SVG与原资产字节一致；实际浏览器解码、内在尺寸与渲染尺寸一致；公共SDK产物保留原字节 |
| MuMu真实连接 | 手机实际设置浅色/深色，电脑深色皮肤持续加载；首页、菜单、新建聊天的工作区选择弹窗符合手机主题；原图标可见 |
| MuMu生命周期 | 停用回到同色默认页，再启用恢复首页；阅读位置约140px保持；进入已有聊天仍为电脑皮肤浅色前景，首页主题边界不在聊天祖先中 |
| Node | 593项通过；新增原资产与打包后SVG回归。服务端静态渲染测试有useLayoutEffect提示，不是生产SSR路径 |
| 构建 | 官方rc.2手机网页构建、最终debug/release与release lint通过；保留既有翻译重复键警告 |
| 额外全量脚本 | `verify-remote-plugin-slots.mjs`在历史断层用例直接await被拒的pluginHistory，报`remote_history_page_discontinuous`退出；不计作全量通过，本轮不混入历史产品或测试重构 |

主题专项脚本：[check-phone-home-theme](../../scripts/check-phone-home-theme.mjs)、[真实首页/管理回放入口](../../scripts/verify-mobile-interface.mjs)。使用实际外观watcher和ThemePresenter，不只手动改暗色属性；电脑色板含body重要规则，断言全局色板及无关插件变量不被清除。页面回放不冒充真实电脑或Android验收。

真实设备环境：MuMu Android12，WebView110，实例0；现有官方DSH alpha.2＋电脑插件0.1.81＋公用中转。没有改电脑设置、发送模型消息、读取Key或重建配对。没有覆盖全部真机/第三方CSS及恶意全局选择器。

## 最终本地交付

- 原包名`dev.dshmobile.validation.officialtest`、原签名、非调试`0.1.0-preview.13-theme / code21`，覆盖安装后真实Remote首页已连接且为浅色。
- APK SHA256：`4bab939a67c9ba5302bfde621a31f21cdab8c474795bf678a93453c717439051`。
- 首页包版本`0.3.1`，code摘要：`d2d6e29dffc492ac9031f583b585930933de4b4735ccbdb0b559aefc1b0a7494`。
- 证据位于本地忽略目录`artifacts/tests/remote-theme/`：修复前报告、Node日志、`DSHM-theme.apk`、浅色/深色/菜单截图与最终`final-native.png`。两SDK专项报告位于`artifacts/tests/mobile-interface/report-*.json`。
- 当前仍为main，基准HEAD `be6bf87`，没有提交或合入旧分支；原有未提交改动保留。公开release元数据仍为preview.13/code16，后续公开APK需高于本地21。

开发者契约已同步[首页API](../plugins/remote-home-api.md)、[开发指南](../plugins/development.md)与[SDK说明](../../packages/plugin-sdk/README.md)。公开README的功能边界无变化，本轮不追加开发流水账。
