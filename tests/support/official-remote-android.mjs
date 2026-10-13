import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { _android } from 'playwright';
import { androidAppWebView } from '../../scripts/android-app-webview.mjs';
import { verifyOfficialWriteApprovals } from './official-write-approvals.mjs';
import { verifyOfficialQuestionAndCommand } from './official-question-command.mjs';
import { verifyOfficialQuestionProcessRecovery } from './official-question-process.mjs';
import { verifyOfficialTimedQuestion } from './official-timed-question.mjs';
import { verifyOfficialTimedHost } from './official-timed-host.mjs';
import { verifyOfficialInteractionHost } from './official-interaction-host.mjs';
import { verifyOfficialInteractionRace } from './official-interaction-race.mjs';
import { verifyOfficialTimedRace } from './official-timed-race.mjs';
import { verifyOfficialInteractionSending } from './official-interaction-sending.mjs';
import { verifyOfficialBackgroundOutput } from './official-background-output.mjs';
import { verifyOfficialFilesAndTransfers } from './official-files-transfers.mjs';
import { verifyOfficialPluginInstall } from './official-plugin-install.mjs';
import { verifyOfficialOfficePreview } from './official-office-preview.mjs';
import { verifyOfficialWorkspaceManagement } from './official-workspace-management.mjs';
import { verifyOfficialComputerSettings } from './official-computer-settings.mjs';
import { verifyOfficialCredentialEndpoints } from './official-credential-endpoints.mjs';
import { verifyOfficialDeepSeekModels } from './official-deepseek-models.mjs';
import { verifyOfficialPresets } from './official-presets.mjs';
import { verifyOfficialPresetCreator } from './official-preset-creator.mjs';
import { verifyOfficialCreatorTask } from './official-creator-task.mjs';
import { verifyOfficialProviders } from './official-providers.mjs';
import { verifyOfficialProviderKeys } from './official-provider-keys.mjs';
import { verifyOfficialEndpoints } from './official-endpoints.mjs';
import { verifyOfficialEndpointInterruption } from './official-endpoint-interruption.mjs';
import { verifyOfficialEndpointRace } from './official-endpoint-race.mjs';
import { verifyOfficialEndpointProcess } from './official-endpoint-process.mjs';
import { verifyOfficialQueueControl } from './official-queue-control.mjs';
import { verifyOfficialSessionNavigation } from './official-session-navigation.mjs';
import { verifyOfficialApprovalRecovery } from './official-approval-recovery.mjs';
import { verifyOfficialApprovalProcessRecovery } from './official-approval-process.mjs';
import { verifyOfficialHostRestart } from './official-host-restart.mjs';
import { verifyOfficialApprovalSending } from './official-approval-sending.mjs';
import { verifyOfficialPlanReview } from './official-plan-review.mjs';
import { verifyOfficialPlanProcessRecovery } from './official-plan-process.mjs';
import { verifyOfficialTaskNotifications } from './official-task-notifications.mjs';
import { verifyOfficialFileRecovery } from './official-file-recovery.mjs';
import { verifyOfficialSaveWindowRecovery } from './official-save-window.mjs';
import { verifyOfficialAttachments } from './official-attachments.mjs';
import { verifyOfficialDestinationWriteDeath } from './official-destination-write-death.mjs';
import { verifyOfficialDestinationWriteInterruption } from './official-destination-write-interruption.mjs';
import { verifyOfficialSubagents } from './official-subagents.mjs';
import { verifyOfficialSessionExport } from './official-session-export.mjs';
import { verifyOfficialFeedback } from './official-feedback.mjs';
import { verifyOfficialFeedbackHistory } from './official-feedback-history.mjs';
import { verifyOfficialPromptSending } from './official-prompt-sending.mjs';
import { verifyOfficialPromptHost } from './official-prompt-host.mjs';
import { verifyOfficialAttachmentSending } from './official-attachment-sending.mjs';
import { verifyOfficialGoals } from './official-goals.mjs';
import { verifyOfficialWorkflows } from './official-workflows.mjs';
import { verifyOfficialSchedules } from './official-schedules.mjs';
import { verifyOfficialLongHistory } from './official-long-history.mjs';
import { verifyOfficialHistoryInflight } from './official-history-inflight.mjs';
import { verifyOfficialPtc } from './official-ptc.mjs';
import { verifyOfficialSkills } from './official-skills.mjs';
import { verifyOfficialExternalChild } from './official-external-child.mjs';
import { verifyOfficialReferences } from './official-references.mjs';
import { verifyOfficialPairing } from './official-pairing.mjs';

