import assert from 'node:assert/strict';

export async function pickerNodes(device) {
  await device.shell('uiautomator dump /data/local/tmp/dshm-picker-test.xml');
  const xml = (await device.shell('cat /data/local/tmp/dshm-picker-test.xml')).toString();
  return [...xml.matchAll(/<node\s+([^>]+)>/g)].map(match => Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(value => [value[1], value[2]])))
    .filter(node => node.package === 'com.android.documentsui');
}
export async function tapPickerNode(device, predicate) {
  const nodes = (await pickerNodes(device)).filter(predicate);
  assert.equal(nodes.length, 1, 'Expected exactly one system picker control');
  const points = nodes[0].bounds.match(/\d+/g).map(Number);
  // 使用已观测控件的中心点，避免依赖另装的 Playwright Android 输入驱动。
  await device.shell(`input tap ${Math.floor((points[0] + points[2]) / 2)} ${Math.floor((points[1] + points[3]) / 2)}`);
}
export async function chooseDownload(device, filename) {
  assert.match(filename, /^(dshm-|DSHM-)[\w.-]+$/);
  const isFile = node => node.text === filename || node['content-desc']?.startsWith(`${filename},`);
  let nodes = await pickerNodes(device);
  if (!nodes.some(isFile)) {
    await tapPickerNode(device, node => node['content-desc'] === '显示根目录');
    // 同时位于下载目录时，面包屑也叫“下载”；只点击侧栏的目录项。
    await tapPickerNode(device, node => node.text === '下载' && node['resource-id'] === 'android:id/title');
  }
  await tapPickerNode(device, isFile);
}
