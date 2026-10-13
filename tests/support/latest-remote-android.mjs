import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { _android } from 'playwright';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { androidAppWebView } from '../../scripts/android-app-webview.mjs';
import { latestFinalScope, latestRemoteAndroidPackage } from '../../scripts/latest-final-test-scope.mjs';
import { verifyLockedPreset, verifyBlankPreset, verifyPresetDefault, verifyPresetDirectory, verifyPresetManagement, verifyCodingTools, verifyPresetCreator } from './latest-agent-preset-page.mjs';
import { verifyProviderManagement } from './latest-provider-page.mjs';
import { verifyNativeModelProbe, verifyNativeProviderKey } from './latest-native-model-probe.mjs';
import { verifyModelCatalogManagement } from './latest-model-catalog-page.mjs';
import { verifyFileRefresh } from './latest-file-page.mjs';
import { verifyLatestDesktopAppsPage } from './latest-desktop-apps-page.mjs';
import { verifyLatestDesktopRevocationPage } from './latest-desktop-revocation-page.mjs';
import { verifyOfficeAuthorizationLoss } from './latest-office-authority-page.mjs';
import { verifyOfficeEngineRevocation } from './latest-office-engine-page.mjs';
import { verifyOfficeSessionOwnership } from './latest-office-session-page.mjs';
import { verifyOfficeSessionInFlight } from './latest-office-session-inflight-page.mjs';
import { verifyOfficeFilePermission } from './latest-office-file-permission-page.mjs';
import { verifyLatestFileTransfers } from './latest-file-transfer-page.mjs';

