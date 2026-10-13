import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

/** 在手机构建目录派生原投影，保持上游参考只读、同一节点与插件注册契约。 */
export function remoteConversationSources(root, { upstream = resolve(root, '../deepseek-harness'), generated = resolve(root, 'artifacts/source'), nativeNavigation = false } = {}) {
  const base = resolve(upstream, 'packages/client/ui-chat/src/client/conversation-nodes');
  const output = resolve(generated, 'conversation');
  const files = ['register.ts', 'chat-snapshot-builder.ts', 'turn-navigation.ts'];
  const aliases = {};
  for (const file of files) {
    let text = readFileSync(resolve(base, file), 'utf8');
    // 新版已经重写增量导航；候选先使用原实现，不在未经验证的结构上套旧性能补丁。
    if (file === 'chat-snapshot-builder.ts' && !nativeNavigation) {
      // 只复用内容和成员顺序都未变化的轮次；replace 仍完整重建，不能跨历史窗口猜测。
      const edits = [
        ['  private byTurn = new Map<number, TurnNavigationItem>()',
          '  private byTurn = new Map<number, TurnNavigationItem>()\n  private keysByTurn = new Map<number, readonly string[]>()'],
        ['    const next: TurnNavigationItem[] = []\n    const byTurn = new Map<number, TurnNavigationItem>()',
          '    const next: TurnNavigationItem[] = []\n    const keysByTurn = new Map<number, readonly string[]>()\n    const byTurn = new Map<number, TurnNavigationItem>()'],
        ['    nodes: ChatNodeStore,\n  ): void {\n    const next: TurnNavigationItem[] = []',
          '    nodes: ChatNodeStore,\n    dirtyTurns?: ReadonlySet<number>,\n  ): void {\n    const next: TurnNavigationItem[] = []'],
        ['      const derived = turnNavigationItem(turn, locations, nodes)\n      if (derived === undefined) continue\n      const previous = this.byTurn.get(turn)',
          `      const previous = this.byTurn.get(turn)
      const keys = locations.getTurn(turn)
      const reusable = dirtyTurns !== undefined && !dirtyTurns.has(turn)
        && keys === this.keysByTurn.get(turn) && previous !== undefined
      const derived = reusable ? previous : turnNavigationItem(turn, locations, nodes)
      if (derived === undefined) continue
      keysByTurn.set(turn, keys)`],
        ['    this.byTurn = byTurn', '    this.byTurn = byTurn\n    this.keysByTurn = keysByTurn'],
        ['    const processTurns = new Set<number>()', '    const processTurns = new Set<number>()\n    const navigationTurns = new Set<number>()'],
        ['      const previous = this.store.get(node.key)\n      const nodeStructural',
          `      const previous = this.store.get(node.key)
      const oldTurn = previous === undefined ? undefined : locationCoordinates(previous.location).turn
      const newTurn = locationCoordinates(node.location).turn
      if (oldTurn !== undefined) navigationTurns.add(oldTurn)
      if (newTurn !== undefined) navigationTurns.add(newTurn)
      const nodeStructural`],
        ['      this.navigation.rebuild(input.timeline, this.locations, this.store)',
          '      this.navigation.rebuild(input.timeline, this.locations, this.store, navigationTurns)'],
      ];
      for (const [anchor, replacement] of edits) {
        // 上游使用 CRLF 时仍按同一明确锚点检查，避免补丁静默漏用。
        text = text.replaceAll('\r\n', '\n');
        if (text.split(anchor).length !== 2) throw new Error(`Conversation source changed: ${file}: ${anchor}`);
        text = text.replace(anchor, replacement);
      }
    }
    if (file === 'turn-navigation.ts' && !nativeNavigation) {
      for (const [name, kind] of [['promptText', 'user'], ['responseText', 'assistant-step']]) {
        const anchor = `function ${name}(node: ChatNode): string {`;
        if (text.split(anchor).length !== 2) throw new Error(`Conversation source changed: ${file}: ${name}`);
        text = text.replace(anchor, `function uncached_${name}(node: ChatNode): string {`);
        // 原store按节点引用发布变化。弱引用只保存短摘要，节点移除后不会保留整份历史。
        text += `\nconst ${name}Cache = new WeakMap<ChatNode, string>()
function ${name}(node: ChatNode): string {
  if (node.kind !== '${kind}') return ''
  const cached = ${name}Cache.get(node)
  if (cached !== undefined) return cached
  const text = uncached_${name}(node)
  ${name}Cache.set(node, text)
  return text
}\n`;
      }
    }
    text = text.replace(/(from\s+['"])(\.[^'"]+)(['"])/g, (_match, before, path, after) => {
      const local = path.startsWith('./') && files.includes(path.slice(2));
      return before + (local ? `@dshm/conversation/${path.slice(2)}` : resolve(base, path).replaceAll('\\', '/')) + after;
    });
    const target = resolve(output, file);
    mkdirSync(dirname(target), { recursive: true });
    const source = '// Generated DSHM source adapter; see scripts/remote-conversation-sources.mjs.\n' + text;
    let previous;
    try { previous = readFileSync(target, 'utf8'); } catch {}
    if (previous !== source) writeFileSync(target, source);
    aliases[`@dshm/conversation/${file}`] = target;
  }
  return aliases;
}
