import { mkdir } from 'node:fs/promises';

export const inject = ['workspaceRegistry'];
export async function apply(ctx) {
  const created = [];
  ctx.effect(() => async () => { for (const id of created) await ctx.workspaceRegistry.delete(id); });
  for (const name of ['source', 'target']) {
    const path = `Q:/Tanxian/LToys/dsh-mobile/dsh-mobile/artifacts/workspace-draft-${name}`;
    await mkdir(path, { recursive: true });
    if (!await ctx.workspaceRegistry.resolveByPath(path)) {
      const workspace = await ctx.workspaceRegistry.create(path, `DSHM 草稿交接 ${name}`);
      created.push(workspace.id);
    }
  }
}
