// 旧 Chromium 把自定义协议的 authority 当成路径，原资源插件因此找不到 provider。
// 仅在实际解析不符合契约时使用现有 core-js；保留现代引擎及原生 blob URL 方法。
module.exports = function installRemoteUrl() {
  if (new URL('dsh-resource://file/session/test/a.txt').hostname === 'file') return;
  require('core-js/configurator')({ usePolyfill: ['URL'] });
  require('core-js/actual/url/index.js');
};
