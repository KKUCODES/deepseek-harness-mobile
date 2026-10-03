import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
const require = createRequire(new URL('../../plugin/package.json', import.meta.url));
const qrRequire = createRequire(require.resolve('qrcode'));
const QRCode = require('qrcode'), { PNG } = qrRequire('pngjs');
// 官方场景宏停止时海报偏左；将测试码放在海报右侧，保证整个码位于取景框内。
const poster = new PNG({ width: 600, height: 600 }); poster.data.fill(255);
const qr = PNG.sync.read(await QRCode.toBuffer(`http://127.0.0.1:8787/pair#key=${'A'.repeat(43)}`, { width: 240, margin: 4 }));
for (let y = 0; y < qr.height; y++) qr.data.copy(poster.data, ((y + 180) * 600 + 350) * 4, y * qr.width * 4, (y + 1) * qr.width * 4);
await writeFile('artifacts/dshm-camera-room-poster.png', PNG.sync.write(poster));
