import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

/** 只开启原 Menu 的浮层接口，避免手机外层缩放/滚动裁掉菜单。 */
export function remoteDesktopAppSources(root) {
  const base = resolve(root, '../deepseek-harness/packages/client/ui-open-in-app/src/client');
  const output = resolve(root, 'artifacts/source/desktop-apps');
  let source = readFileSync(resolve(base, 'OpenInAppAction.tsx'), 'utf8');
  const anchor = '<Menu\n';
  source = source.replaceAll('\r\n', '\n');
  if (source.split(anchor).length !== 2) throw new Error('OpenInAppAction Menu contract changed');
  source = source.replace(anchor, '<Menu\n      portal\n');
  source = source.replace(/(from\s+['"])(\.[^'"]+)(['"])/g,
    (_match, before, path, after) => before + resolve(base, path).replaceAll('\\', '/') + after);
  mkdirSync(output, { recursive: true });
  const target = resolve(output, 'OpenInAppAction.tsx');
  let previous;
  try { previous = readFileSync(target, 'utf8'); } catch {}
  if (previous !== source) writeFileSync(target, source);
  return { '@dshm/desktop-app-action': target };
}
