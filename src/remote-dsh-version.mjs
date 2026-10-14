/** 只选择已审阅的 profile 契约，不按前缀接受未来 DSH。 */
export const isProfileDshVersion = version => ['0.2.0-rc.2', '0.2.1-alpha.1', '0.2.1-alpha.2'].includes(version);

/** alpha.2 客户端复用已核验的 rc.2 契约；旧 SDK 仍只连接自身版本。 */
export const acceptsRemoteDshVersion = (sdkVersion, hostVersion) => hostVersion === sdkVersion
  || (sdkVersion === '0.2.1-alpha.2' && hostVersion === '0.2.0-rc.2');