/** 独立 Android UID 通过原生 DPoP、HTTP、WebSocket 和资源桥连接真实新版 Host。 */
export async function verifyLatestRemoteAndroid({ origin, pairLink, title, marker, nextModel, approve, revoke, changeOfficeManagement, verifyModel, mutateCordis, preset, verifyPreset, verifyDefault, verifyManagement, verifyCoding, verifyCreator, verifyProvider, verifyCatalog, verifyFiles, desktop }) {
  const finalScope = latestFinalScope();
  const packageName = latestRemoteAndroidPackage();
  const devices = await _android.devices({ omitDriverInstall: true });
  const officeRecovery = process.env.DSHM_LATEST_OFFICE_RECOVERY_CHECK === '1';
  const officeAuthority = process.env.DSHM_LATEST_OFFICE_AUTHORITY_CHECK === '1';
  const officeSession = process.env.DSHM_LATEST_OFFICE_SESSION_CHECK === '1';
  const officeSessionInFlight = process.env.DSHM_LATEST_OFFICE_SESSION_INFLIGHT_CHECK === '1';
  const officeSidebarInFlight = process.env.DSHM_LATEST_OFFICE_SIDEBAR_INFLIGHT_CHECK === '1';
  const officeFilePermission = process.env.DSHM_LATEST_OFFICE_FILE_PERMISSION_UI_CHECK === '1';
  const fileTransfers = process.env.DSHM_LATEST_FILE_TRANSFERS_CHECK === '1';
  const filePicker = process.env.DSHM_LATEST_FILE_PICKER_CHECK === '1';
  const fileWriteDeath = process.env.DSHM_LATEST_FILE_WRITE_DEATH_CHECK === '1';
  const fileShareDeath = process.env.DSHM_LATEST_FILE_SHARE_DEATH_CHECK === '1';
  const fileFormats = process.env.DSHM_LATEST_FILE_FORMATS_CHECK === '1';
  const fileFormatGroup = process.env.DSHM_LATEST_FILE_FORMATS_GROUP;
  assert.ok(!fileFormats || ['word-and-xlsx', 'xls-and-slides'].includes(fileFormatGroup));
  assert.ok(!fileFormats || (fileTransfers && !filePicker && !fileWriteDeath && !fileShareDeath));
  assert.ok(!fileShareDeath || (fileTransfers && !filePicker && !fileWriteDeath));
  assert.ok(!fileWriteDeath || (fileTransfers && !filePicker));
  assert.ok(!filePicker || fileTransfers);
  assert.ok(!fileTransfers || process.env.DSHM_LATEST_OFFICE_LIFETIME_CHECK === '1');
  const officeEngine = process.env.DSHM_LATEST_OFFICE_ENGINE_CHECK === '1';
  const officeMetadata = process.env.DSHM_LATEST_OFFICE_METADATA_CHECK === '1';
  assert.ok(!officeMetadata || (process.env.DSHM_LATEST_OFFICE_LIFETIME_CHECK === '1' && !officeEngine && !officeRecovery && !fileTransfers));
  assert.ok(!fileFormats || !officeEngine);
  const officeEngineShared = process.env.DSHM_LATEST_OFFICE_ENGINE_SHARED_CHECK === '1';
  const officeEngineJoinedCancel = process.env.DSHM_LATEST_OFFICE_ENGINE_JOINED_CANCEL_CHECK === '1';
  const officeEngineNetworkDrop = process.env.DSHM_LATEST_OFFICE_ENGINE_NETWORK_CHECK === '1';
  const officeEngineLifecycle = process.env.DSHM_LATEST_OFFICE_ENGINE_LIFECYCLE_CHECK === '1';
  assert.ok(!officeEngineLifecycle || officeEngine && !officeEngineJoinedCancel && !officeEngineNetworkDrop && !officeRecovery && !fileTransfers);
  assert.ok(!officeEngineNetworkDrop || officeEngine && !officeEngineShared && !officeRecovery && !fileTransfers);
  assert.ok(!officeEngineJoinedCancel || officeEngineShared);
  assert.ok(!officeEngineShared || officeEngine);
  assert.ok(!officeEngine || process.env.DSHM_LATEST_OFFICE_LIFETIME_CHECK === '1');
  const fileScope = officeRecovery || fileTransfers || officeEngine || officeMetadata;
  assert.ok(!officeFilePermission || officeRecovery);
  assert.ok(!officeSessionInFlight || officeSession);
  assert.ok(!officeSidebarInFlight || (officeSessionInFlight && desktop?.prepareSidebar));
  assert.ok(!officeSession || officeRecovery);
  assert.ok(!officeAuthority || officeRecovery);
  assert.ok(!officeRecovery || process.env.DSHM_LATEST_OFFICE_CANCEL_CHECK === '1');
  const device = devices.find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
  assert.ok(device, '必须显式选择当前授权的模拟器');
  // Office 异常专项不能清除正在等待用户配置 Key 的独立模型验收 App。
  const evidence = resolve(import.meta.dirname, '../../artifacts/latest-mobile-runtime',
    ...(finalScope ? [finalScope.reportName] : officeMetadata ? ['office-metadata-' + randomUUID()] : officeEngine ? ['office-engine-' + randomUUID()] : fileFormats ? ['file-formats-' + randomUUID()] : []));
  await mkdir(evidence, { recursive: true });
  const port = new URL(origin).port;
  assert.match(origin, /^http:\/\/127\.0\.0\.1:\d+$/);
  const adb = promisify(execFile), adbPath = process.env.DSHM_ADB_PATH;
  assert.ok(adbPath, '必须显式指定已核验的 adb 可执行文件');
  await adb(adbPath, ['-s', device.serial(), 'reverse', `tcp:${port}`, `tcp:${port}`], { windowsHide: true });
  const report = { at: new Date().toISOString(), serial: device.serial(), packageName, pageErrors: [], consoleErrors: [], inferenceVerified: false };
  if (finalScope) { report.scope = 'final-full-plugin-android-management'; report.run = finalScope.run; report.evidenceDirectory = evidence; }
  if (officeEngine) { report.scope = 'office-native-engine-cancellation'; report.evidenceDirectory = evidence; }
  if (officeMetadata) { report.scope = 'office-same-size-mtime-and-version-cache'; report.evidenceDirectory = evidence; }
  if (officeEngineShared) report.scope = 'office-native-engine-shared-reader-cancellation';
  if (officeEngineJoinedCancel) report.scope = 'office-native-engine-joined-reader-cancellation';
  if (officeEngineNetworkDrop) report.scope = 'office-native-engine-network-recovery';
  if (officeEngineLifecycle) report.scope = officeEngineShared ? 'office-native-engine-shared-service-and-revocation' : 'office-native-engine-service-and-revocation';
  if (officeRecovery) report.scope = 'office-network-recovery';
  if (officeAuthority) report.scope = 'office-authorization-lifetime';
  if (officeSession) report.scope = officeAuthority ? 'office-session-and-authorization-lifetime' : 'office-session-lifetime';
  if (officeSessionInFlight) report.scope = officeAuthority ? 'office-session-inflight-and-authorization' : 'office-session-inflight';
  if (officeSidebarInFlight) report.scope = 'office-sidebar-retention-inflight';
  if (officeFilePermission) report.scope = 'office-file-permission-lifetime';
  if (fileTransfers) report.scope = 'file-download-share-lifetime';
  if (filePicker) report.scope = 'file-picker-and-process-lifetime';
  if (fileWriteDeath) report.scope = 'file-target-write-process-lifetime';
  if (fileShareDeath) report.scope = 'file-share-preparation-process-lifetime';
  if (fileFormats) { report.scope = 'office-formats-original-save-and-share'; report.formatGroup = fileFormatGroup; report.evidenceDirectory = evidence; }
  const startedAt = Date.now(), stages = [];
  const markStage = async stage => {
    stages.push({ stage, elapsedMs: Date.now() - startedAt });
    await writeFile(resolve(evidence, 'latest-remote-android-progress.json'), JSON.stringify({ at: report.at, packageName, stages }, null, 2) + '\n');
  };
  let page, fingerprint;
  try {
    // 只清理本测试创建的独立 UID；绝不清理用户安装的正式 App。
    assert.equal((await device.shell(`pm clear ${packageName}`)).toString().trim(), 'Success');
    const key = new URLSearchParams(new URL(pairLink).hash.slice(1)).get('key');
    assert.match(key, /^[A-Za-z0-9_-]{43}$/);
    const url = `dshm://pair?server=${encodeURIComponent(origin)}#key=${key}`;
    await device.shell(`am start -W -a android.intent.action.VIEW -c android.intent.category.BROWSABLE -d '${url}' -p ${packageName}`);
    const first = await (await androidAppWebView(device, packageName)).page();
    page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'))
      ?? await first.context().waitForEvent('page', { predicate: item => item.url().startsWith('https://remote.dshm.invalid/'), timeout: 30000 });
    page.setDefaultTimeout(20000);
    page.on('pageerror', error => report.pageErrors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
    const input = page.getByRole('textbox', { name: '一次性配对链接', exact: true });
    await input.waitFor();
    assert.equal(await input.inputValue(), pairLink);
    await page.getByLabel('设备名称', { exact: true }).fill('DSHM latest isolated Android');
    await page.getByRole('button', { name: '继续配对', exact: true }).click();
    await page.getByRole('heading', { name: '等待电脑批准', exact: true }).waitFor();
    fingerprint = await page.getByTestId('remote-fingerprint').innerText();
    assert.match(fingerprint, /^[A-Za-z0-9_-]{43}$/);
    await approve(fingerprint);
    await page.getByRole('button', { name: '我已在电脑批准', exact: true }).click();
    await page.getByTestId('remote-workspace').waitFor({ timeout: 60000 });
    await page.getByRole('button').filter({ hasText: title }).click();
    await page.getByText(marker, { exact: true }).waitFor();
    if (desktop && !fileScope) {
      report.desktopApps = await verifyLatestDesktopAppsPage(page, desktop.workspacePath, evidence, desktop.verifyOpen, desktop.prepareSidebar);
      await markStage('desktop-apps-complete');
    }
    await verifyLockedPreset(page, preset);
    report.historyPresetLocked = true;
    await page.locator('[data-composer-input]').click();
    await page.getByRole('button', { name: /^选择模型，当前 / }).click();
    await page.getByRole('button', { name: nextModel.name, exact: true }).click();
    await page.getByRole('button', { name: '选择模型，当前 ' + nextModel.name, exact: true }).waitFor();
    await verifyModel();
    report.nativePairingAndTransport = true;
    report.ownHistoryAndModelSynced = true;
    await markStage('pair-history-model-complete');
    if (!fileScope) {
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '插件面板', exact: true }).click();
    const cordisRegion = page.getByRole('region', { name: '插件面板', exact: true });
    await cordisRegion.getByRole('button', { name: '打开面板', exact: true }).waitFor();
    assert.equal(await cordisRegion.locator('[data-cordis-badge]').count(), 0);
    const cordisReceipt = await mutateCordis('define');
    await cordisRegion.locator('[data-cordis-badge]').click();
    await cordisRegion.locator('[data-cordis-panel]').waitFor();
    const cordisRow = cordisRegion.locator(`[data-cordis-row="${cordisReceipt.pluginId}"]`);
    await cordisRow.getByText('Latest isolated Cordis v1', { exact: true }).waitFor();
    assert.equal(await cordisRow.locator('[data-cordis-switch]').count(), 1);
    await mutateCordis('update');
    await cordisRow.getByText('Latest isolated Cordis v2', { exact: true }).waitFor();
    await mutateCordis('request');
    await cordisRow.locator('[data-cordis-approve]').click();
    await cordisRegion.getByRole('button', { name: '返回聊天', exact: true }).click();
    await page.getByTestId('latest-cordis-echo').click();
    await page.getByTestId('latest-cordis-echo').filter({ hasText: 'LATEST_CORDIS_HOST_ECHO_V2' }).waitFor();
    report.cordisApprovalLocalUiAndHostInvoke = true;
    report.cordisRequestSource = 'isolated fixture invoking original Host run; not model inference';
    await mutateCordis('remove');
    await page.getByTestId('latest-cordis-echo').waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '插件面板', exact: true }).click();
    await cordisRegion.locator('[data-cordis-badge]').waitFor({ state: 'detached' });
    report.cordisDefinitionVersionRemovalPushed = true;
    report.originalCordisPanelOpened = true;
    await markStage('cordis-complete');
    await cordisRegion.getByRole('button', { name: '返回聊天', exact: true }).click();
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '电脑插件', exact: true }).click();
    await page.getByRole('button', { name: '插件设置', exact: true }).click();
    await page.getByRole('combobox', { name: '插件配置', exact: true }).waitFor();
    await page.locator('#plugin-config-shell-timeout:not(:disabled)').waitFor();
    await verifyBlankPreset(page, preset, verifyPreset);
    report.blankPresetSelectedAndSynced = true;
    await verifyPresetDefault(page, preset, verifyDefault);
    report.presetDefaultSavedInheritedAndRestored = true;
    await verifyPresetDirectory(page, preset);
    report.presetProfileLocationDisplayed = true;
    await verifyPresetManagement(page, preset, verifyManagement);
    report.presetCopyCancelDelete = true;
    await verifyCodingTools(page, verifyCoding);
    report.codingToolsSavedInheritedAndPushed = true;
    await verifyPresetCreator(page, title, verifyCreator);
    report.presetCreatorHistoryProtectedAndBlankReused = true;
    await markStage('presets-complete');
    await verifyProviderManagement(page, verifyProvider,
      (probe, verify) => verifyNativeModelProbe(device, packageName, page, probe, verify),
      (key, action, route) => verifyNativeProviderKey(device, packageName, page, key, action, route));
    report.providerCreateRenameModelsCancelRemove = true;
    report.modelProbeCancelReadAdoptAndRedirectRejected = true;
    report.nativeTemporaryProbeCancelInvalidExecuteAndNotPersisted = true;
    report.nativeProviderKeySavedUsedAndRemoved = true;
    report.existingDiscoverySavedAndDraftTargetsSeparated = true;
    await markStage('providers-complete');
    await verifyModelCatalogManagement(page, verifyCatalog);
    report.officialAndBuiltinCatalogSavedAndRestored = true;
    report.modelCapabilitiesTemplatesAndProtocolSwitchRestored = true;
    report.officialInputAndBuiltinCapabilitiesRestored = true;
    await markStage('catalog-complete');
    }
    report.fileRefresh = await verifyFileRefresh(page, title, verifyFiles);
    await markStage('files-complete');
    assert.equal(await page.locator('iframe').count(), 0);
    assert.deepEqual(report.pageErrors, []);
    assert.deepEqual(report.consoleErrors, []);
    if (!fileScope) report.originalSettingsCardRead = true;
    if (fileTransfers) {
      report.fileTransfers = await verifyLatestFileTransfers(page, device, packageName, verifyFiles,
        async (stage, observation) => {
          await writeFile(resolve(evidence, `latest-file-transfer-${stage}.png`), await device.screenshot());
          if (observation) await writeFile(resolve(evidence, `latest-file-transfer-${stage}.json`), JSON.stringify(observation, null, 2) + '\n');
        },
        { pickerLifetime: filePicker, writeDeath: fileWriteDeath, shareDeath: fileShareDeath, allFormats: fileFormats,
          formatGroup: fileFormatGroup, title, marker, onReopened: reopened => {
          page = reopened;
          page.on('pageerror', error => report.pageErrors.push(error.message));
          page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
        } });
      await markStage('file-transfers-complete');
      assert.deepEqual(report.pageErrors, []);
      assert.deepEqual(report.consoleErrors, []);
    }
    if (officeFilePermission) {
      report.officeFilePermission = await verifyOfficeFilePermission(page, verifyFiles,
        async stage => writeFile(resolve(evidence, `latest-office-file-permission-${stage}.png`), await device.screenshot()));
      await markStage('office-file-permission-complete');
      assert.deepEqual(report.pageErrors, []);
      assert.deepEqual(report.consoleErrors, []);
    }
    if (officeSession) {
      report.officeSessionOwnership = await verifyOfficeSessionOwnership(page, verifyFiles,
        async () => writeFile(resolve(evidence, 'latest-office-session-other.png'), await device.screenshot()));
      await markStage('office-session-ownership-complete');
      assert.deepEqual(report.pageErrors, []);
      assert.deepEqual(report.consoleErrors, []);
      if (officeSessionInFlight) {
        report.officeSessionInFlight = await verifyOfficeSessionInFlight(page, verifyFiles, report.officeSessionOwnership,
          async stage => writeFile(resolve(evidence, `latest-office-session-inflight-${stage}.png`), await device.screenshot()),
          officeSidebarInFlight ? desktop.prepareSidebar : undefined);
        await markStage('office-session-inflight-complete');
        assert.deepEqual(report.pageErrors, []);
        assert.deepEqual(report.consoleErrors, []);
      }
    }
    if (officeEngineLifecycle) {
      report.officeEngineRevocation = await verifyOfficeEngineRevocation(page, verifyFiles, async observedRunning => {
        const runningAtRevoke = observedRunning ?? await verifyFiles('office-engine-revoke-running');
        const receipt = await revoke(fingerprint); report.authorityRevoked = true;
        return { ...receipt, runningAtRevoke };
      }, { shared: officeEngineShared });
    } else if (officeAuthority) {
      report.officeManagementInFlight = await verifyOfficeAuthorizationLoss(page, title, verifyFiles,
        () => changeOfficeManagement(fingerprint), 'management');
      await markStage('office-management-loss-complete');
      assert.deepEqual(report.pageErrors, []);
      assert.deepEqual(report.consoleErrors, []);
      report.officeDeviceRevokedInFlight = await verifyOfficeAuthorizationLoss(page, title, verifyFiles,
        async () => { const receipt = await revoke(fingerprint); report.authorityRevoked = true; return receipt; }, 'revoke');
    } else if (desktop?.revocation) {
      report.desktopRevocationInFlight = await verifyLatestDesktopRevocationPage(page, desktop.workspacePath,
        evidence, desktop.revocation, async () => { await revoke(fingerprint); report.authorityRevoked = true; });
    } else await revoke(fingerprint);
    report.authorityRevoked = true;
    const close = page.getByRole('button', { name: '关闭窗口', exact: true });
    if (await close.isVisible()) await close.click();
    if (!officeAuthority && !officeEngineLifecycle) await page.getByRole('button', { name: '重新连接', exact: true }).click();
    await page.getByRole('heading', { name: '连接授权已失效', exact: true }).waitFor({ timeout: 30000 });
    report.nativeRevocationObserved = true;
    await markStage('revocation-complete');
    report.passed = true;
  } catch (error) {
    report.passed = false; report.error = error.message;
    if (error.officeEngineRevocationTrace) report.officeEngineRevocationTrace = error.officeEngineRevocationTrace;
    report.pageText = await page?.locator('body').innerText().catch(() => 'page_closed');
    throw error;
  } finally {
    if (fingerprint && !report.authorityRevoked) await revoke(fingerprint);
    await writeFile(resolve(evidence, 'latest-remote-android.png'), await device.screenshot()).catch(() => {});
    await device.shell(`am force-stop ${packageName}`);
    await adb(adbPath, ['-s', device.serial(), 'reverse', '--remove', `tcp:${port}`], { windowsHide: true });
    await device.close();
    await writeFile(resolve(evidence, 'latest-remote-android.json'), JSON.stringify(report, null, 2) + '\n');
  }
  return report;
}
