import { createServer, request } from 'node:http';
import { exportPreviewHistory, parsePreviewHistory } from '../docs/design/ordinary-preview/settings-demo.mjs';

// 浏览器直接下载 HTTP 附件；服务仅处理演示备份，不保存上传内容或访问生产数据库。
export function createPreviewServer(buildPort) {
  return createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/preview-history-export') {
      try {
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 4_000_000) { res.writeHead(413).end('Preview export is too large.'); return; }
          chunks.push(chunk);
        }
        const form = new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
        const history = parsePreviewHistory(form.get('history') || '');
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="dshm-preview-history.json"', 'Cache-Control': 'no-store' });
        res.end(exportPreviewHistory(history));
      } catch {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }).end('预览备份无效，未生成下载。请返回并重新导出。');
      }
      return;
    }
    const proxy = request({ hostname: '127.0.0.1', port: buildPort, path: req.url, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${buildPort}` } }, upstream => {
      res.writeHead(upstream.statusCode || 502, upstream.headers);
      upstream.pipe(res);
    });
    proxy.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end('Preview build server unavailable.'); });
    req.pipe(proxy);
  });
}
