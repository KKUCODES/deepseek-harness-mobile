// Host 竞争测试只进入 Node 构建，不把服务器依赖带进浏览器夹具。
export * from './remote-core.mjs';
export { eventHost } from './remote-event-host.mjs';
export { RemoteConversationModel } from '../../src/remote-conversation-model.mjs';
