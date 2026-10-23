import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

/** 仅在手机构建中适配受阻/中断结算；固定上游文件保持只读。 */
export function latestTurnProcessSources(upstream) {
  const base = resolve(upstream, 'packages/client/ui-chat/src/client');
  const patches = new Map([
    [resolve(base, 'contract/turn-process.ts'), {
      before: "return location.turn.status === 'open' || reason === 'aborted' || reason === 'error'",
      after: "return location.turn.status === 'open' || reason === 'aborted' || reason === 'error' || reason === 'blocked' || reason === 'interrupted'",
      loader: 'ts',
    }],
    [resolve(base, 'chat/TurnProcessNodeView.tsx'), {
      before: "if (turn?.status !== 'closed') return null",
      // DSHM自有局部组件保留原样式/控制契约；不写回上游或修改电脑客户端。
      view: resolve(import.meta.dirname, '../src/ui/RemoteTurnProcess.jsx'),
      loader: 'tsx',
    }],
  ]);
  return { name: 'latest-mobile-blocked-turn', setup(builder) {
    builder.onLoad({ filter: /(?:turn-process\.ts|TurnProcessNodeView\.tsx)$/ }, async args => {
      const patch = patches.get(resolve(args.path)); if (!patch) return;
      const source = await readFile(args.path, 'utf8');
      const anchor = source.includes(patch.before) ? patch.before : patch.view ? patch.before
        : "return location.turn.status === 'open' || reason === 'aborted' || reason === 'interrupted' || reason === 'error'";
      if (source.split(anchor).length !== 2) throw Error(`Latest blocked-turn source requires review: ${args.path}`);
      if (patch.view) return { contents: `export { RemoteTurnProcess as TurnProcessNodeView } from ${JSON.stringify(patch.view.replaceAll('\\', '/'))};`,
        loader: patch.loader, resolveDir: dirname(args.path) };
      return { contents: source.replace(anchor, patch.after), loader: patch.loader, resolveDir: dirname(args.path) };
    });
  } };
}
