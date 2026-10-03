const originals = new WeakMap();

/** 手机包装只改变呈现；错误归属仍使用插件实际登记的组件身份。 */
export function rememberComponentAdapter(adapter, component) {
  if (adapter !== component) originals.set(adapter, originalComponent(component));
  return adapter;
}

export function originalComponent(component) {
  return originals.get(component) ?? component;
}
