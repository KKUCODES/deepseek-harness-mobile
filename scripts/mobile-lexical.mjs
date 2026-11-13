/** The editor and DSH's state helpers must use the same Lexical module instance. */
export function mobileLexical(root) {
  const resolving = Symbol('resolve from the mobile workspace');
  return {
    name: 'mobile-lexical',
    setup(builder) {
      builder.onResolve({ filter: /^(?:lexical|@lexical\/(?:history|plain-text|text|utils))$/ }, args => {
        if (args.pluginData === resolving) return;
        return builder.resolve(args.path, { kind: 'import-statement', resolveDir: root, pluginData: resolving });
      });
    },
  };
}
