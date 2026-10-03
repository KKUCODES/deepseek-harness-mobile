import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { operationSchema } from '../../backend/packages/protocol/dist/index.js';

test('Android 原生桥覆盖共享协议入口，仅 Key 写入保留在原生密码窗口', async () => {
  const source = await readFile(new URL('../android/app/src/main/java/dev/dshmobile/validation/RemoteBridge.kt', import.meta.url), 'utf8');
  const declaration = source.match(/private val METHODS = setOf\(([\s\S]*?)\)/)?.[1];
  assert.ok(declaration);
  const allowed = [...declaration.matchAll(/"([^"]+)"/g)].map(match => match[1]).sort();
  // 同一方法的不同请求形态可组成嵌套union；仍核对全部叶子，不能跳过无shape的分支。
  const readMethods = schema => {
    if (schema.options) return schema.options.flatMap(readMethods);
    assert.ok(schema.shape?.method, '每个协议叶子都必须声明method');
    return schema.shape.method.options ?? [schema.shape.method.value];
  };
  const methods = [...new Set(readMethods(operationSchema))].filter(method => method !== 'remote.keyWrite').sort();
  assert.deepEqual(allowed, methods);
});
