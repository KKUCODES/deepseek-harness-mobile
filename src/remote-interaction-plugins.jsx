import * as approval from '@upstream/ui-approval/src/client/index.ts';
import * as questions from '@upstream/ui-user-questions/src/client/index.ts';

/** 在 Gateway 放行事件前安装原消费者，载体、优先级和卸载委派仍归原插件所有。 */
export function installRemoteInteractionPlugins(model) {
  if (model.interactions.size) throw new Error('Cannot replace interaction consumers while a request is pending');
  model.interactionUiOwnsEvents = true;
  const plugins = [
    model.ctx.plugin({ ...approval, name: '@deepseek-ai/dsh-client-ui-approval' }),
    model.ctx.plugin({ ...questions, name: '@deepseek-ai/dsh-client-ui-user-questions' }),
  ];
  return Promise.all(plugins.map(plugin => plugin.await()));
}
