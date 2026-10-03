import { formatFileMention } from '../../deepseek-harness/packages/context/file-reference/src/grammar.ts';
import { isAbsoluteWorkspacePath, resolveWorkspacePath } from '../../deepseek-harness/packages/util/workspace-path/src/index.ts';

/** 原 reference 文件ID是相对 mention；交接时固定来源，其他插件的ID由其自身解释。 */
export function rebaseWorkspaceReferences(draft, cwd, project) {
  if (!draft.editor) return draft;
  let changed = false;
  const fail = () => { throw new Error('无法确认文件引用的原位置，草稿仍在原聊天，请重新选择引用后重试。'); };
  const visit = node => {
    if (node.type === 'reference-chip' && node.source === 'reference' && ['file', 'folder'].includes(node.appearance)) {
      if (typeof node.ref !== 'string' || !node.ref.startsWith('@')) return fail();
      const quoted = node.ref.startsWith('@"');
      let path = node.ref.slice(quoted ? 2 : 1);
      if (quoted && path.endsWith('"')) path = path.slice(0, -1);
      if (isAbsoluteWorkspacePath(path) || path === '~' || path.startsWith('~/') || path.startsWith('~\\')) return node;
      if (!path || /^[A-Za-z]:/.test(path) || typeof cwd !== 'string' || !isAbsoluteWorkspacePath(cwd)) return fail();
      const kind = node.appearance === 'folder' ? 'directory' : 'file';
      if (kind === 'directory') path = path.replace(/[/\\]+$/, '');
      const ref = formatFileMention({ path: resolveWorkspacePath(cwd, path), kind }, quoted);
      if (!ref) return fail();
      changed = true;
      return { ...node, ref, clipboardText: ref };
    }
    return Array.isArray(node.children) ? { ...node, children: node.children.map(visit) } : node;
  };
  const editor = { ...draft.editor, root: visit(draft.editor.root) };
  if (!changed) return draft;
  // 由原 Lexical 投影重算文字，避免自行拼接段落或丢失其他插件节点。
  if (!project || project(draft.editor) !== draft.text) return fail();
  return { text: project(editor), editor };
}