/** 纯官方验收只操作独立测试 UID，原 App 的凭据/绑定/历史不读写。 */
export async function verifyOfficialRemoteAndroid({ origin, pairLink, title, marker, evidence, nextModel,
  workspaceTitle, approve, revoke, verifyModel, phoneMarker, phonePrompt = phoneMarker,
  verifyMessage, verifyCreated, disconnect, reconnect, inference, plugins, workspaceManagement, settings, navigation, pairing }) {
  const ownCandidate = process.env.DSHM_OFFICIAL_APP_CHECK === '1';
  const alpha2 = process.env.DSHM_OFFICIAL_ALPHA2_CHECK === '1';
  assert.ok(!alpha2 || ownCandidate);
  const packageName = ownCandidate ? 'dev.dshmobile.validation.officialtest' : 'dev.dshmobile.validation.latestfinaltest';
  const protectedPackage = 'dev.dshmobile.validation.latesttest';
  assert.equal(process.env.DSHM_ANDROID_SERIAL, '127.0.0.1:16384');
  const discovered = await _android.devices({ omitDriverInstall: true });
  const device = discovered.find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
  // 只保留目标MuMu的观察连接；关闭其他Playwright句柄不结束模拟器或其App。
  // 未使用设备的WebView轮询也会运行，遗留句柄可在测试结束时产生ADB超时异常。
  await Promise.all(discovered.filter(item => item !== device).map(item => item.close()));
  assert.ok(device);
  const adbPath = process.env.DSHM_ADB_PATH;
  assert.ok(adbPath);
  assert.equal(origin, 'http://127.0.0.1:16956');
  const adb = promisify(execFile);
  const protectedState = async () => {
    const path = (await device.shell(`pm path ${protectedPackage}`)).toString().trim();
    assert.match(path, /^package:\/data\/app\/[A-Za-z0-9_./=+~-]+\/base\.apk$/);
    const pid = (await device.shell(`pidof ${protectedPackage}`)).toString().trim();
    assert.match(pid, /^[1-9]\d*$/);
    const sha256 = (await device.shell(`sha256sum ${path.slice(8)}`)).toString().trim().split(/\s+/)[0];
    assert.equal(sha256, '58921967f03c2a2d8e6b2c9dfdfc623052dbb7ddbfb291684013d2863111114b');
    return { path, pid, sha256 };
  };
  const before = await protectedState();
  const installed = (await device.shell(`pm path ${packageName}`)).toString().trim();
  assert.match(installed, /^package:\/data\/app\/[A-Za-z0-9_./=+~-]+\/base\.apk$/);
  const apkSha256 = (await device.shell(`sha256sum ${installed.slice(8)}`)).toString().trim().split(/\s+/)[0];
  const candidate = ownCandidate ? JSON.parse(await readFile(resolve(import.meta.dirname,
    '../../artifacts', alpha2 ? 'official-alpha2-android-build' : 'official-android-build', 'official-app.json'), 'utf8')) : null;
  if (candidate) assert.equal(candidate.packageName, packageName);
  assert.equal(apkSha256, candidate?.sha256 ?? '54e920866d4fe220c4bc23cb1e92a15c7033cd3603b60c3ebaa98e67acbef973');
  await mkdir(evidence, { recursive: true });
  const report = { packageName, apkSha256, appInstalledThisRun: false, before, passed: false,
    inferenceVerified: false, pageErrors: [], renderingErrors: [], stages: [] };
  let page, fingerprint, revoked = false;
  const save = () => writeFile(resolve(evidence, 'android.json'), JSON.stringify(report, null, 2) + '\n');
  const mark = async stage => { report.stages.push(stage); await save(); };
  const selected = () => page.getByTestId('remote-workspace').evaluate(element => {
    const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
    for (let fiber = element[key]; fiber; fiber = fiber.return)
      if (fiber.memoizedProps?.model?.client) return fiber.memoizedProps.model.getSnapshot().selected;
    return null;
  });
  try {
    await adb(adbPath, ['-s', device.serial(), 'reverse', 'tcp:16956', 'tcp:16956'], { windowsHide: true });
    assert.equal((await device.shell(`pm clear ${packageName}`)).toString().trim(), 'Success');
    const key = new URLSearchParams(new URL(pairLink).hash.slice(1)).get('key');
    assert.match(key, /^[A-Za-z0-9_-]{43}$/);
    const link = `dshm://pair?server=${encodeURIComponent(origin)}#key=${key}`;
    await device.shell(`am start -W -a android.intent.action.VIEW -c android.intent.category.BROWSABLE -d '${link}' -p ${packageName}`);
    const first = await (await androidAppWebView(device, packageName)).page();
    page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'))
      ?? await first.context().waitForEvent('page', { predicate: item => item.url().startsWith('https://remote.dshm.invalid/'), timeout: 30000 });
    page.setDefaultTimeout(20000);
    page.on('pageerror', error => report.pageErrors.push(error.message));
    page.on('console', message => {
      const text = message.text();
      if (message.type() === 'error' && /^slot (entry|factory occurrence) crashed /.test(text))
        report.renderingErrors.push(text.slice(0, 3000));
    });
    const input = page.getByRole('textbox', { name: '一次性配对链接', exact: true });
    await input.waitFor();
    assert.equal(await input.inputValue(), pairLink);
    if (pairing) report.pairing = await verifyOfficialPairing({ page, device, evidence, packageName, checks: pairing, mark });
    await page.getByLabel('设备名称', { exact: true }).fill('DSHM 官方纯插件 Android 验收');
    await page.getByRole('button', { name: '继续配对', exact: true }).click();
    await page.getByRole('heading', { name: '等待电脑批准', exact: true }).waitFor();
    fingerprint = await page.getByTestId('remote-fingerprint').innerText();
    assert.match(fingerprint, /^[A-Za-z0-9_-]{43}$/);
    if (pairing) {
      report.pairing.pending = await pairing.claimed(fingerprint);
      report.pairingVerified = true;
      await writeFile(resolve(evidence, 'pairing.json'), JSON.stringify(report.pairing, null, 2) + '\n');
      await mark('native-fresh-qr-explicit-claim-only-one-pending-device');
    }
    assert.equal(await page.getByTestId('remote-workspace').count(), 0);
    await approve(fingerprint);
    await page.getByRole('button', { name: '我已在电脑批准', exact: true }).click();
    await page.getByTestId('remote-workspace').waitFor({ timeout: 60000 });
    assert.ok(page.url().startsWith('https://remote.dshm.invalid/'));
    assert.equal(await page.locator('iframe').count(), 0);
    await page.getByTestId('remote-workspace').getByRole('button', { name: workspaceTitle, exact: true }).waitFor();
    await page.locator('.remote-session-row').filter({ hasText: title }).click();
    await page.getByText(marker, { exact: true }).waitFor();
    await mark('native-pairing-official-workspace-and-history');
    if (ownCandidate) {
      await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      const menu = page.getByRole('dialog', { name: 'Remote 选项', exact: true });
      await menu.waitFor();
      assert.equal(await menu.getByRole('button', { name: '待处理', exact: true }).count(), 0);
      assert.equal(await menu.getByRole('button', { name: '在电脑应用中打开', exact: true }).count(), 0);
      await menu.getByRole('button', { name: '关闭窗口', exact: true }).click();
      await mark('official-unsupported-menu-entries-hidden');
    }
    await page.locator('[data-composer-input]').click();
    await page.getByRole('button', { name: /^选择模型，当前 / }).click();
    await page.getByRole('button', { name: nextModel.name, exact: true }).click();
    await page.getByRole('button', { name: '选择模型，当前 ' + nextModel.name, exact: true }).waitFor();
    await verifyModel();
    await mark('phone-model-synchronized-to-official-host');
    let editor = page.locator('[data-composer-input]');
    await editor.fill(phonePrompt);
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    await page.getByText(phonePrompt, { exact: true }).waitFor();
    await verifyMessage();
    await mark('phone-message-in-official-session-log');
    if (inference) {
      await page.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: phoneMarker })
        .waitFor({ timeout: 180000 });
      await page.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'hidden', timeout: 180000 });
      report.phoneInference = await inference.verifyReply(phoneMarker);
      await mark('phone-real-model-reply-in-official-log');
      if (inference.skills) {
        report.skills = await verifyOfficialSkills({ page, device, evidence, inference, mark });
        report.skillsVerified = report.skills.completed === true;
      }
      if (inference.externalChild) {
        report.externalChild = await verifyOfficialExternalChild({ page, device, evidence, inference, mark });
        report.externalChildVerified = report.externalChild.completed === true;
      }
      if (inference.references) {
        report.references = await verifyOfficialReferences({ page, device, evidence, inference, mark, disconnect, reconnect });
        report.referencesVerified = report.references.completed === true;
      }
      if (inference.ptc) {
        report.ptc = await verifyOfficialPtc({ page, device, evidence, inference, title, workspaceTitle, mark });
        report.ptcVerified = report.ptc.completed === true;
      }
      if (inference.longHistory) report.longHistory = await verifyOfficialLongHistory({ page, device, evidence,
        checks: inference.longHistory, title, mark });
      if (inference.historyInflight) report.historyInflight = await verifyOfficialHistoryInflight({ page, device, evidence,
        checks: inference.historyInflight, title, mark, disconnect, reconnect });
      if (inference.feedback) {
        report.feedback = await verifyOfficialFeedback({ page, device, evidence, inference, phoneMarker, disconnect, reconnect, mark });
        report.feedbackVerified = report.feedback.passed === true;
      }
      if (inference.feedbackHistory) {
        report.feedbackHistory = await verifyOfficialFeedbackHistory({ page, device, evidence, inference, phoneMarker, title, packageName, mark });
        report.feedbackHistoryVerified = report.feedbackHistory.passed === true;
      }
      if (inference.promptSending) {
        const verifyPrompt = inference.promptSending.hostExit ? verifyOfficialPromptHost : verifyOfficialPromptSending;
        report.promptSending = await verifyPrompt({ page, device, evidence, inference, packageName, title, mark,
          replacePage: replacement => {
            page = replacement; page.setDefaultTimeout(20000);
            page.on('pageerror', error => report.pageErrors.push(error.message));
            page.on('console', message => {
              const text = message.text();
              if (message.type() === 'error' && /^slot (entry|factory occurrence) crashed /.test(text))
                report.renderingErrors.push(text.slice(0, 3000));
            });
            editor = page.locator('[data-composer-input]');
          } });
        report.promptSendingVerified = report.promptSending.passed === true;
        if (inference.promptSending.processExit) report.promptProcessVerified = report.promptSending.passed === true;
        if (inference.promptSending.hostExit) report.promptHostVerified = report.promptSending.passed === true;
      }
      if (inference.attachmentSending) {
        report.attachmentSending = await verifyOfficialAttachmentSending({ page, device, evidence, inference, packageName, title, mark,
          replacePage: replacement => {
            page = replacement; page.setDefaultTimeout(20000);
            page.on('pageerror', error => report.pageErrors.push(error.message));
            page.on('console', message => {
              const text = message.text();
              if (message.type() === 'error' && /^slot (entry|factory occurrence) crashed /.test(text))
                report.renderingErrors.push(text.slice(0, 3000));
            });
            editor = page.locator('[data-composer-input]');
          } });
        report.attachmentSendingVerified = report.attachmentSending.passed === true;
        if (inference.attachmentSending.processExit) report.attachmentProcessVerified = report.attachmentSending.passed === true;
        if (inference.attachmentSending.hostExit) report.attachmentHostVerified = report.attachmentSending.passed === true;
      }
      if (inference.creatorTask) report.creatorTask = await verifyOfficialCreatorTask({ page, device, evidence, inference, mark });
      if (inference.subagents) {
        report.subagents = await verifyOfficialSubagents({ page, device, evidence, inference,
          disconnect, reconnect, mark });
        report.subagentsVerified = report.subagents.completed === true;
      }
      if (inference.sessionExport) {
        report.sessionExport = await verifyOfficialSessionExport({ page, device, evidence, inference, packageName, mark });
        report.sessionExportVerified = report.sessionExport.passed === true;
      }
      if (inference.goals) {
        report.goals = await verifyOfficialGoals({ page, device, evidence, inference,
          disconnect, reconnect, mark });
        report.goalsVerified = report.goals.completed === true;
      }
      if (inference.workflows) {
        report.workflows = await verifyOfficialWorkflows({ page, device, evidence, inference,
          disconnect, reconnect, mark });
        report.workflowsVerified = report.workflows.completed === true;
      }
      if (inference.schedules) {
        report.schedules = await verifyOfficialSchedules({ page, device, evidence, inference,
          disconnect, reconnect, mark });
        report.schedulesVerified = report.schedules.completed === true;
      }
      if (inference.verifyApprovals !== false)
        report.approvals = await verifyOfficialWriteApprovals({ page, device, evidence, inference, mark });
      if (inference.creatorTask) {
        assert.equal(report.approvals.length, 2);
        assert.ok(report.approvals.every(item => item.pluginSourceSyntaxVerified === true));
        report.creatorTaskVerified = true;
      }
      if (inference.extensions) {
        report.extensions = await verifyOfficialQuestionAndCommand({ page, device, evidence, inference, mark });
        report.extensionsVerified = true;
      }
      if (inference.timedQuestion) {
        if (inference.timedQuestion.host) {
          report.timedHost = await verifyOfficialTimedHost({ page, device, evidence, inference, packageName, mark });
          report.timedHostVerified = report.timedHost.completed === true;
        } else {
          report.timedQuestion = await verifyOfficialTimedQuestion({ page, device, evidence, inference,
            packageName, title, mark, replacePage: replacement => {
              page = replacement; page.setDefaultTimeout(20000);
              page.on('pageerror', error => report.pageErrors.push(error.message));
              editor = page.locator('[data-composer-input]');
            } });
          report.timedQuestionVerified = report.timedQuestion.completed === true;
        }
      }
      if (inference.interactionHost) {
        report.interactionHost = await verifyOfficialInteractionHost({ page, device, evidence, inference, packageName, mark });
        report.interactionHostVerified = report.interactionHost.completed === true;
      }
      if (inference.interactionRace) {
        report.interactionRace = await verifyOfficialInteractionRace({ page, device, evidence, inference, packageName, mark });
        report.interactionRaceVerified = report.interactionRace.completed === true;
      }
      if (inference.timedRace) {
        report.timedRace = await verifyOfficialTimedRace({ page, device, evidence, inference, packageName, mark });
        report.interactionRaceVerified = report.timedRace.completed === true;
      }
      if (inference.interactionSending) {
        report.interactionSending = await verifyOfficialInteractionSending({ page, device, evidence, inference, packageName, mark });
        report.interactionSendingVerified = report.interactionSending.completed === true;
      }
      if (inference.questionProcess) {
        report.questionProcess = await verifyOfficialQuestionProcessRecovery({ page, device, evidence, inference,
          packageName, title, mark, replacePage: replacement => {
            page = replacement;
            page.setDefaultTimeout(20000);
            page.on('pageerror', error => report.pageErrors.push(error.message));
            editor = page.locator('[data-composer-input]');
          } });
        report.questionProcessVerified = true;
      }
      if (inference.jobs) {
        report.background = await verifyOfficialBackgroundOutput({ page, device, evidence, inference, disconnect, reconnect,
          packageName, title, mark, replacePage: replacement => {
            page = replacement; page.setDefaultTimeout(20000);
            page.on('pageerror', error => report.pageErrors.push(error.message));
            page.on('console', message => {
              const text = message.text();
              if (message.type() === 'error' && /^slot (entry|factory occurrence) crashed /.test(text))
                report.renderingErrors.push(text.slice(0, 3000));
            });
            editor = page.locator('[data-composer-input]');
          } });
        report.backgroundVerified = true;
      }
      if (inference.files) {
        report.files = await verifyOfficialFilesAndTransfers({ page, device, evidence, inference, packageName, mark });
        report.filesVerified = true;
      }
      if (inference.fileRecovery) {
        report.fileRecovery = await verifyOfficialFileRecovery({ page, device, evidence, inference,
          packageName, disconnect, reconnect, mark });
        report.fileRecoveryVerified = true;
      }
      if (inference.fileSave) {
        report.fileSave = await verifyOfficialSaveWindowRecovery({ page, device, evidence, inference,
          packageName, disconnect, reconnect, mark });
        report.fileSaveVerified = true;
      }
      if (inference.attachments) {
        report.attachments = await verifyOfficialAttachments({ page, device, evidence, inference, packageName, mark });
        report.attachmentsVerified = true;
      }
      if (inference.fileWriteDeath) {
        report.fileWriteDeath = await verifyOfficialDestinationWriteDeath({ page, device, evidence, inference,
          packageName, title, phoneMarker, mark, replacePage: replacement => {
            page = replacement;
            page.setDefaultTimeout(20000);
            page.on('pageerror', error => report.pageErrors.push(error.message));
            editor = page.locator('[data-composer-input]');
          } });
        report.fileWriteDeathVerified = true;
      }
      if (inference.fileWriteInterruption && !inference.fileWriteInterruption.revocationOnly) {
        report.fileWriteInterruption = await verifyOfficialDestinationWriteInterruption({ page, device, evidence,
          inference, packageName, disconnect, reconnect, mark });
        report.fileWriteInterruptionVerified = true;
      }
      if (inference.office) {
        report.office = await verifyOfficialOfficePreview({ page, device, evidence, inference, mark });
        report.officeVerified = true;
      }
      if (inference.queue) {
        report.queue = await verifyOfficialQueueControl({ page, device, evidence, inference, disconnect, reconnect, mark });
        report.queueVerified = true;
      }
      if (inference.approvalRecovery?.sending) {
        report.approvalSending = await verifyOfficialApprovalSending({ page, device, evidence, inference, packageName, mark });
        report.approvalSendingVerified = true;
      } else if (inference.approvalRecovery?.hostRestart) {
        report.hostRestart = await verifyOfficialHostRestart({ page, device, evidence, inference, packageName, mark });
        report.hostRestartVerified = true;
      } else if (inference.approvalRecovery?.processOnly) {
        report.approvalProcess = await verifyOfficialApprovalProcessRecovery({ page, device, evidence, inference,
          packageName, title, mark, replacePage: replacement => {
            page = replacement;
            page.setDefaultTimeout(20000);
            page.on('pageerror', error => report.pageErrors.push(error.message));
            editor = page.locator('[data-composer-input]');
          } });
        report.approvalProcessVerified = true;
      } else if (inference.approvalRecovery) {
        report.approvalRecovery = await verifyOfficialApprovalRecovery({ page, device, evidence, inference, disconnect, reconnect, mark });
        report.approvalRecoveryVerified = true;
      }
      if (inference.planReview?.processOnly) {
        report.planProcess = await verifyOfficialPlanProcessRecovery({ page, device, evidence, inference,
          packageName, title, mark, replacePage: replacement => {
            page = replacement;
            page.setDefaultTimeout(20000);
            page.on('pageerror', error => report.pageErrors.push(error.message));
            editor = page.locator('[data-composer-input]');
          } });
        report.planProcessVerified = true;
      } else if (inference.planReview) {
        report.planReview = await verifyOfficialPlanReview({ page, device, evidence, inference, mark });
        report.planReviewVerified = true;
      }
      if (inference.notifications) {
        report.notifications = await verifyOfficialTaskNotifications({ page, device, evidence, inference,
          packageName, title, disconnect, reconnect, mark, replacePage: replacement => {
            page = replacement;
            page.setDefaultTimeout(20000);
            page.on('pageerror', error => report.pageErrors.push(error.message));
            editor = page.locator('[data-composer-input]');
          } });
        report.notificationsVerified = true;
      }
      report.inferenceVerified = true;
    }
    if (plugins) {
      report.plugins = await verifyOfficialPluginInstall({ page, device, evidence, plugins, fingerprint, title, mark });
      report.pluginsVerified = true;
    }
    if (workspaceManagement) {
      report.workspaceManagement = await verifyOfficialWorkspaceManagement({ page, device, evidence,
        workspaceManagement, fingerprint, title, mark });
      report.workspaceManagementVerified = true;
    }
    if (settings) {
      if (settings.endpointProcess) {
        report.endpointProcess = await verifyOfficialEndpointProcess({ page, device, evidence,
          settings, fingerprint, title, packageName, mark, replacePage: replacement => {
            page = replacement; page.setDefaultTimeout(20000);
            page.on('pageerror', error => report.pageErrors.push(error.message)); editor = page.locator('[data-composer-input]');
          } });
        report.endpointProcessVerified = true;
      } else if (settings.endpointRace) {
        report.endpointRace = await verifyOfficialEndpointRace({ page, device, evidence,
          settings, fingerprint, title, packageName, mark });
        report.endpointRaceVerified = true;
      } else if (settings.endpointInterruption) {
        report.endpointInterruption = await verifyOfficialEndpointInterruption({ page, device, evidence,
          settings, fingerprint, title, packageName, mark });
        report.endpointInterruptionVerified = true;
      } else if (settings.endpoints) {
        report.endpoints = await verifyOfficialEndpoints({ page, device, evidence,
          settings, fingerprint, title, packageName, mark });
        report.endpointWritesVerified = true;
      } else if (settings.providerKeys) {
        report.providerKeys = await verifyOfficialProviderKeys({ page, device, evidence,
          settings, fingerprint, title, packageName, mark });
        report.providerKeysVerified = true;
      } else if (settings.credentials) {
        report.credentialEndpoints = await verifyOfficialCredentialEndpoints({ page, device, evidence,
          settings, fingerprint, title, packageName, mark });
        report.credentialEndpointsVerified = true;
      } else if (settings.presetCreator) {
        report.presetCreator = await verifyOfficialPresetCreator({ page, device, evidence,
          settings, fingerprint, title, workspaceTitle, mark });
        report.presetCreatorVerified = true;
      } else if (settings.presets) {
        report.presets = await verifyOfficialPresets({ page, device, evidence,
          settings, fingerprint, title, workspaceTitle, mark });
        report.presetSettingsVerified = true;
      } else if (settings.models) {
        report.modelSettings = await verifyOfficialDeepSeekModels({ page, device, evidence,
          settings, fingerprint, title, mark });
        report.modelSettingsVerified = true;
      } else if (settings.providers) {
        report.providerManagement = await verifyOfficialProviders({ page, device, evidence,
          settings, fingerprint, title, mark });
        report.providerManagementVerified = true;
      } else {
        report.settings = await verifyOfficialComputerSettings({ page, device, evidence, settings, fingerprint, title, mark });
        report.settingsVerified = true;
      }
    }
    if (navigation) {
      report.navigation = await verifyOfficialSessionNavigation({ page, device, evidence, navigation, title, phoneMarker, mark });
      report.navigationVerified = true;
    }
    await editor.fill('OFFICIAL_RECONNECT_DRAFT');
    await disconnect();
    await page.getByTestId('remote-offline-status').waitFor();
    await reconnect();
    await page.getByTestId('remote-offline-status').waitFor({ state: 'detached', timeout: 45000 });
    if (inference?.longHistory) report.longHistoryReconnect = await verifyOfficialLongHistory({ page, device, evidence,
      checks: inference.longHistory, title, mark, reopen: false, draft: 'OFFICIAL_RECONNECT_DRAFT' });
    await editor.click();
    await page.getByRole('button', { name: /^选择模型，当前 / }).waitFor();
    await page.getByText(phonePrompt, { exact: true }).waitFor();
    assert.equal(await editor.innerText(), 'OFFICIAL_RECONNECT_DRAFT');
    await mark('official-relay-reconnect-retains-chat-and-draft');
    await editor.fill('');
    await page.locator('.remote-topbar').getByRole('button', { name: '返回', exact: true }).click();
    await page.getByRole('button', { name: '在已有工作区新建聊天', exact: true }).click();
    await page.getByLabel('选择工作区', { exact: true }).getByRole('button', { name: workspaceTitle, exact: true }).click();
    await page.locator('[data-composer-input]').waitFor();
    const selectedId = await selected();
    assert.ok(selectedId);
    await verifyCreated(selectedId);
    await mark('phone-created-chat-in-existing-official-workspace');
    if (inference?.fileWriteInterruption?.revocationOnly) {
      await page.locator('.remote-topbar').getByRole('button', { name: '返回', exact: true }).click();
      await page.locator('.remote-session-row').filter({ hasText: title }).click();
      await page.getByText(phonePrompt, { exact: true }).waitFor();
      report.fileWriteRevocation = await verifyOfficialDestinationWriteInterruption({ page, device, evidence,
        inference, packageName, mark, revoke: async () => { await revoke(fingerprint); revoked = true; } });
      report.fileWriteRevocationVerified = true;
    } else { await revoke(fingerprint); revoked = true; }
    await page.getByRole('button', { name: '重新连接', exact: true }).click();
    await page.getByRole('heading', { name: '连接授权已失效', exact: true }).waitFor({ timeout: 30000 });
    await mark('revocation-rejected-by-native-connection');
    assert.deepEqual(report.pageErrors, []);
    assert.deepEqual(report.renderingErrors, []);
    report.passed = true;
  } catch (error) {
    report.failure = error.message;
    report.pageText = await page?.locator('body').innerText().catch(() => 'page_closed');
    if (page) {
      // 在撤销前保留真实失败页面；只记录公开会话投影的状态，不导出连接或凭据对象。
      await writeFile(resolve(evidence, 'failure-page.png'), await device.screenshot()).catch(() => {});
      report.renderingState = await page.getByTestId('remote-workspace').evaluate(element => {
        const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
        for (let fiber = element[key]; fiber; fiber = fiber.return) {
          const model = fiber.memoizedProps?.model;
          if (!model?.client) continue;
          const state = model.getSnapshot();
          return { selected: state.selected, error: state.error, connectionState: state.connectionState,
            openState: state.session?.openState, nodeCount: state.conversation?.order?.length,
            content: element.querySelectorAll('[data-conversation-content]').length,
            body: element.querySelectorAll('[data-remote-chat-content]').length,
            composer: element.querySelectorAll('[data-composer-input]').length };
        }
        return null;
      }).catch(() => null);
    }
    throw error;
  } finally {
    // Host可能正处于退出验收；授权清理失败也必须结束独立UID、移除映射并保存原身份核对。
    let revokeFailure;
    if (fingerprint && !revoked) try { await revoke(fingerprint); revoked = true; }
    catch (error) { revokeFailure = error; report.authorityCleanupFailure = error.message; }
    report.authorityRevoked = revoked;
    if (page) await writeFile(resolve(evidence, 'android.png'), await device.screenshot()).catch(() => {});
    await device.shell(`am force-stop ${packageName}`);
    await adb(adbPath, ['-s', device.serial(), 'reverse', '--remove', 'tcp:16956'], { windowsHide: true });
    report.after = await protectedState();
    assert.deepEqual(report.after, before);
    report.originalAppIdentityUnchanged = true;
    await device.close();
    await save();
    if (revokeFailure) throw revokeFailure;
  }
  return report;
}
