import semver from 'semver';

// 版本界限只选择契约族；能力和模块结构仍须在实际连接时验证。
export const remoteDshRange = '>=0.2.0-rc.2 <0.3.0-0';
export const isProfileDshVersion = version => typeof version === 'string' && semver.valid(version) !== null
  && semver.satisfies(version, remoteDshRange, { includePrerelease: true });

export const acceptsRemoteDshVersion = (sdkVersion, hostVersion) => typeof sdkVersion === 'string'
  && typeof hostVersion === 'string' && semver.valid(sdkVersion) !== null && semver.valid(hostVersion) !== null
  && (hostVersion === sdkVersion
    || (semver.satisfies(sdkVersion, '>=0.2.1-alpha.2 <0.3.0-0', { includePrerelease: true }) && isProfileDshVersion(hostVersion)));

/** 手机核心读取所需的公开能力；可选功能仍按各自协商项决定，不扩大设备权限。 */
export function assertRemoteCapabilities(value) {
  if (value?.transport !== 2) throw Error('unsupported_remote_version');
  const contains = (values, required) => Array.isArray(values) && required.every(item => values.includes(item));
  if (!contains(value.channels, ['rpc', 'stream', 'graph', 'bundle'])
    || !contains(value.endpoints?.calls, ['session/list', 'session/page'])
    || !contains(value.endpoints?.streams, ['$events', 'session/follow', 'workspace/follow']))
    throw Error('unsupported_remote_capabilities');
}
