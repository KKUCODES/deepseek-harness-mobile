/** 脚本按代次登记；原动态运行器在同一同步调用中 invalidate 后登记内存工厂。 */
export function remoteModuleRegistration({ target, signal, generation, currentScript = () => document.currentScript }) {
  const pending = new Map();
  const facade = { load(registration) {
    if (signal.aborted) return;
    const script = currentScript();
    if (script) {
      if (script.dataset.dshmGeneration === generation) target.load(registration);
      return;
    }
    if (!pending.delete(registration.id)) return;
    target.load(registration);
  } };
  return { facade, bind(modules) {
    const invalidate = modules.invalidate.bind(modules);
    modules.invalidate = (id, ...args) => {
      const result = invalidate(id, ...args);
      if (!signal.aborted && typeof id === 'string' && id.startsWith('dyn/')) {
        const token = {};
        pending.set(id, token);
        // 授权只属于这个模块表的同步注册，不能留给未来回调或另一代运行器。
        queueMicrotask(() => { if (pending.get(id) === token) pending.delete(id); });
      }
      return result;
    };
  } };
}
