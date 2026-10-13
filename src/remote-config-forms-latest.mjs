import { ConfigForms } from '@upstream/ui-settings/src/client/config-form.ts';
import { SettingsSchemaService } from '@upstream/ui-settings/src/client/schema.ts';
import { SettingsDescribeMirror } from '@upstream/ui-settings/src/client/settings-mirror.ts';
import { RemoteCodingTools } from './remote-coding-tools.mjs';

/** 原共享配置服务保留；仅已核验的代码视图偏好改走固定远程入口。 */
export function installRemoteConfigForms(model) {
  return model.ctx.plugin({ name: '@deepseek-ai/dsh-client-ui-settings', inject: ['remote', 'remote.settings'], apply(ctx) {
    const scope = model.codingTools = new RemoteCodingTools(model);
    class MobileConfigForms extends ConfigForms {
      get(entryId) { return entryId === 'ui-settings' ? scope : super.get(entryId); }
    }
    const schema = new SettingsSchemaService(ctx), mirror = new SettingsDescribeMirror(ctx, 'memory');
    new MobileConfigForms(ctx, { schema, mirror, persistence: 'memory' });
    ctx.effect(() => scope.subscribe(() => model.agentPresets.invalidate()), 'DSHM: coding view preset directory');
    ctx.effect(() => () => { scope.dispose(); if (model.codingTools === scope) model.codingTools = undefined; }, 'DSHM: shared coding view preference');
    void scope.load();
  } });
}
