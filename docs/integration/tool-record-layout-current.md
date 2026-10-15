# Remote 工具记录排版

- 状态：手机适配、浏览器专项、完整页面回归与 MuMu 真实记录复验通过；已随[公开preview.3](../releases.md#已核验范围)提交发布，以下保留本地候选证据。
- 维护角色：DSHM 手机端维护者。
- 最近核验：2026-10-14。
- 任务：[KKC-54](https://linear.app/kkcodes/issue/KKC-54)。

## 排版边界

官方工具包自己的工具树、原子视图和取消/通用回退视图使用手机宽度排版；保留官方图标、错误颜色、文件链接、展开内容和检查回调，不修改 DSH 或插件源文件。第三方替换视图继续使用 `MobilePluginFrame`，保留作者声明、用户覆盖、内部尺寸和关闭自适应后的横向滚动。

进入官方工具包注册域时根据 fiber 祖先判定所有者，不按工具名称把第三方视图当成官方界面。自己的 `NativeToolFrame` 标记只包围该域的视图。工具摘要最低 14px，长报错与路径换行；其余卡片仍由原组件提供滚动。电脑下发的组件与手机源码构建具有不同 CSS Module 类名，布局仅依赖已核验的 `data-tool`、`data-disclosure-row` 及两代行结构，不匹配压缩类名。

工具记录使用 DSH 的 6px 行间距，回答与过程标题采用 12/16px 分层，取代每条 24px 的消息间距。过程折叠后隐藏记录不留空白，正文与输入框保持自己的间距。独立“工具详情”入口改为行尾图标按钮，保留可访问名称和原回调，不再额外占一行。

## 证据与限制

修改前同一真实组件回放中，长拒绝错误的 13px 文字被缩为约 4.8px，每条记录另留 24px 空白。修正后，alpha.2 手机组件在 320/375/420/760px、浅深主题八种组合中最低 14px，无裁切、横向溢出；主聊天与 embedded 布局、详情入口、草稿和折叠已回放。该回放不等于真实电脑或 Android 验收。

命令：`node scripts/verify-remote-plugin-slots.mjs --tool-layout --official-alpha2`。本机证据为 `artifacts/remote-tool-layout-alpha2-web.json` 和同名前缀日志、截图；旧基线 `--tool-layout` 也通过。两版均检查真实渲染中的字号、换行、裁切、6px 行间距、主/embedded 布局、详情/草稿/折叠，以及第三方 720px 工具视图的缩放、点击、内部尺寸和关闭自适应后的横向滚动。不扩大公开支持的 SDK 范围。

完整 `verify-remote-plugin-slots.mjs` 回归、495 项 Node 测试、Web 构建、Android assembleDebug/lintDebug 通过。记录在 `artifacts/remote-tool-layout-full-page.log`、`remote-tool-layout-node-tests.log` 及同前缀构建日志。布局样式随手机 CSS 交付，不能把 React 拥有的 style 节点插入插件运行时会回收的节点集合；曾出现的卸载 removeChild 失败已修正，最终完整回归无页面异常。

### 实际 App 与电脑下发插件

最终 MuMu 报告为 `artifacts/remote-tool-layout-android/e4a9fa6c-296a-43ae-bf89-8cbb1e3afb64/report.json`，通过官方 DSH `0.2.1-alpha.2`、发布插件 `0.1.84-latest.0`、生产中转与正常 App 配对入口验证。只复制此前已完成真实模型/审批验收的专用会话 `session-80d246d8-29b8-41ba-8322-06372d7cdc9c`，不复制 profile 或 Key；校验原会话字节未变。实际加载电脑下发工具插件，浅深主题下长拒绝摘要均为 14px、完整换行且没有裁切，页面宽度保持 420px；工具详情、折叠/展开和草稿通过。没有发送新模型消息、重放审批或修改原历史。

早期测试发现原 `.officialtest` App 已有绑定，保护检查拒绝移除该未知绑定；随后增加受约束的 `-PremoteToolLayoutTest=true` 独立 `.toolstyletest`，不扩大现有发布身份。失败驱动及临时服务连接失败保留，不计为通过。最终测试授权、绑定、转发、独立 Host 均清理，测试 App 已卸载。切换 Gradle 构建目录会清理上一次任务的旧输出，因此验收应等构建完成，并在切换构建配置前保存候选，不能在驱动读取旧输出时并行重建。

正常包候选 `artifacts/releases/DSHM-2026-10-14-remote-tool-layout.apk` 为 12,708,849 字节，SHA-256 `a657bfcc77b79391cb1d7e1ed39396a6f0451af1d472e05ff2ca9b0c2e2c0d8f`；168 个 Web 文件与已验资源逐字节一致，源码摘要见 `artifacts/remote-tool-layout-apk.json`。已覆盖安装到 MuMu 的 `.officialtest`，实际安装包 SHA 与候选一致并从正常入口启动；没有清空原 App 数据或绑定。独立验收包因 UID 不同具有另一个 APK 摘要，不冒充正常包的相同二进制验证。

前述本地验收完成时尚未提交发布；当前公开preview.3已包含这些变更，签名APK的来源和摘要见发行记录。

## 实现来源

[官方工具域判定](../../src/remote-tool-typography.jsx)、[插槽与详情入口](../../src/remote-plugin-slots.jsx)、[取消回退](../../src/remote-tool-cancellation.jsx)、[手机样式](../../src/ui/remote-product.css)、[页面排版专项](../../scripts/check-remote-tool-layout.mjs)、[真实 Android 验证入口](../../scripts/verify-remote-motion-android.mjs)。
