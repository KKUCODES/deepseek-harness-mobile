import { createServer } from 'node:http';
import { gunzipSync } from 'node:zlib';
import { writeFile } from 'node:fs/promises';

// 本机真实 UI 验收使用。收到的正文丢弃，只保存事件类型/序号，不转发或保存完整日志。
const report = { startedAt: new Date().toISOString(), endpoint: 'http://127.0.0.1:18789/v1/logs', requests: 0, events: [] };
const server = createServer(async (request, response) => {
  if (request.method !== 'POST' || request.url !== '/v1/logs') { response.writeHead(404).end(); return; }
  try {
    const chunks = []; let size = 0;
    for await (const chunk of request) { size += chunk.length; if (size > 32 * 1024 * 1024) throw Error('too-large'); chunks.push(chunk); }
    const bytes = Buffer.concat(chunks), raw = request.headers['content-encoding'] === 'gzip' ? gunzipSync(bytes, { maxOutputLength: 64 * 1024 * 1024 }) : bytes;
    const capture = JSON.parse(raw.toString());
    const events = capture.resourceLogs.flatMap(resource => resource.scopeLogs.flatMap(scope => scope.logRecords.map(record => {
      const value = key => record.attributes.find(item => item.key === key)?.value;
      return { sessionId: value('session.id')?.stringValue, seq: Number(value('event.seq')?.intValue), type: value('event.type')?.stringValue };
    })));
    report.events.push(...events); report.requests++;
    await writeFile('artifacts/feedback-local-collector.json', JSON.stringify(report, null, 2));
    response.writeHead(200, { 'content-type': 'application/json' }).end('{}');
  } catch { response.writeHead(400).end('{}'); }
});
server.listen(18789, '127.0.0.1', () => console.log('Local feedback collector listening on 127.0.0.1:18789'));
