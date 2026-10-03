import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile, writeFile } from 'node:fs/promises';

export const inject = ['settings', 'credentials', 'web'];
const root = 'Q:/Tanxian/LToys/dsh-mobile/dsh-mobile/artifacts/';
const namespaces = ['llm-deepseek', 'web-search-deepseek'];
const testKeys = ['dshmsharedtestfirst', 'dshmsharedtestsecond'];
const query = 'DSHM shared credential transport verification';

// 只验证正式入口的设置和传输。端点固定返回 401，不制造搜索结果或模型回复。
export async function apply(ctx) {
  const id = randomUUID(), ref = `DSHM_SHARED_TEST_${id.replaceAll('-', '').toUpperCase()}`;
  const describe = ns => ctx.settings.describe({ redactSecrets: true }).find(row => row.ns === ns);
  const resolved = ns => ctx.settings.get(ns);
  let prepared = false, cleaned = false, stopped = false, last, active = Promise.resolve();
  const requests = [], outcomes = [];
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) { body += chunk; if (body.length > 65536) { res.writeHead(413).end(); return; } }
    let value;
    try { value = JSON.parse(body); } catch {}
    requests.push({ method: req.method, path: req.url,
      testKeyIndex: testKeys.findIndex(key => req.headers['x-api-key'] === key || req.headers.authorization === `Bearer ${key}`),
      version: req.headers['anthropic-version'], model: value?.model,
      queryMatches: value?.messages?.[0]?.content?.[0]?.text === `Perform a web search for the query: ${query}`,
      toolType: value?.tools?.[0]?.type, maxUses: value?.tools?.[0]?.max_uses });
    res.writeHead(401, { 'content-type': 'application/json' }).end(JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'Dedicated transport verification endpoint' } }));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const endpoint = `http://127.0.0.1:${server.address().port}/anthropic/v1`;
  const report = async (command, failure) => writeFile(`${root}shared-key-host.json`, JSON.stringify({
    fixtureVersion: '0.0.3', id, ref, endpoint, prepared, cleaned, command, at: new Date().toISOString(), requests, outcomes,
    configured: (await ctx.credentials.describe(ref)).configured,
    refsMatch: namespaces.every(ns => resolved(ns)?.apiKeyEnv === ref),
    refsRestored: namespaces.every(ns => (resolved(ns)?.apiKeyEnv ?? 'DEEPSEEK_API_KEY') === 'DEEPSEEK_API_KEY' && !Object.hasOwn(describe(ns)?.user ?? {}, 'apiKeyEnv')),
    searchAddressSaved: resolved(namespaces[1])?.baseURL === endpoint,
    searchAddressInherited: !Object.hasOwn(describe(namespaces[1])?.user ?? {}, 'baseURL'),
    ...(failure ? { failure } : {}),
  }, null, 2));
  const mutate = (ns, operations) => ctx.settings.mutate(ns, operations, describe(ns).revision);
  const cleanup = async () => {
    if (!prepared || cleaned) return;
    // 不覆盖验收期间的并发编辑；仅删除本夹具创建的引用和手机保存的唯一测试地址。
    for (const ns of namespaces) assert.ok(resolved(ns)?.apiKeyEnv === ref
      || (resolved(ns)?.apiKeyEnv ?? 'DEEPSEEK_API_KEY') === 'DEEPSEEK_API_KEY' && !Object.hasOwn(describe(ns)?.user ?? {}, 'apiKeyEnv'));
    const address = describe(namespaces[1]).user?.baseURL;
    assert.ok(address === undefined || address === endpoint);
    if (address !== undefined) await mutate(namespaces[1], [{ op: 'unset', path: ['baseURL'] }]);
    for (const ns of namespaces) if (resolved(ns)?.apiKeyEnv === ref) await mutate(ns, [{ op: 'unset', path: ['apiKeyEnv'] }]);
    await ctx.credentials.unset(ref);
    cleaned = true;
  };
  const run = async action => {
    if (action === 'prepare') {
      assert.equal(prepared, false);
      // 只接受原默认继承；有自定义配置则停止，不猜测如何恢复用户配置。
      for (const ns of namespaces) {
        const d = describe(ns); assert.ok(d); assert.equal(d.applies, 'live');
        assert.equal(resolved(ns)?.apiKeyEnv ?? 'DEEPSEEK_API_KEY', 'DEEPSEEK_API_KEY');
        assert.equal(Object.hasOwn(d.user ?? {}, 'apiKeyEnv'), false);
        assert.equal(!!resolved(ns)?.apiKey, false);
      }
      assert.equal(Object.hasOwn(describe(namespaces[1]).user ?? {}, 'baseURL'), false);
      assert.equal((await ctx.credentials.describe(ref)).configured, false);
      prepared = true;
      for (const ns of namespaces) await mutate(ns, [{ op: 'set', path: ['apiKeyEnv'], value: ref }]);
    } else if (action === 'search') {
      assert.ok(prepared && !cleaned);
      assert.ok(namespaces.every(ns => resolved(ns)?.apiKeyEnv === ref));
      assert.equal(resolved(namespaces[1])?.baseURL, endpoint);
      const before = requests.length;
      try {
        await ctx.web.search({ query, maxResults: 1 }, AbortSignal.timeout(5000));
        outcomes.push({ rejected: false, requestCount: requests.length - before });
      } catch (error) {
        outcomes.push({ rejected: true, code: typeof error.code === 'string' ? error.code : 'unknown', requestCount: requests.length - before });
      }
    } else if (action === 'cleanup') await cleanup();
    else assert.equal(action, 'inspect');
  };
  const tick = async () => {
    let c;
    try { c = JSON.parse(await readFile(`${root}shared-key-command.json`, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT' || error instanceof SyntaxError) return; throw error; }
    if (c.id !== id || c.sequence === last) return;
    last = c.sequence;
    try { await run(c.action); await report(last); }
    catch { await report(last, 'Dedicated verification action failed; inspect before retry'); }
  };
  await report('ready');
  const timer = setInterval(() => { if (!stopped) active = active.then(tick).catch(() => {}); }, 150);
  ctx.effect(() => async () => {
    stopped = true; clearInterval(timer); await active;
    try { await cleanup(); await report('disposed'); }
    finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  });
}
