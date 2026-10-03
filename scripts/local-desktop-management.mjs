import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// 使用本轮已启动DSH的正常登录交换；凭据仅在内存发送给固定本机地址，不输出或落盘。
export async function localDesktopManagement() {
  const origin = 'http://127.0.0.1:3080';
  const log = await readFile(process.env.DSHM_DESKTOP_LOG ?? 'artifacts/new-chat-restored-dsh.stdout.log', 'utf8');
  const urls = [...new Set(log.match(/http:\/\/127\.0\.0\.1:3080\/\?token=[A-Za-z0-9_-]+/g))];
  assert.equal(urls.length, 1, 'Expected one launch URL in the known current-process log');
  const response = await fetch(urls[0], { redirect: 'manual', signal: AbortSignal.timeout(5000) });
  assert.equal(response.status, 303, 'DSH must accept its current launch token');
  assert.equal(response.headers.get('location'), '/', 'Unexpected login redirect');
  const cookie = response.headers.get('set-cookie')?.split(';', 1)[0];
  assert.ok(cookie, 'Missing authenticated session');
  return async body => {
    const result = await fetch(`${origin}/api/dsh-mobile`, {
      method: body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(20000),
      headers: { cookie, origin, 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    assert.ok(result.ok, `Desktop management HTTP ${result.status}`);
    return result.json();
  };
}
