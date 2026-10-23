/** 版本范围内仍可能禁用或替换加载器；在导入业务模块前核验公共接口。 */
export function assertRemoteModuleSystem(value) {
  if (typeof value?.import !== 'function' || typeof value?.entries?.start !== 'function'
    || !Array.isArray(value?.manifest?.plugins)) throw Error('unsupported_dsh_capabilities');
}
