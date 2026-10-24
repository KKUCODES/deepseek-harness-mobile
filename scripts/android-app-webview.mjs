import assert from 'node:assert/strict';

/** Playwright 的包名探测用 grep PID，会误匹配短 PID；用系统 pidof 的精确身份选择。 */
export async function androidAppWebView(device, packageName = 'dev.dshmobile.validation') {
  assert.match(packageName, /^dev\.dshmobile\.validation(?:\.(?:pairingtest|latesttest|latestofficetest|latestcordispeer|latestfinaltest|officialtest|toolstyletest|rc21test|compatibilitytest|updaterestarttest))?$/);
  const process = (await device.shell(`pidof ${packageName}`)).toString().trim();
  assert.match(process, /^[1-9]\d*$/, 'DSHM 主进程必须已经启动且唯一');
  const pid = Number(process);
  return device.webViews().find(view => view.pid() === pid)
    ?? device.waitForEvent('webview', { predicate: view => view.pid() === pid });
}
