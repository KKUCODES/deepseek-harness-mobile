import { deflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';

// 纯色测试图片和公开测试文字；不使用用户照片或文件。
const crc32 = bytes => { let crc = -1; for (const byte of bytes) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); } return (crc ^ -1) >>> 0; };
function chunk(type, content) {
  const body = Buffer.concat([Buffer.from(type), content]);
  const length = Buffer.alloc(4); length.writeUInt32BE(content.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}
const header = Buffer.alloc(13); header.writeUInt32BE(256, 0); header.writeUInt32BE(256, 4); header[8] = 8; header[9] = 2;
const pixels = Buffer.alloc((256 * 3 + 1) * 256);
for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) pixels[y * 769 + 1 + x * 3] = 255;
await mkdir('artifacts/attachment-fixtures', { recursive: true });
await writeFile('artifacts/attachment-fixtures/dshm-red.png', Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]));
await writeFile('artifacts/attachment-fixtures/dshm-test.txt', 'This is an automated DSHM attachment test. The code written only in this file is DSHM_FILE_CONTENT_8371.');
