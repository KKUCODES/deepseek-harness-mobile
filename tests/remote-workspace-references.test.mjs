import test from 'node:test';
import assert from 'node:assert/strict';
import { rebaseWorkspaceReferences } from '../src/remote-workspace-references.mjs';

const chip = (ref, appearance = 'file', source = 'reference') => ({ type: 'reference-chip', source, appearance, ref, label: '文件', clipboardText: ref, invalid: false });
const project = editor => editor.root.children.map(n => n.clipboardText ?? n.text ?? '').join('');
const draft = (...children) => { const editor = { root: { type: 'root', children } }; return { editor, text: project(editor) }; };

test('交接前将原文件身份固定到源目录，同名目标文件不能替换引用', () => {
  const saved = draft({ type: 'text', text: '读取 ' }, chip('@./same.txt'), chip('@dsh-session:source', 'session'));
  const result = rebaseWorkspaceReferences(saved, 'Q:/source', project);
  assert.equal(result.editor.root.children[1].ref, '@Q:/source/./same.txt');
  assert.equal(result.editor.root.children[1].clipboardText, '@Q:/source/./same.txt');
  assert.equal(result.editor.root.children[2].ref, '@dsh-session:source');
  assert.equal(saved.editor.root.children[1].ref, '@./same.txt');
  assert.equal(result.text, '读取 @Q:/source/./same.txt@dsh-session:source');
});

test('引用语法沿用原规则：空格、目录、Windows和POSIX源目录', () => {
  assert.equal(rebaseWorkspaceReferences(draft(chip('@"a b.txt"')), 'C:\\work space', project).editor.root.children[0].ref, '@"C:\\work space\\a b.txt"');
  assert.equal(rebaseWorkspaceReferences(draft(chip('@"a b/', 'folder')), '/source', project).editor.root.children[0].ref, '@"/source/a b/');
  assert.equal(rebaseWorkspaceReferences(draft(chip('@dir/', 'folder')), '/source', project).editor.root.children[0].ref, '@/source/dir/');
});

test('不改绝对路径、主目录、聊天、其他插件引用或普通文字', () => {
  const saved = draft(chip('@/absolute/file'), chip('@C:/file'), chip('@~/file'), chip('@dsh-session:id', 'session'), chip('@relative', 'file', 'other'), { type: 'text', text: '@relative' });
  assert.equal(rebaseWorkspaceReferences(saved, undefined), saved);
});

test('源目录未知、不可表示的路径、损坏投影都保留原草稿并拒绝交接', () => {
  const saved = draft(chip('@same.txt'));
  for (const cwd of [undefined, '', 'relative', 'C:relative', '/bad"root']) assert.throws(() => rebaseWorkspaceReferences(saved, cwd, project));
  assert.throws(() => rebaseWorkspaceReferences(saved, '/source'), /引用/);
  assert.throws(() => rebaseWorkspaceReferences({ ...saved, text: '不同文字' }, '/source', project), /引用/);
  assert.equal(saved.editor.root.children[0].ref, '@same.txt');
});
