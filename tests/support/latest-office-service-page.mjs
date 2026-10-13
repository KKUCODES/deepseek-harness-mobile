import assert from 'node:assert/strict';
import { assertCachedOfficeRead } from './latest-office-observation.mjs';

/** 原服务实际卸载/重建；通过原文件入口和重试按钮检查原缓存，不替换转换结果。 */
export async function verifyOfficeServiceCache(page, panel, name, observation, close, verify) {
  const before = await observation.counts(name);
  let restored = false;
  try {
    const disabled = await verify('office-service-disable');
    assert.equal(before.sourceGenerations.at(-1), disabled.generation);
    assert.equal(before.sourceVersions.at(-1), disabled.metadata.version);
    await page.locator('[data-files-entry="file"]').getByRole('button', { name, exact: true }).click();
    const failure = panel.locator('[data-textpreview-failed="gateway/definition-unavailable"]');
    await failure.waitFor();
    assert.equal(await panel.locator('[data-pdf-preview] canvas').count(), 0, '服务关闭后不能显示缓存中的旧 PDF');
    const unavailable = await observation.counts(name);
    assert.equal(unavailable.conversions, before.conversions);
    assert.ok(unavailable.generations > before.generations);

    const enabled = await verify('office-service-enable');
    restored = true;
    assert.notEqual(enabled.generation, disabled.generation);
    assert.deepEqual(enabled.metadata, disabled.metadata, '只重建服务，源文件身份与版本保持');
    await failure.getByRole('button', { name: '重试', exact: true }).click();
    await panel.locator('[data-pdf-preview] canvas').first().waitFor({ timeout: 60000 });
    await failure.waitFor({ state: 'detached' });
    const reloaded = await observation.counts(name);
    assert.equal(reloaded.conversions, before.conversions + 1, '新服务代次必须重新读取转换流');
    assert.ok(reloaded.authorizations > unavailable.authorizations);
    assert.ok(reloaded.generations > unavailable.generations);
    assert.equal(reloaded.sourceGenerations.at(-1), enabled.generation);
    assert.equal(reloaded.sourceVersions.at(-1), disabled.metadata.version);
    await close();

    await page.locator('[data-files-entry="file"]').getByRole('button', { name, exact: true }).click();
    await panel.locator('[data-pdf-preview] canvas').first().waitFor({ timeout: 60000 });
    await close();
    const cachedAgain = await observation.counts(name);
    assertCachedOfficeRead(reloaded, cachedAgain);
    return { before, unavailable, reloaded, cachedAgain, source: disabled.metadata,
      oldGeneration: disabled.generation, newGeneration: enabled.generation,
      disabledServiceRejectedCachedPdf: true, retryReadNewGeneration: true, newGenerationReusedWithAuthorization: true };
  } finally {
    if (!restored) await verify('office-service-enable');
  }
}
