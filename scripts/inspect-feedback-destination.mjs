import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

// 只读取配置模板；该子进程不继承另一个终端中已运行DSH的环境，不能证明实际上传目的地。
// 完整配置只留在子进程内存，不输出凭据或其他插件设置。
const runtime = 'F:/Program Files/deepseek-harness';
const require = createRequire(import.meta.url);
const { parse } = require(`${runtime}/node_modules/.pnpm/yaml@2.9.0/node_modules/yaml`);
const result = spawnSync(process.execPath, ['apps/cli/lib/bin.js', '--profile', 'web', '--dump-config'], { cwd: runtime, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
assert.equal(result.status, 0, '配置解析失败；不输出完整配置');
const tree = parse(result.stdout, { customTags: [{ tag: 'tag:yaml.org,2002:js', resolve: expression => ({ expression }) }] });
const rows = [];
function walk(value) {
  if (!value || typeof value !== 'object') return;
  if (value.name === '@deepseek-ai/dsh-session-telemetry-otel') rows.push(value);
  for (const item of Object.values(value)) walk(item);
}
walk(tree); assert.equal(rows.length, 1);
const row = rows[0], url = row.config.exporter.url, mode = row.config.mode;
assert.equal(url.expression, "process.env.DSH_TELEMETRY_OTLP_URL ?? 'https://harness-telemetry.deepseeksvc.com/v1/logs'");
assert.equal(mode.expression, "process.env.DSH_TELEMETRY_MODE || 'FEEDBACK_ONLY'");
console.log(JSON.stringify({ scope: 'configuration-template', runningProcessVerified: false,
  endpointExpression: url.expression, modeExpression: mode.expression,
  note: '仅核对模板默认值；实际DSH进程的环境和生效目的地须独立确认，不能据此允许反馈写入。' }));
