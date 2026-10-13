import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

/** 独立 UID 实际领取系统分享，只安装本次自有接收器并在 finally 卸载。 */
export async function officialShareRecipient({ device, packageName, evidence }) {
  assert.equal(packageName, 'dev.dshmobile.validation.officialtest');
  const receiver = packageName + '.test';
  const root = resolve(import.meta.dirname, '../..');
  const build = JSON.parse(await readFile(resolve(root, 'artifacts/official-alpha2-share-receiver/current.json'), 'utf8'));
  assert.equal(build.packageName, receiver);
  assert.equal(createHash('sha256').update(await readFile(build.apk)).digest('hex'), build.sha256);
  for (const input of build.inputs) assert.equal(createHash('sha256').update(await readFile(input.path)).digest('hex'), input.sha256);
  const packages = (await device.shell('pm list packages')).toString().split(/\r?\n/);
  assert.ok(!packages.includes('package:' + receiver), 'Refusing to replace an existing receiver');
  const adb = process.env.DSHM_ADB_PATH;
  assert.ok(adb);
  const execute = promisify(execFile);
  let installed = false;
  const cleanup = async () => {
    if (!installed) return;
    const result = await execute(adb, ['-s', device.serial(), 'uninstall', receiver], { cwd: root, windowsHide: true });
    assert.match(result.stdout, /Success/);
    installed = false;
    assert.ok(!(await device.shell('pm list packages')).toString().split(/\r?\n/).includes('package:' + receiver));
  };
  try {
    const result = await execute(adb, ['-s', device.serial(), 'install', '-t', build.apk], { cwd: root, windowsHide: true });
    assert.match(result.stdout, /Success/); installed = true;
    return {
      cleanup,
      receive: async seed => {
        let matches = [];
        for (let attempt = 0; attempt < 8; attempt++) {
          await device.shell('uiautomator dump /data/local/tmp/dshm-official-recipient.xml');
          const xml = (await device.shell('cat /data/local/tmp/dshm-official-recipient.xml')).toString();
          const nodes = [...xml.matchAll(/<node\s+([^>]+)>/g)].map(match => Object.fromEntries(
            [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(value => [value[1], value[2]])));
          matches = nodes.filter(node => node.text === 'DSHM 官方分享验收');
          if (matches.length) break;
          // 多个已有 App 占满首行时，新接收器在折叠分享面板的屏幕外；展开实际系统面板。
          const sheet = nodes.find(node => node['resource-id'] === 'android:id/contentPanel');
          if (sheet && nodes.some(node => node['resource-id'] === 'android:id/chooser_header')) {
            const [left, top, right, bottom] = sheet.bounds.match(/\d+/g).map(Number);
            const x = Math.floor((left + right) / 2), height = bottom - top;
            await device.shell(`input swipe ${x} ${Math.floor(top + height * .8)} ${x} ${Math.floor(top + height * .2)} 350`);
          }
        }
        assert.equal(matches.length, 1, 'Expected actual Android chooser recipient');
        await writeFile(resolve(evidence, 'file-share-recipient.png'), await device.screenshot());
        const points = matches[0].bounds.match(/\d+/g).map(Number);
        await device.shell(`input tap ${Math.floor((points[0] + points[2]) / 2)} ${Math.floor((points[1] + points[3]) / 2)}`);
        let received;
        for (let attempt = 0; attempt < 40; attempt++) {
          const raw = (await device.shell(`run-as ${receiver} cat files/remote-share-result.json`)).toString();
          try { received = JSON.parse(raw); } catch { }
          if (received) break;
          await new Promise(done => setTimeout(done, 250));
        }
        assert.ok(received); assert.equal(received.error, undefined);
        assert.equal(received.bytes, seed.bytes); assert.equal(received.sha256, seed.sha256);
        assert.equal(received.name, seed.filename);
        assert.equal(received.scheme, 'content'); assert.equal(received.authority, packageName + '.remote.files');
        assert.equal(received.flags & 1, 1); assert.equal(received.flags & 2, 0);
        assert.equal(received.writeRejected, true); assert.equal(received.unrelatedRejected, true);
        assert.notEqual(received.uid, Number((await device.shell(`run-as ${packageName} id -u`)).toString().trim()));
        return { actualSystemSheet: true, recipientDeliveryVerified: true, independentUid: true,
          readOnly: true, unrelatedUriDenied: true, received, receiverBuild: build.run };
      },
    };
  } catch (error) { await cleanup(); throw error; }
}
