import { createHash } from 'node:crypto';

/** 构建和预装使用同一包契约；手机仍会独立复核，不信任构建标记。 */
export function validatePluginPackage(bytes) {
  if (Buffer.byteLength(bytes) > 2 * 1024 * 1024) throw Error('plugin_package_too_large');
  const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  const fields = ['schema','id','name','version','description','apiVersion','surface','code','sha256'];
  if (!data || Object.keys(data).sort().join() !== fields.sort().join()
    || !fields.filter(key => !['schema','apiVersion'].includes(key)).every(key => typeof data[key] === 'string')
    || data.schema !== 1 || data.apiVersion !== 1 || data.surface !== 'dshm.remote.home') throw Error('plugin_package_invalid');
  if (!/^(@[a-z0-9._-]+\/)?[a-z0-9][a-z0-9._-]{0,127}$/.test(data.id) || data.id.length > 260
    || ['input','theme','rendering'].includes(data.id) || data.version.length > 80
    || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(data.version)) throw Error('plugin_package_invalid');
  for (const [key, max] of [['name',80],['description',500]]) if (!data[key].trim() || data[key].length > max || /[\x00-\x1f]/.test(data[key])) throw Error('plugin_package_invalid');
  if (!data.code.trim() || data.code.includes('\0') || createHash('sha256').update(data.code).digest('hex') !== data.sha256) throw Error('plugin_package_integrity');
  return data;
}
