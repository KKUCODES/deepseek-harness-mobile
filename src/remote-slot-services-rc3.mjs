import Shortcuts from '@upstream/shortcuts/src/client/index.ts';
import { apply as contextMenu, inject as menuServices } from '@upstream/ui-context-menu/src/client/index.ts';
import { apply as fileDrag, inject as dragServices } from '@upstream/ui-file-drag/src/client/index.ts';

/** 文件预览、工具过程与第三方插槽共用这批由窗口持有的客户端服务。 */
export function installRemoteSlotServices(ctx) {
  return Promise.all([
    ctx.plugin(Shortcuts).await(),
    ctx.plugin({ name: '@deepseek-ai/dsh-client-ui-context-menu', apply: contextMenu, inject: menuServices }).await(),
    ctx.plugin({ name: '@deepseek-ai/dsh-client-ui-file-drag', apply: fileDrag, inject: dragServices }).await(),
  ]);
}

/** 文档预览体插槽注入工厂通过 ctx 属性读取的额外客户端服务 */
export const documentPreviewInject = ['fileDrag'];
