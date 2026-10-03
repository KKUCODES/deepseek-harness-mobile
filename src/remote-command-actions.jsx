import { CommandUiRuntime } from '../../deepseek-harness/packages/client/ui-commands/src/client/service.ts';
import { PopupSelectView } from '../../deepseek-harness/packages/client/ui-commands/src/client/PopupSelectView.tsx';
import { zh, en } from '../../deepseek-harness/packages/client/ui-commands/src/client/locales.ts';

import { RemoteCommandActions } from './remote-command-actions.mjs';
import { IconPaperclipOutline16 } from '../../deepseek-harness/packages/client/ui-primitives/src/icons/index.tsx';

/** 沿用原命令服务与弹窗，只补充原 action 的手机菜单入口。 */
export function installRemoteCommandActions(model) {
  const actions = model.commandActions = new RemoteCommandActions(model);
  class MobileCommandUi extends CommandUiRuntime {
    decorate(decoration) {
      const releaseOriginal = super.decorate(decoration);
      const releaseMobile = this.ctx.effect(() => actions.register(decoration), 'DSHM command action');
      return () => { releaseOriginal(); void releaseMobile(); };
    }
  }
  model.ctx.plugin({ name: 'dshm-command-ui', inject: ['inputTriggers', 'sessions', 'remote', 'remote.commands', 'locale'], apply(ctx) {
    ctx.effect(() => ctx.locale.register('command', { zh, en }), 'DSHM command dictionaries');
    ctx.plugin(MobileCommandUi);
    ctx.inject(['slots', 'commandUi', 'sessions'], scope => {
      const command = scope.commandUi;
      // 原 /file 只打开当前手机会话的系统选择器，不让插件持有电脑文件路径。
      scope.effect(() => command.register({
        name: 'file', label: () => scope.locale.bind('conversation')('input.file'), icon: IconPaperclipOutline16,
        available: session => {
          const input = model.inputBindings.mounted(session.sessionId);
          return input?.current() && input.sessionId === session.sessionId && input.shell.canPickFiles();
        },
        ui: { kind: 'action', run: session => {
          const input = model.inputBindings.mounted(session.sessionId);
          if (input?.current() && input.sessionId === session.sessionId) input.shell.pickFiles();
        } },
      }), 'DSHM native file action');
      scope.slots.inject('conversation.input.overlay', () => scope.slots.register({
        name: 'conversation.input.overlay', id: 'command-popup', order: 1, locale: 'command',
        inject: sessionId => ({ popup: command.popupFor(scope.sessions.scope(sessionId)) }),
      }, PopupSelectView));
    });
  } });
}
