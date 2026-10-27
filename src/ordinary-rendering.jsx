import { ChatMarkdown } from './ui/ChatMarkdown.jsx';
// 保留旧模块导出；普通聊天插件与Remote直接使用同一组件，不维护第二份排版实现。
export { ChatMarkdown as OrdinaryMarkdown } from './ui/ChatMarkdown.jsx';
export const inject = ['slots'];
export function apply(ctx) {
  ctx.slots.inject('ordinary.message.content', () => ctx.slots.register({ name: 'ordinary.message.content' },
    ChatMarkdown));
}
