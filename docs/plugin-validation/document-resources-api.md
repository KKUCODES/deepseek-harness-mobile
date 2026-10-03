# Remote 文档与附件资源接口

- 状态：DSHM 原文档注册表、文本/字节/自主读取插件模式已接入历史附件；代表性独立插件经电脑安装到MuMu验收通过，不能推出任意第三方兼容。
- 维护角色：项目协作Agent；最近核验：2026-09-26。
- 来源：[文档组合](../../src/remote-document-previews.jsx)、[地址契约](../../src/remote-document-address.mjs)、[附件读取](../../src/remote-attachment-documents.mjs)、[派生原组件](../../scripts/remote-document-sources.mjs)、[实际验证](../integration/remote-current.md#历史附件原文档预览2026-09-26)。

## 地址和身份

电脑文件仍使用原 `dsh-resource://file/session/...` 地址。聊天原始附件使用独立的 `dsh-resource://dshm-attachment/<sessionId>/<kind>/<attachmentId>/<name>`，每段分别编码，必须保留完整 `resourceAddress`，不要自行拼接或把显示名当电脑路径。不同会话或不同附件ID即使同名也不是同一个标签。

原 `useResource(resourceAddress)` 可以读取附件引用描述：`source: 'attachment'`、`sessionId`、`name` 和 `attachment`。这只是引用描述，**不表示电脑已经授权读取或文件存在**，没有伪造 `absolutePath` 或磁盘版本。真正读取仍经原电脑附件通道核验会话引用、容量和最终完整性；读取失败必须展示失败。

## 预览插件

继续使用原 `ctx.documentPreviews.register` 与 `sidebar.right.tab.document` 插槽。`text-pages`、`bytes-complete` 模式的插件继续消费原 `content`，不需要为了附件重新实现UI。注册的释放函数应由 `ctx.effect` 持有，卸载后才能正确回退其他预览器。

`renderer` 模式自己读取内容时，可条件注入手机扩展服务 `dshmDocuments`。它不是上游 DSH 已有服务，桌面没有该服务时应保留插件原有文件读取路径：

```js
ctx.inject(['dshmDocuments'], mobile => {
  // 在自己的文档组件中，用真实resourceAddress和组件/标签合成的signal调用。
  const read = (resourceAddress, signal) =>
    mobile.dshmDocuments.readBytes(resourceAddress, signal);
  // 将read传给自己的组件；成功后使用result.value.data，失败时显示result.error。
});
```

| 方法 | 行为 |
| --- | --- |
| `describe(address)` | 解析真实资源身份；返回`sessionId`、`path`，附件额外带`attachment`。附件的`path`仅为显示名，不授予任何电脑路径能力。非法地址抛错。 |
| `readBytes(address, signal)` | 返回`{ok:true,value}`或`{ok:false,error}`；成功含`data:Uint8Array`、`version`、`bytes`、`offset:0`、`eof:true`。工作区保留原元数据，附件含`name`而没有`absolutePath`。中止可以抛错。 |
| `readPage(address, offset, signal)` | 1-based分页，成功含`text`、`lines`、`offset`、`eof`、`version`。末尾换行终止最后一行，不额外产生空行。附件中止可返回失败结果；调用者仍须核对signal并丢弃迟到结果。 |

附件版本是不可变原件的完整引用身份，不是磁盘时间戳。每次读取均重新走Host引用核验，不缓存授权结果；最大32MiB，最多两个并发内容读取。附件每次分页先验证完整有界内容，再交付最多5000行，当前没有附件按行远程RPC或分页缓存；超大附件仍可按既有完整下载入口处理。电脑文件分页沿原Host上限。

调用者必须使用自己的生命周期signal，关闭标签或卸载时中止；异步返回后再次核对signal。外层缩放继续遵循[既有布局API](./mobile-layout-api.md)，接口不改造插件内部布局。仅理解电脑路径、自行调用 `workspaceFiles` 的旧插件不会自动理解附件，应使用此服务或明确限制自己的支持范围。

## 特殊格式与边界

图片、代码、Office等原组件在手机构建时派生来源解析，保留原布局、注册表和状态机；参考检出不修改，原锚点变化时构建拒绝静默套用。HTML附件继续使用隔离沙箱，缺少外部依赖时拒绝从显示名推断电脑目录。Office沿原附件转换通道，下载/分享仍交付原件，未冒充电脑路径。

原Office缓存与调度、所有第三方自管读取方式、全部在途撤销/重连及完整性能仍待验收。关闭外层面板保留原标签；关闭标签才释放该预览的状态及工作线程，下载/分享操作在外层关闭时已单独取消。
