import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createConnection } from 'node:net';
import { unzipSync } from 'fflate';
import { assertOfficialProcessStopped } from './official-stopped-process.mjs';

const execute = promisify(execFile), root = resolve(import.meta.dirname, '..');
const runs = process.argv.slice(2);
assert.ok(runs.length > 0 && runs.length <= 128);
assert.equal(new Set(runs).size, runs.length);
const original = 'dev.dshmobile.validation.latesttest', own = 'dev.dshmobile.validation.officialtest';
const adb = 'C:/Users/KKirin/AppData/Local/Android/Sdk/platform-tools/adb.exe', serial = '127.0.0.1:16384';
const shell = async command => (await execute(adb, ['-s', serial, 'shell', command], { windowsHide: true })).stdout.trim();
const checks = [], processIdentityChecks = [];
for (const run of runs) {
  assert.match(run, /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
  const check = JSON.parse(await readFile(resolve(root, '../backend/artifacts/official-plugin-only', `official-android-${run}.json`), 'utf8'));
  assert.equal(check.run, run); assert.equal(check.version, '0.2.1-alpha.2');
  assert.equal(check.entry, 'pnpm dsh web'); assert.equal(check.passed, true);
  assert.equal(check.cleanupCompleted, true); assert.deepEqual(check.cleanupFailures, []);
  assert.equal(check.testDevicesRevoked, true); assert.equal(check.gatewayClosed, true);
  assert.equal(check.android.authorityRevoked, true); assert.equal(check.android.passed, true);
  assert.deepEqual(check.android.pageErrors, []); assert.deepEqual(check.android.renderingErrors, []);
  assert.equal(check.android.packageName, own); assert.equal(check.android.originalAppIdentityUnchanged, true);
  checks.push(check);
}
const shareChecks = checks.filter(check => check.scope === 'phone-complete-file-sharing-readonly-recipient');
const reviewChecks = checks.filter(check => check.scope === 'phone-planned-tool-diff-and-actual-turn-review');
const historyChecks = checks.filter(check => check.scope === 'phone-long-session-history-pagination-and-reconnect');
const historyInflightChecks = checks.filter(check => check.scope === 'phone-history-late-page-switch-and-disconnect');
const ptcChecks = checks.filter(check => check.scope === 'phone-ptc-real-nested-command-result-and-stop');
const skillChecks = checks.filter(check => check.scope === 'phone-skill-catalog-source-and-real-manual-invocation');
const childStopChecks = checks.filter(check => check.scope === 'phone-real-continuable-child-readonly-tool-stop-and-continuation');
const externalChildChecks = checks.filter(check => check.scope === 'phone-real-official-acp-external-task-result-and-no-local-child-entry');
const referenceChecks = checks.filter(check => check.scope === 'phone-file-and-chat-reference-at-menu-and-structured-reconnect');
const pairingChecks = checks.filter(check => check.scope === 'phone-native-qr-image-and-natural-pair-expiry-before-fresh-binding');
const archiveInstalls = [];
if (pairingChecks.length) {
  const directory = resolve(root, '../plugin/artifacts/official-plugin-only');
  for (const name of await readdir(directory)) {
    if (!/^archive-install-[0-9a-f-]+\.json$/.test(name)) continue;
    const report = JSON.parse(await readFile(resolve(directory, name), 'utf8'));
    if (report.passed) archiveInstalls.push(report);
  }
}
for (const check of pairingChecks) {
  assert.equal(check.pairingVerified, true); assert.equal(check.android.pairingVerified, true);
  assert.equal(check.coreInferenceVerified, true);
  const install = archiveInstalls.find(item => item.start.pid === check.officialLaunchPid);
  assert.ok(install, 'Pairing/core must run on the actual archive-installed official Host');
  assert.equal(install.installerExitCode, 0); assert.equal(install.filesCompared, 63);
  assert.equal(install.installedCacheBytesCompared, true); assert.equal(install.profileConfigurationUnchanged, true);
  assert.equal(install.productsBuilt, false); assert.equal(install.dshModified, false);
  assert.equal(install.pluginVersion, check.desktopPluginVersion); assert.equal(install.version, check.version);
  const pairing = check.android.pairing;
  assert.equal(pairing.completed, true); assert.equal(pairing.ownQrImagesRemoved, true);
  assert.equal(pairing.samePairingPageForegroundRestored, true);
  for (const key of ['imageCancel', 'foreignQr', 'camera', 'freshQr'])
    assert.equal(pairing[key].noNewDeviceOrAuthorization, true);
  assert.equal(pairing.imageCancel.inputPreserved, true);
  assert.equal(pairing.foreignQr.invalidRejected, true); assert.equal(pairing.foreignQr.inputPreserved, true);
  assert.equal(pairing.camera.actualNativeScannerOpened, true); assert.equal(pairing.camera.cancelPreservesInput, true);
  assert.equal(pairing.camera.physicalCameraQrRecognitionVerified, false);
  assert.equal(pairing.expiry.naturallyExpired, true); assert.equal(pairing.expiry.databaseExpiryUnchanged, true);
  assert.ok(pairing.expiry.elapsedMs > 298000);
  assert.ok(Date.parse(pairing.expiry.observedAt) >= Date.parse(pairing.expiry.expiresAt));
  for (const key of ['userErrorShown', 'noBindingOrRemotePage', 'noNewDeviceOrAuthorization', 'expiredKeyUnconsumed'])
    assert.equal(pairing.expiredClaim[key], true);
  for (const key of ['actualSystemPickerAndNativeDecode', 'correctServerAndHttpNotice', 'onlyPrefilled'])
    assert.equal(pairing.freshQr[key], true);
  for (const key of ['onlyOnePendingDevice', 'freshKeyConsumed', 'expiredKeyUnconsumed', 'managementNotGranted'])
    assert.equal(pairing.pending[key], true);
  const outcome = JSON.parse(await readFile(resolve(root, '../backend/artifacts/official-plugin-only',
    `official-android-${check.run}.outcome.json`), 'utf8'));
  assert.equal(outcome.exitCode, 0); assert.equal(outcome.unhandledErrors, false);
  assert.equal(outcome.productsBuilt, false); assert.equal(outcome.appInstalled, false);
}
for (const check of referenceChecks) {
  assert.equal(check.referencesVerified, true); assert.equal(check.android.referencesVerified, true);
  assert.equal(check.coreInferenceVerified, true); assert.equal(check.testFilesRemoved, true);
  const references = check.android.references;
  assert.equal(references.completed, true);
  assert.deepEqual(references.entrances.map(entrance => entrance.mode), ['at', 'menu']);
  for (const entrance of references.entrances) {
    assert.equal(entrance.unsubmitted.noImplicitMessageOrTool, true);
    const actual = entrance.actual;
    assert.notEqual(actual.sourceId, check.sessionId);
    assert.ok(actual.userSeq > entrance.initialSeq);
    assert.ok(actual.recallSeq > actual.userSeq); assert.ok(actual.resultSeq > actual.recallSeq);
    assert.ok(actual.replySeq > actual.resultSeq);
    for (const key of ['genuineSourceSnapshot', 'uniqueReadAndReply', 'noAnswerInTargetPrompt',
      'originalHistoryPrefixUnchanged', 'sourceHistoryAndFileUnchanged', 'profileUnchanged'])
      assert.equal(actual[key], true);
  }
  const reconnect = references.entrances[0].structuredReconnect;
  assert.equal(reconnect.originalTextAndEditorPreserved, true);
  assert.equal(reconnect.twoChipsRestored, true);
  assert.equal(reconnect.noImplicitInvocation.noImplicitMessageOrTool, true);
  assert.deepEqual(check.android.approvals.map(approval => approval.outcome), ['allow', 'reject']);
  const outcome = JSON.parse(await readFile(resolve(root, '../backend/artifacts/official-plugin-only',
    `official-android-${check.run}.outcome.json`), 'utf8'));
  assert.equal(outcome.exitCode, 0); assert.equal(outcome.unhandledErrors, false);
  assert.equal(outcome.productsBuilt, false); assert.equal(outcome.appInstalled, false);
}
for (const check of externalChildChecks) {
  assert.equal(check.externalChildVerified, true); assert.equal(check.android.externalChildVerified, true);
  const child = check.android.externalChild;
  assert.equal(child.completed, true); assert.equal(child.settlement.mode, 'external');
  for (const key of ['actualAcpReplyReturned', 'onlyOneCallAndSettlement', 'noLocalChildSession'])
    assert.equal(child.settlement[key], true);
  assert.equal(child.phoneSettlement.actualSettlementReceived, true);
  assert.equal(child.phoneSettlement.selected, check.sessionId);
  assert.equal(child.phoneSettlement.noticeSeq, child.settlement.noticeSeq);
  assert.equal(child.visibleResult.fromNoticeInsteadOfPromptOrArguments, true);
  assert.equal(child.visibleResult.noticeSeq, child.settlement.noticeSeq);
  assert.deepEqual(child.rejectedEntrances, ['openChild', 'openChildAside']);
  for (const key of ['bundleRemoved', 'testPresetRemoved', 'standardUnchanged', 'packageManagerPolicyRestored'])
    assert.equal(check.testExternalPresetCleanup[key], true);
  const policy = JSON.parse(await readFile(resolve(root, '../backend/artifacts/official-plugin-only',
    'official-external-fixtures', check.run, 'policy-baseline.json'), 'utf8'));
  assert.equal(policy.scope, 'non-credential-package-manager-policy');
  assert.equal(resolve(policy.path), resolve(root, '../plugin/artifacts/official-dsh-alpha2/home/profiles/web/pnpm-workspace.yaml'));
  assert.deepEqual(await readFile(policy.path), Buffer.from(policy.bytes, 'base64'));
}
for (const check of childStopChecks) {
  assert.equal(check.childStopVerified, true); assert.equal(check.android.subagentsVerified, true);
  const child = check.android.subagents, stop = child.stop;
  assert.equal(child.completed, true); assert.equal(child.creation.address.mode, 'continuable');
  assert.equal(child.parentHistoryPrefixUnchanged, true); assert.equal(stop.completed, true);
  assert.deepEqual(stop.prepared.permissions,
    { currentValue: 'custom', sandbox: 'read-only', approval: 'never', delegationRecorded: true });
  assert.equal(stop.running.officialChildToolRunning, true);
  assert.equal(stop.running.callId, stop.settled.callId);
  assert.deepEqual(stop.settled.reason, { kind: 'aborted', reason: { kind: 'user' } });
  for (const key of ['originalChildHistoryUnchanged', 'parentHistoryPrefixUnchanged', 'profileUnchanged',
    'onlyReadOnlyCommand', 'noDuplicateCallOrResult', 'noCompletionOrRetry']) assert.equal(stop.settled[key], true);
  assert.ok(stop.settled.resultSeq > stop.prepared.initialSeq);
  assert.ok(stop.continued.userSeq > stop.settled.resultSeq);
  assert.equal(stop.continued.officialResultVerified, true);
  for (const key of ['actualStoppedChildTurnShown', 'parentDraftPreserved', 'childDraftPreserved'])
    assert.equal(stop[key], true);
  const outcome = JSON.parse(await readFile(resolve(root, '../backend/artifacts/official-plugin-only',
    `official-android-${check.run}.outcome.json`), 'utf8'));
  assert.equal(outcome.exitCode, 0); assert.equal(outcome.unhandledErrors, false);
  assert.equal(outcome.productsBuilt, false); assert.equal(outcome.appInstalled, false);
}
for (const check of skillChecks) {
  assert.equal(check.skillsVerified, true); assert.equal(check.android.skillsVerified, true);
  const skill = check.android.skills;
  assert.equal(skill.completed, true); assert.equal(skill.iframeAbsent, true);
  for (const key of ['catalogMatchesOfficial', 'modelInvocationDisabled', 'hiddenExcluded', 'commandCollision'])
    assert.equal(skill.prepared[key], true);
  for (const key of ['hiddenExcluded', 'commandCollisionDisabled', 'manualOnlyShown', 'liveSearch'])
    assert.equal(skill.catalog[key], true);
  assert.equal(skill.source.officialWorkspaceSourceShown, true);
  assert.equal(skill.noInvocation.noMessageOrTurnAdded, true);
  assert.equal(skill.selectionDoesNotSend.noMessageOrTurnAdded, true); assert.equal(skill.noDuplicateToken, true);
  for (const key of ['officialBodyInjected', 'modelReplyFromSkillBody', 'noToolOrCommandExecuted',
    'originalHistoryPrefixUnchanged', 'profileUnchanged']) assert.equal(skill.execution[key], true);
  assert.ok(skill.execution.injectionSeq > skill.execution.userSeq);
  assert.ok(skill.execution.replySeq > skill.execution.injectionSeq);
  assert.equal(check.testFilesRemoved, true); assert.equal(check.testSkillsRemoved.ownSkillsRemoved, true);
  assert.equal(check.testSkillsRemoved.profileUnchanged, true);
  assert.equal(check.skillFixture.files.length, 3);
  const outcome = JSON.parse(await readFile(resolve(root, '../backend/artifacts/official-plugin-only',
    `official-android-${check.run}.outcome.json`), 'utf8'));
  assert.equal(outcome.exitCode, 0); assert.equal(outcome.unhandledErrors, false);
  assert.equal(outcome.productsBuilt, false); assert.equal(outcome.appInstalled, false);
}
for (const check of ptcChecks) {
  assert.equal(check.ptcVerified, true); assert.equal(check.android.ptcVerified, true);
  const ptc = check.android.ptc;
  assert.equal(ptc.completed, true); assert.equal(ptc.selected.preset, 'ptc');
  assert.equal(ptc.selected.permissions, 'read-only');
  for (const result of [ptc.natural, ptc.stopped]) {
    assert.equal(result.officialNestedDispatchVerified, true);
    assert.equal(result.noDuplicateCallOrResult, true); assert.equal(result.onlyReadOnlyCommands, true);
    assert.ok(result.resultSeq > ptc.selected.initialSeq); assert.ok(result.dispatchSeq > ptc.selected.initialSeq);
    assert.ok(result.subCallId.startsWith(result.callId + ':ptc:'));
  }
  assert.equal(ptc.natural.actualResultBodyShown, true); assert.equal(ptc.natural.reason.kind, 'completed');
  assert.deepEqual(ptc.stopped.reason, { kind: 'aborted', reason: { kind: 'user' } });
  assert.equal(ptc.stopped.actualStoppedTurnShown, true); assert.equal(ptc.stopped.emptyDraftRemainsEmpty, true);
  assert.equal(ptc.parentDraftPreserved, true); assert.equal(ptc.iframeAbsent, true);
  assert.equal(ptc.original.originalHistoryPrefixUnchanged, true); assert.equal(ptc.original.profileUnchanged, true);
  assert.equal(check.testPtcUnchanged.unchanged, true);
  const outcome = JSON.parse(await readFile(resolve(root, '../backend/artifacts/official-plugin-only',
    `official-android-${check.run}.outcome.json`), 'utf8'));
  assert.equal(outcome.exitCode, 0); assert.equal(outcome.unhandledErrors, false);
  assert.equal(outcome.productsBuilt, false); assert.equal(outcome.appInstalled, false);
}
for (const check of historyInflightChecks) {
  const outcome = JSON.parse(await readFile(resolve(root, '../backend/artifacts/official-plugin-only',
    `official-android-${check.run}.outcome.json`), 'utf8'));
  assert.equal(outcome.exitCode, 0); assert.equal(outcome.unhandledErrors, false);
  assert.equal(outcome.productsBuilt, false); assert.equal(outcome.appInstalled, false);
  assert.equal(check.historyInflightVerified, true); assert.equal(check.coreInferenceVerified, true);
  assert.equal(check.testFilesRemoved, true); assert.equal(check.externalProxyClosed, true);
  const result = check.android.historyInflight;
  assert.equal(result.passed, true); assert.equal(result.seed.originalHistoryUnchanged, true);
  assert.equal(result.seed.noModelWorkInSeed, true); assert.equal(result.retry.passed, true);
  assert.equal(result.retry.fullOfficialHistoryVerified, true); assert.equal(result.retry.draftPreserved, true);
  assert.deepEqual(result.phases.map(phase => phase.phase), [
    'switch-chat-before-real-page-receipt', 'disconnect-before-real-page-receipt']);
  const switching = result.phases[0], reconnect = result.phases[1];
  assert.equal(switching.release.lateReceiptDelivered, true); assert.equal(switching.release.cancelled, true);
  for (const key of ['otherSessionAndEventsUnchanged', 'otherDraftPreserved', 'noLateErrorInOtherChat'])
    assert.equal(switching[key], true);
  assert.equal(reconnect.noAutomaticOlderPageReplay, true); assert.equal(reconnect.explicitRealPaginationPassed, true);
  assert.equal(reconnect.originalDraftPreserved, true);
  for (const phase of result.phases) {
    assert.equal(phase.held.forwarded, true); assert.equal(phase.held.released, false);
    assert.equal(phase.held.receipt.type, 'result'); assert.equal(phase.held.receipt.value.ok, true);
    assert.ok(phase.held.receipt.value.value.records.length > 0); assert.equal(phase.release.released, true);
  }
}
for (const check of historyChecks) {
  const outcome = JSON.parse(await readFile(resolve(root, '../backend/artifacts/official-plugin-only',
    `official-android-${check.run}.outcome.json`), 'utf8'));
  assert.equal(outcome.exitCode, 0); assert.equal(outcome.unhandledErrors, false);
  assert.equal(outcome.productsBuilt, false); assert.equal(outcome.appInstalled, false);
  assert.equal(check.longHistoryVerified, true); assert.equal(check.coreInferenceVerified, true);
  assert.equal(check.android.approvals.length, 2);
  for (const result of [check.android.longHistory, check.android.longHistoryReconnect]) {
    for (const key of ['passed', 'fullOfficialHistoryVerified', 'noDuplicateMessages',
      'readingPositionPreserved', 'draftPreserved', 'selectedSessionPreserved']) assert.equal(result[key], true);
    assert.equal(result.realModelTurns, 52); assert.ok(result.officialPages.length >= 3);
    for (const phase of result.phases) {
      assert.equal(phase.officialWindowMatched, true); assert.equal(phase.existingEventsUnchanged, true);
      assert.ok(Math.abs(phase.anchorShift) <= 2); assert.equal(phase.draftPreserved, true);
    }
  }
  assert.ok(check.android.longHistory.phases.length >= 2);
}
for (const check of reviewChecks) {
  const outcome = JSON.parse(await readFile(resolve(root, '../backend/artifacts/official-plugin-only',
    `official-android-${check.run}.outcome.json`), 'utf8'));
  assert.equal(outcome.exitCode, 0); assert.equal(outcome.unhandledErrors, false);
  assert.equal(outcome.productsBuilt, false); assert.equal(outcome.appInstalled, false);
  assert.equal(check.reviewPreviewVerified, true); assert.equal(check.coreInferenceVerified, true);
  assert.equal(check.android.approvals.length, 2);
  for (const approval of check.android.approvals) {
    for (const key of ['passed', 'actualSidebarTab', 'originalBeforeApprovalVerified',
      'plannedDiffPreserved', 'officialWritePlannedContentOnly', 'samePendingApproval'])
      assert.equal(approval.plannedPreview[key], true);
  }
  const allowed = check.android.approvals.find(approval => approval.outcome === 'allow');
  const rejected = check.android.approvals.find(approval => approval.outcome === 'reject');
  assert.equal(allowed.actualWriteVerified, true); assert.equal(rejected.rejectedWithoutWrite, true);
  for (const key of ['passed', 'actualCompletedCard', 'actualSidebarTab', 'fullDiffVerified',
    'splitAndWrapVerified', 'selectionRetainedOnReopen', 'currentOriginalFileVerified', 'draftPreserved'])
    assert.equal(allowed.turnReview[key], true);
  assert.equal(allowed.turnReview.officialRecord.sessionId, check.sessionId);
  assert.equal(allowed.turnReview.officialRecord.officialRoutesVerified, true);
  assert.equal(allowed.turnReview.officialRecord.originalFileVerified, true);
}
const desktopChecks = checks.filter(check => ['phone-workspace-file-default-native-open-confirmation',
  'phone-presented-file-native-open-and-explorer-reveal'].includes(check.scope));
for (const check of desktopChecks) {
  const outcome = JSON.parse(await readFile(resolve(root, '../backend/artifacts/official-plugin-only',
    `official-android-${check.run}.outcome.json`), 'utf8'));
  assert.equal(outcome.exitCode, 0); assert.equal(outcome.unhandledErrors, false);
  assert.equal(outcome.productsBuilt, false); assert.equal(outcome.appInstalled, false);
  assert.equal(check.fileDesktopVerified, true); assert.equal(check.filesVerified, true);
  const phone = check.android.files.desktop;
  for (const key of ['passed', 'cancelledWithoutNativeOpen', 'changedFileRefusedBeforeNativeOpen',
    'missingFileRefusedBeforeNativeOpen']) assert.equal(phone[key], true);
  assert.equal(phone.defaultOpen.actualDefaultApplication, 'notepad');
  for (const key of ['documentMatched', 'soleDocumentVerified', 'ownedWindowsClosed', 'unrelatedExplorerPreserved'])
    assert.equal(phone.defaultOpen[key], true);
  assert.equal(phone.sourceRestored.sha256, check.fileFixture.sha256);
  for (const cleanup of [phone.nativeCleanup, check.desktopWindowCleanup]) {
    assert.equal(cleanup.ownedExplorerWindows, 0); assert.equal(cleanup.ownedNotepadWindows, 0);
    assert.deepEqual(cleanup.explorerHandles.sort(), phone.before.explorerHandles.sort());
  }
  if (check.scope === 'phone-presented-file-native-open-and-explorer-reveal') {
    assert.equal(check.filePresentedVerified, true);
    assert.equal(phone.presented.passed, true);
    assert.equal(phone.presented.officialEvent.originalFile, true);
    assert.equal(phone.presented.officialEvent.uniqueActualEvent, true);
    assert.equal(phone.presented.rendering.deliverablesInstalled, true);
    assert.equal(phone.presented.rendering.documentPreviewsInstalled, true);
    assert.equal(phone.presented.preview.actualSidebarTab, true);
    assert.equal(phone.presented.open.actualDefaultApplication, 'notepad');
    assert.equal(phone.presented.open.documentMatched, true);
    assert.equal(phone.presented.reveal.actualFileManager, 'explorer');
    assert.equal(phone.presented.reveal.originalFileSelected, true);
    for (const operation of [phone.presented.open, phone.presented.reveal]) {
      assert.equal(operation.cancelWithoutSideEffect, true); assert.equal(operation.ownedWindowsClosed, true);
      assert.equal(operation.unrelatedExplorerPreserved, true);
    }
    assert.equal(phone.presented.sourceUnchanged.sha256, check.fileFixture.sha256);
    assert.equal(phone.presented.nativeCleanup.ownedExplorerWindows, 0);
    assert.equal(phone.presented.nativeCleanup.ownedNotepadWindows, 0);
  }
}
for (const check of shareChecks) {
  const outcome = JSON.parse(await readFile(resolve(root, '../backend/artifacts/official-plugin-only',
    `official-android-${check.run}.outcome.json`), 'utf8'));
  assert.equal(outcome.exitCode, 0); assert.equal(outcome.unhandledErrors, false);
  assert.equal(outcome.productsBuilt, false); assert.equal(outcome.appInstalled, false);
  assert.equal(check.fileShareVerified, true); assert.equal(check.filesVerified, true);
  const files = check.android.files, share = files.share;
  assert.equal(files.shareReceiverRemoved, true); assert.equal(files.download.fullFileVerified, true);
  for (const key of ['recipientDeliveryVerified', 'independentUid', 'readOnly', 'unrelatedUriDenied',
    'noSentClaim', 'ownSnapshotRemoved']) assert.equal(share[key], true);
  assert.equal(share.received.bytes, check.fileFixture.bytes);
  assert.equal(share.received.sha256, check.fileFixture.sha256);
  assert.equal(share.received.name, check.fileFixture.filename);
  assert.equal(share.received.authority, own + '.remote.files');
  assert.equal(share.received.writeRejected, true); assert.equal(share.received.unrelatedRejected, true);
  assert.equal(share.sourceAfterReceiving.sha256, share.received.sha256);
  assert.equal(share.sourceAfterReceiving.independentRelayReadVerified, true);
}
const backgroundChecks = checks.filter(check => ['phone-background-stop-large-ring-gap-disconnect-and-explicit-resume',
  'phone-background-output-app-process-death-running-and-settled-recovery'].includes(check.scope));
for (const check of backgroundChecks) {
  const outcome = JSON.parse(await readFile(resolve(root, '../backend/artifacts/official-plugin-only',
    `official-android-${check.run}.outcome.json`), 'utf8'));
  assert.equal(outcome.exitCode, 0); assert.equal(outcome.unhandledErrors, false);
  assert.equal(outcome.productsBuilt, false); assert.equal(outcome.appInstalled, false);
  assert.equal(check.backgroundControlVerified, true); assert.equal(check.backgroundVerified, true);
  assert.equal(check.backgroundControlClosed, true); assert.equal(check.testJobsStopRequested, true);
  assert.equal(check.android.backgroundVerified, true); assert.equal(check.android.appInstalledThisRun, false);
  const phone = check.android.background.control;
  assert.equal(phone.passed, true); assert.notEqual(phone.targets.stop.jobId, phone.targets.large.jobId);
  assert.equal(phone.targets.sessionId, check.sessionId); assert.equal(phone.started.callIds.length, 2);
  assert.equal(phone.started.actualModelToolsVerified, true); assert.equal(phone.started.historyPrefixUnchanged, true);
  assert.equal(phone.stopped.actualTerminalStatus, 'killed');
  for (const key of ['actualProducerConnectionClosed', 'noPostStopEnd', 'otherJobStillRunning'])
    assert.equal(phone.stopped[key], true);
  if (check.scope === 'phone-background-output-app-process-death-running-and-settled-recovery') {
    assert.equal(check.backgroundProcessVerified, true); assert.equal(phone.process.passed, true);
    assert.equal(phone.process.cases.length, 2);
    const [running, settled] = phone.process.cases;
    assert.equal(running.kind, 'running'); assert.equal(settled.kind, 'settled-while-dead');
    for (const item of phone.process.cases) {
      assert.match(item.oldPid, /^[1-9]\d*$/); assert.match(item.newPid, /^[1-9]\d*$/);
      assert.notEqual(item.oldPid, item.newPid);
      for (const key of ['actualProcessEnded', 'normalLauncherAndOwnRemotePage', 'originalSessionAndDraftPreserved',
        'noAutomaticOutputWindow', 'explicitOutputReopened', 'retainedBytesMatched', 'passed']) assert.equal(item[key], true);
    }
    assert.equal(running.originalJobStillRunningWhileDead, true); assert.equal(running.outputProducedWhileDead, true);
    assert.equal(settled.originalTerminalWhileDead, 'completed'); assert.equal(settled.originalTerminalRestored, 'completed');
    assert.equal(settled.noPushWhileDead, true);
  } else for (const key of ['previousOffsetPreserved', 'previousTextPreserved', 'explicitRetryRequired'])
    assert.equal(phone.reconnected[key], true);
  assert.ok(phone.offlineOutput.total > 400000); assert.equal(phone.offlineOutput.status, 'running');
  assert.ok(phone.offlineOutput.earliest > phone.beforeDisconnect.offset);
  for (const key of ['gapShown', 'noReplacementCharacter', 'retainedBytesMatched']) assert.equal(phone.resumed[key], true);
  assert.equal(phone.resumed.sha256, phone.offlineOutput.sha256);
  assert.equal(phone.resumed.offset, phone.offlineOutput.total);
  assert.equal(phone.final.actualTerminalStatus, 'completed');
  assert.equal(phone.stderr.gapShown, true); assert.equal(phone.stderr.retainedBytesMatched, true);
  assert.equal(phone.stderr.raw.status, 'running'); assert.equal(phone.stderr.raw.total, phone.offlineOutput.total);
  assert.equal(createHash('sha256').update(phone.stderr.raw.text).digest('hex'), phone.stderr.raw.sha256);
  for (const key of ['cancelledJobStillKilled', 'originalHistoryPrefixUnchanged', 'profileUnchanged',
    'readOnlyPreserved', 'noCommandReplay']) assert.equal(phone.final[key], true);
  for (const stream of ['stdout', 'stderr']) {
    const value = phone.final[stream]; assert.equal(value.status, 'completed');
    assert.equal(Buffer.byteLength(value.text), value.bytes);
    assert.equal(createHash('sha256').update(value.text).digest('hex'), value.sha256);
    assert.equal(value.frames.reduce((sum, frame) => sum + frame.dataBytes, 0), value.bytes);
    assert.equal(value.offset, value.total); assert.ok(value.earliest > 0);
  }
  assert.equal(phone.history.allActualRetainedBytesMatched, true);
  assert.equal(phone.history.sharedRingCoordinateVerified, true);
  const segments = phone.history.segments;
  assert.ok(segments.length >= 4); assert.equal(segments[0].from, 0); assert.equal(segments[0].lossy, true);
  assert.ok(segments[0].start > 0);
  for (let index = 1; index < segments.length; index++) {
    assert.equal(segments[index].from, segments[index - 1].next);
    assert.equal(segments[index].start, segments[index].from); assert.equal(segments[index].lossy, false);
  }
  assert.equal(segments.at(-1).next, phone.offlineOutput.total);
  assert.equal(segments.reduce((sum, frame) => sum + frame.bytes, 0), phone.offlineOutput.bytes);
  assert.equal(phone.draftPreserved, true);
  for (const gate of ['stop', 'large-start', 'large-finish']) {
    const rows = check.backgroundControl.requests.filter(row => row.gate === gate);
    assert.equal(rows.length, 1); assert.equal(rows[0].closed, true); assert.equal(rows[0].released, gate !== 'stop');
  }
}
const backgroundHostChecks = checks.filter(check => check.scope === 'phone-background-host-exit-running-and-completed-output-loss-and-no-replay');
for (const check of backgroundHostChecks) {
  const outcome = JSON.parse(await readFile(resolve(root, '../backend/artifacts/official-plugin-only',
    `official-android-${check.run}.outcome.json`), 'utf8'));
  assert.equal(outcome.exitCode, 0); assert.equal(outcome.unhandledErrors, false);
  assert.equal(outcome.productsBuilt, false); assert.equal(outcome.appInstalled, false);
  assert.equal(check.backgroundHostVerified, true); assert.equal(check.backgroundVerified, true);
  assert.equal(check.backgroundHostControlClosed, true); assert.equal(check.android.backgroundVerified, true);
  assert.equal(check.android.appInstalledThisRun, false);
  const phone = check.android.background.host;
  assert.equal(phone.passed, true); assert.equal(phone.sessionId, check.sessionId);
  assert.match(phone.appPid, /^[1-9]\d*$/); assert.equal(phone.cases.length, 2);
  assert.equal(check.hostStops.length, 2); assert.equal(check.hostStarts.length, 2);
  assert.deepEqual(phone.cases.map(item => item.mode), ['running', 'settled']);
  for (const [index, item] of phone.cases.entries()) {
    assert.equal(item.passed, true); assert.equal(item.started.originalJobAndModelToolMatched, true);
    assert.equal(item.stop.processTreeEnded, true); assert.equal(item.stop.portClosed, true);
    assert.equal(item.stop.sourceConnectionClosed, true);
    assert.equal(item.stop.originalStatus, item.mode === 'running' ? 'running' : 'completed');
    assert.equal(item.start.entry, 'pnpm dsh web'); assert.equal(item.start.loginStatus, 303);
    assert.equal(item.start.pluginStatus, 200); assert.notEqual(item.stop.oldLaunchPid, item.start.launchPid);
    assert.notEqual(item.stop.originalGeneration, item.start.jobControlGeneration);
    assert.equal(item.start.previousGeneration, item.stop.originalGeneration);
    assert.equal(check.hostStops[index].oldLaunchPid, item.stop.oldLaunchPid);
    assert.equal(check.hostStarts[index].launchPid, item.start.launchPid);
    for (const key of ['offlineShownAndReadsPaused', 'sameAppAndOriginalChatAndDraft', 'officialEmptyRosterShown'])
      assert.equal(item[key], true);
    assert.equal(Number(item.oldOutputInvalidatedAndRetryRefused === true) + Number(item.oldOutputWindowClosed === true), 1);
    assert.equal(item.recovered.oldReadRejected, 'remote_job_stale');
    assert.equal(item.recovered.oldStopRejected, 'remote_job_stale');
    assert.equal(item.recovered.outputNoLongerRetained, 'remote_job_missing');
    for (const key of ['generationChanged', 'historyPrefixUnchanged', 'profileUnchanged', 'readOnlyPreserved', 'noCommandReplay'])
      assert.equal(item.recovered[key], true);
    const rows = check.backgroundHostControl.requests.filter(row => row.mode === item.mode);
    assert.equal(rows.length, 1); assert.equal(rows[0].closed, true); assert.equal(rows[0].released, item.mode === 'settled');
  }
  assert.equal(phone.cases[1].completed.originalCompleted, true);
  assert.equal(Buffer.byteLength(phone.cases[1].completed.text), phone.cases[1].completed.bytes);
  assert.equal(createHash('sha256').update(phone.cases[1].completed.text).digest('hex'), phone.cases[1].completed.sha256);
}
const backgroundStopChecks = checks.filter(check => ['phone-background-stop-before-forward-receipt-loss-and-two-real-connections',
  'phone-background-stop-before-forward-receipt-loss-two-connections-and-settled-notice'].includes(check.scope));
for (const check of backgroundStopChecks) {
  const outcome = JSON.parse(await readFile(resolve(root, '../backend/artifacts/official-plugin-only',
    `official-android-${check.run}.outcome.json`), 'utf8'));
  assert.equal(outcome.exitCode, 0); assert.equal(outcome.unhandledErrors, false);
  assert.equal(outcome.productsBuilt, false); assert.equal(outcome.appInstalled, false);
  for (const key of ['backgroundStopVerified', 'backgroundVerified', 'backgroundStopControlClosed', 'externalProxyClosed'])
    assert.equal(check[key], true);
  const phone = check.android.background.stop;
  assert.equal(phone.passed, true); assert.equal(phone.sessionId, check.sessionId);
  assert.match(phone.appPid, /^[1-9]\d*$/);
  assert.deepEqual(phone.cases.map(item => item.mode), ['before-forward', 'after-receipt', 'race']);
  assert.equal(check.jobStopTransport.cuts.length, 2); assert.equal(check.jobStopTransport.races.length, 1);
  assert.equal(check.jobStopTransport.writes.length, 5);
  for (const item of phone.cases) {
    assert.equal(item.passed, true); assert.equal(item.started.originalJobAndModelToolMatched, true);
    assert.equal(item.sameAppAndOriginalChatAndDraft, true); assert.equal(item.settled.originalStatus, 'killed');
    if (check.scope === 'phone-background-stop-before-forward-receipt-loss-two-connections-and-settled-notice')
      assert.equal(item.terminalNoticeSettled, true);
    for (const key of ['sourceClosed', 'noEndMarker', 'originalHistoryPrefixUnchanged', 'profileUnchanged', 'readOnlyPreserved', 'noCommandReplay'])
      assert.equal(item.settled[key], true);
    assert.equal(Buffer.byteLength(item.settled.text), item.settled.bytes);
    assert.equal(createHash('sha256').update(item.settled.text).digest('hex'), item.settled.sha256);
    const producer = check.backgroundStopControl.requests.filter(row => row.mode === item.mode);
    assert.equal(producer.length, 1); assert.equal(producer[0].closed, true);
    const writes = item.settled.writes;
    assert.equal(writes.length, item.mode === 'after-receipt' ? 1 : 2);
    assert.equal(writes.filter(write => write.forwarded).length, item.mode === 'race' ? 2 : 1);
    for (const write of writes) {
      assert.equal(write.operation.method, 'remote.jobStop'); assert.equal(write.operation.sessionId, check.sessionId);
      assert.equal(write.operation.jobId, item.target.jobId); assert.equal(write.operation.startedAt, item.target.startedAt);
    }
    if (item.mode === 'race') {
      assert.equal(item.secondConnection.started, true);
      assert.equal(new Set(writes.map(write => write.bridgeId)).size, 2);
      assert.equal(item.concurrent.receipts.length, 2);
      assert.equal(item.concurrent.receipts.filter(frame => frame.type === 'result' && frame.value.status === 'requested').length, 1);
      assert.ok(item.concurrent.receipts.every(frame => frame.type === 'result' && ['requested', 'already-stopping', 'already-finished'].includes(frame.value.status)));
    } else {
      assert.equal(item.unknownShownAndNoUsableOfflineStop, true); assert.ok(item.offlineStopButtons <= 1);
      assert.equal(item.cut.socketClosed, true); assert.equal(item.cut.mode, item.mode);
      assert.equal(item.cut.forwarded, item.mode === 'after-receipt');
      assert.equal(item.reconnected.noAutomaticReplay, true); assert.equal(item.reconnected.stopRequests, 1);
      assert.equal(item.reconnected.originalStatus, item.mode === 'before-forward' ? 'running' : 'killed');
      if (item.mode === 'before-forward') assert.equal(item.explicitRetry, true);
      else assert.deepEqual(item.cut.receipt, { type: 'result', id: item.cut.id, value: { status: 'requested' } });
    }
  }
}
const exportChecks = checks.filter(check => check.scope === 'phone-session-log-zip-root-descendant-attachment-and-system-save-cancel');
for (const check of exportChecks) {
  const outcome = JSON.parse(await readFile(resolve(root, '../backend/artifacts/official-plugin-only',
    `official-android-${check.run}.outcome.json`), 'utf8'));
  assert.equal(outcome.exitCode, 0); assert.equal(outcome.unhandledErrors, false);
  assert.equal(outcome.productsBuilt, false); assert.equal(outcome.appInstalled, false);
  assert.equal(check.sessionExportVerified, true); assert.equal(check.subagentsVerified, true);
  assert.equal(check.android.sessionExportVerified, true); assert.equal(check.android.appInstalledThisRun, false);
  const phone = check.android.sessionExport;
  for (const key of ['passed', 'draftPreserved', 'ownCopiesRemoved']) assert.equal(phone[key], true);
  for (const key of ['uniqueActualAttachment', 'originalChildVerified']) assert.equal(phone.prepared[key], true);
  assert.equal(phone.prepared.rootId, check.sessionId); assert.notEqual(phone.prepared.childId, check.sessionId);
  assert.deepEqual(phone.saves.map(value => value.includeDescendants), [false, true]);
  for (const item of phone.saves) {
    for (const key of ['actualSystemSave', 'spansResourceWindow', 'originalEntriesByteMatched',
      'originalRootEventsMatched', 'originalAttachmentMatched']) assert.equal(item[key], true);
    assert.equal(item.includeDescendants ? item.originalChildEventsMatched : item.childExcluded, true);
    const zip = await readFile(resolve(root, 'artifacts/official-plugin-only', check.run,
      item.includeDescendants ? 'session-export-descendants.zip' : 'session-export-root.zip'));
    assert.equal(zip.length, item.zipBytes); assert.ok(zip.length > 4 * 65536);
    assert.equal(createHash('sha256').update(zip).digest('hex'), item.zipSha256);
    const entries = unzipSync(zip), names = Object.keys(entries).sort();
    assert.deepEqual(names, item.names);
    const main = names.find(name => !name.includes('/') && name.endsWith('.jsonl'));
    assert.ok(main);
    const parse = name => Buffer.from(entries[name]).toString('utf8').trimEnd().split('\n').map(line => JSON.parse(line));
    const [header, ...events] = parse(main);
    assert.equal(header.id, check.sessionId); assert.equal(events.length, phone.prepared.rootEvents);
    const childPath = `subagents/${phone.prepared.childId}/${main}`;
    if (item.includeDescendants) {
      const [childHeader, ...childEvents] = parse(childPath);
      assert.equal(childHeader.id, phone.prepared.childId); assert.equal(childEvents.length, phone.prepared.childEvents);
    } else assert.equal(entries[childPath], undefined);
    const id = phone.prepared.ref.attachmentId.replace(/^sha256:/, '');
    const filePath = `files/${id.slice(0, 2)}/${id}/${phone.prepared.ref.name}`;
    assert.equal(entries[filePath].length, phone.prepared.ref.bytes);
    assert.equal(createHash('sha256').update(entries[filePath]).digest('hex'), phone.unchanged.originalAttachmentSha256);
    assert.deepEqual(names, [main, filePath, ...(item.includeDescendants ? [childPath] : [])].sort());
  }
  for (const key of ['actualSystemWindowCancelled', 'privateCacheEmpty', 'noSuccessNotice']) assert.equal(phone.cancelled[key], true);
  for (const key of ['rootHistoryUnchanged', 'childHistoryUnchanged', 'profileUnchanged', 'noPromptReplay']) assert.equal(phone.unchanged[key], true);
}
const promptHostChecks = checks.filter(check => check.scope === 'phone-plain-message-host-exit-before-forward-and-after-acceptance-recovery');
for (const check of promptHostChecks) {
  const output = resolve(root, '../backend/artifacts/official-plugin-only');
  const outcome = JSON.parse(await readFile(resolve(output, `official-android-${check.run}.outcome.json`), 'utf8'));
  assert.equal(outcome.exitCode, 0); assert.equal(outcome.unhandledErrors, false);
  assert.equal(outcome.productsBuilt, false); assert.equal(outcome.appInstalled, false);
  assert.equal(check.coreInferenceVerified, false); assert.equal(check.promptSendingVerified, true);
  assert.equal(check.promptHostVerified, true); assert.equal(check.android.promptHostVerified, true);
  assert.equal(check.android.appInstalledThisRun, false); assert.equal(check.externalProxyClosed, true);
  const phone = JSON.parse(await readFile(resolve(root, 'artifacts/official-plugin-only', check.run, 'prompt-host.json'), 'utf8'));
  assert.deepEqual(phone, check.android.promptSending); assert.equal(phone.passed, true);
  assert.equal(phone.sessionId, check.sessionId); assert.equal(phone.twoActualHostExits, true);
  assert.equal(phone.sameProcessAndOriginalSession, true); assert.match(phone.appPid, /^[1-9]\d*$/);
  for (const key of ['passed', 'noDuplicateOriginalUserMessages', 'explicitNewTasksHaveRealReplies',
    'settledOriginalNotReexecuted', 'originalHistoryPrefixUnchanged', 'profileModelPermissionsUnchanged'])
    assert.equal(phone.final[key], true);
  const transport = check.promptSendingTransport;
  assert.equal(transport.externalProxy, true); assert.equal(transport.frontPort, 16956); assert.equal(transport.backendPort, 16957);
  assert.equal(transport.cuts.length, 2); assert.equal(transport.writes.length, 5);
  assert.equal(check.promptHostStops.length, 2); assert.equal(check.promptHostStarts.length, 2);
  assert.deepEqual(phone.phases.map(item => item.phase), ['before-forward', 'after-receipt']);
  for (const [index, phase] of phone.phases.entries()) {
    const held = phase.held, disconnected = phase.stop.disconnected, cut = transport.cuts[index], settled = phase.settled;
    assert.equal(held.awaitingHostExit, true); assert.equal(held.socketClosed, false);
    assert.deepEqual(held.hostDisconnectFrames, []); assert.deepEqual(settled.cut, held);
    assert.deepEqual(cut.request, held.request); assert.equal(cut.id, held.id); assert.equal(cut.bridgeId, held.bridgeId);
    assert.equal(cut.forwarded, held.forwarded); assert.deepEqual(cut.receipt, held.receipt);
    assert.equal(cut.awaitingHostExit, true); assert.equal(typeof cut.socketClosed, 'boolean');
    assert.ok(disconnected.hostDisconnectFrames.length > 0);
    assert.deepEqual(cut.hostDisconnectFrames.slice(0, disconnected.hostDisconnectFrames.length), disconnected.hostDisconnectFrames);
    assert.equal(new Set(cut.hostDisconnectFrames.map(frame => frame.id)).size, cut.hostDisconnectFrames.length);
    for (const frame of cut.hostDisconnectFrames) {
      assert.equal(frame.type, 'error'); assert.equal(frame.code, 'host_disconnected_outcome_unknown');
    }
    assert.equal(cut.request.sessionId, check.sessionId); assert.equal(cut.request.mode, 'queue');
    assert.equal(cut.request.clientTimeZone, transport.writes[0].request.clientTimeZone);
    assert.doesNotThrow(() => new Intl.DateTimeFormat('zh-CN', { timeZone: cut.request.clientTimeZone }));
    assert.deepEqual(phase.stop.stopped, check.promptHostStops[index]);
    assert.deepEqual(phase.start, check.promptHostStarts[index]);
    assert.equal(phase.stop.stopped.processTreeEnded, true); assert.equal(phase.stop.stopped.portClosed, true);
    assert.equal(phase.stop.realHostDisconnectForwarded, true); assert.match(phase.stop.checkpointSha256, /^[0-9a-f]{64}$/);
    assert.equal(phase.start.entry, 'pnpm dsh web'); assert.equal(phase.start.loginStatus, 303); assert.equal(phase.start.pluginStatus, 200);
    assert.notEqual(phase.start.launchPid, phase.stop.stopped.oldLaunchPid);
    assert.equal(phase.stop.stopped.oldLaunchPid, index ? phone.phases[0].start.launchPid : check.officialLaunchPid);
    assert.equal(phase.unknownDraftPreservedWhileHostOffline, true);
    assert.equal(phase.recovered.noAutomaticReplay, true); assert.equal(phase.recovered.requestCount, 1);
    assert.equal(phase.recovered.originalRequestId, held.request.requestId);
    assert.deepEqual(phone.final.phases[index], settled);
    assert.deepEqual(transport.writes.filter(write => write.request.content[0].text === cut.request.content[0].text), settled.writes);
    if (index === 0) {
      assert.equal(phase.stop.originalRunningAtStop, false); assert.equal(cut.forwarded, false); assert.equal(cut.receipt, undefined);
      assert.equal(phase.recovered.noOfficialUserOrTurn, true); assert.equal(phase.unreceivedDraftRetainedAfterReconnect, true);
      assert.equal(phase.explicitRetryClicked, true); assert.equal(settled.explicitRetryOnly, true);
      assert.equal(settled.writes.length, 2); assert.equal(settled.writes.filter(write => write.forwarded).length, 1);
      assert.notEqual(settled.requestId, held.request.requestId); assert.equal(settled.reply.source.model, check.android.phoneInference.source.model);
    } else {
      assert.equal(phase.stop.originalRunningAtStop, true); assert.equal(cut.forwarded, true);
      assert.equal(cut.receipt.type, 'result'); assert.equal(cut.receipt.id, cut.id);
      assert.equal(cut.receipt.value.ok, true); assert.equal(cut.receipt.value.value.accepted, true);
      assert.equal(cut.withheldTypes.at(-1), 'result'); assert.equal(phase.confirmedOriginalDraftCleared, true);
      assert.equal(phase.recovered.originalSettledWithoutReplay, true);
      assert.ok(['completed', 'interrupted'].includes(phase.recovered.reason.kind));
      assert.equal(phase.recovered.reason.kind === 'interrupted' ? phase.interruptedOriginalShownWithoutRetry
        : phase.completedOriginalShownWithoutRetry, true);
      assert.equal(phase.explicitNewFollowup, true); assert.equal(settled.writes.length, 1);
      assert.equal(settled.recovered.originalRequestId, held.request.requestId); assert.equal(settled.followup.writes.length, 1);
      assert.equal(settled.followup.writes[0].forwarded, true); assert.notEqual(settled.followup.requestId, held.request.requestId);
      assert.equal(settled.followup.reply.source.model, check.android.phoneInference.source.model);
    }
  }
  assert.equal(phone.phases[0].start.jobControlGeneration === phone.phases[1].start.jobControlGeneration, false);
  const firstIds = new Set(transport.cuts[0].hostDisconnectFrames.map(frame => frame.id));
  assert.ok(transport.cuts[1].hostDisconnectFrames.every(frame => !firstIds.has(frame.id)));
}
for (const [name, count] of [['initial', 13], ['followup', 15], ['ordering', 14], ['arrival', 14]]) {
  let failed;
  try {
    failed = JSON.parse(await readFile(resolve(root, '../backend/artifacts/official-plugin-only',
      `prompt-host-${name}-failure-restoration.json`), 'utf8'));
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!failed) continue;
  assert.equal(failed.exitCode, 1); assert.equal(failed.cleanupCompleted, true); assert.equal(failed.rawOriginalsPreserved, true);
  assert.equal(failed.restoration.original.pid, '4249'); assert.equal(failed.restoration.remoteDisabled, true);
  assert.equal(failed.originals.length, count);
  for (const file of failed.originals) {
    const contents = await readFile(resolve(root, '../backend', file.path));
    assert.equal(contents.length, file.bytes); assert.equal(createHash('sha256').update(contents).digest('hex'), file.sha256);
  }
}
const attachmentSendingChecks = checks.filter(check => ['phone-file-upload-partial-before-forward-and-receipt-loss-reconnect',
  'phone-file-upload-and-submission-app-exit-original-blob-and-session-recovery',
  'phone-file-upload-and-submission-host-exit-original-blob-and-session-recovery'].includes(check.scope));
for (const check of attachmentSendingChecks) {
  const processExit = check.scope === 'phone-file-upload-and-submission-app-exit-original-blob-and-session-recovery';
  const hostExit = check.scope === 'phone-file-upload-and-submission-host-exit-original-blob-and-session-recovery';
  const output = resolve(root, '../backend/artifacts/official-plugin-only');
  const outcome = JSON.parse(await readFile(resolve(output, `official-android-${check.run}.outcome.json`), 'utf8'));
  assert.equal(outcome.exitCode, 0); assert.equal(outcome.unhandledErrors, false);
  assert.equal(outcome.productsBuilt, false); assert.equal(outcome.appInstalled, false);
  assert.equal(check.attachmentSendingVerified, true); assert.equal(check.coreInferenceVerified, false);
  assert.equal(check.android.attachmentSendingVerified, true); assert.equal(check.android.appInstalledThisRun, false);
  assert.equal(check.externalProxyClosed, true);
  const phone = JSON.parse(await readFile(resolve(root, 'artifacts/official-plugin-only', check.run, 'attachment-sending.json'), 'utf8'));
  assert.deepEqual(phone, check.android.attachmentSending);
  assert.equal(phone.passed, true); assert.equal(phone.ownCopiesRemoved, true);
  if (processExit) {
    assert.equal(check.attachmentProcessVerified, true); assert.equal(check.android.attachmentProcessVerified, true);
    assert.equal(phone.threeActualExitsAndOriginalSession, true);
    const exits = [phone.partialUpload, ...phone.phases];
    assert.equal(exits.length, 3); assert.equal(new Set(exits.flatMap(item => [item.oldPid, item.newPid])).size, 4);
    assert.equal(phone.initialAppPid, exits[0].oldPid); assert.equal(phone.appPid, exits[2].newPid);
    for (const [index, item] of exits.entries()) {
      assert.match(item.oldPid, /^[1-9]\d*$/); assert.match(item.newPid, /^[1-9]\d*$/);
      assert.notEqual(item.oldPid, item.newPid); assert.equal(item.actualProcessEnded, true);
      assert.equal(item.normalLauncherAndExistingBinding, true);
      assert.equal(item.held.awaitingProcessExit, true); assert.equal(item.held.socketClosed, false);
      assert.equal(item.cut.awaitingProcessExit, true); assert.equal(item.cut.socketClosed, true);
      assert.deepEqual({ ...item.held, socketClosed: true }, item.cut);
      if (index) assert.equal(exits[index - 1].newPid, item.oldPid);
      if (index === 0) assert.equal(item.originalUploadClosedByAppExit, true);
      else assert.equal(item.originalRequestClosedByAppExit, true);
    }
  } else assert.equal(phone.sameProcessAndSession, true);
  if (hostExit) {
    assert.equal(check.attachmentHostVerified, true); assert.equal(check.android.attachmentHostVerified, true);
    assert.equal(phone.threeActualHostExitsAndOriginalSession, true); assert.equal(phone.appPid, phone.initialAppPid);
    const exits = [phone.partialUpload, ...phone.phases];
    assert.equal(check.attachmentHostStops.length, 3); assert.equal(check.attachmentHostStarts.length, 3);
    assert.equal(new Set(check.attachmentHostStarts.map(item => item.jobControlGeneration)).size, 3);
    for (const [index, item] of exits.entries()) {
      assert.equal(item.held.awaitingHostExit, true); assert.equal(item.held.socketClosed, false);
      assert.deepEqual(item.held.hostDisconnectFrames, []);
      assert.deepEqual(item.stop.stopped, check.attachmentHostStops[index]);
      assert.deepEqual(item.start, check.attachmentHostStarts[index]);
      assert.equal(item.stop.stopped.processTreeEnded, true); assert.equal(item.stop.stopped.portClosed, true);
      assert.equal(item.stop.realHostDisconnectForwarded, true);
      assert.equal(item.stop.originalRunningAtStop, index === 2);
      assert.equal(createHash('sha256').update(JSON.stringify(item.stop.checkpointRecords)).digest('hex'), item.stop.checkpointSha256);
      assert.equal(item.start.entry, 'pnpm dsh web'); assert.equal(item.start.loginStatus, 303); assert.equal(item.start.pluginStatus, 200);
      assert.notEqual(item.start.launchPid, item.stop.stopped.oldLaunchPid);
      assert.equal(item.stop.stopped.oldLaunchPid, index ? exits[index - 1].start.launchPid : check.officialLaunchPid);
      const frames = item.stop.disconnected.hostDisconnectFrames; assert.ok(frames.length > 0);
      assert.equal(new Set(frames.map(frame => frame.id)).size, frames.length);
      assert.ok(frames.every(frame => frame.type === 'error' && frame.code === 'host_disconnected_outcome_unknown'));
      assert.equal(item.cut.id, item.held.id); assert.equal(item.cut.bridgeId, item.held.bridgeId);
      assert.deepEqual(item.cut.hostDisconnectFrames, frames);
      if (index === 0) {
        assert.equal(item.originalUploadEndedByHostExit, true); assert.ok(frames.some(frame => frame.id === item.cut.id));
      } else {
        assert.equal(item.originalRequestInterruptedByHostExit, true);
        assert.deepEqual(item.cut.request, item.held.request); assert.deepEqual(item.cut.receipt, item.held.receipt);
        assert.equal(item.cut.forwarded, item.held.forwarded);
      }
    }
  }
  assert.equal(phone.sessionId, check.sessionId); assert.match(phone.appPid, /^[1-9]\d*$/);
  assert.equal(phone.final.passed, true); assert.equal(phone.final.originalFilesAndHistoryVerified, true);
  assert.equal(phone.final.noDuplicateOriginalMessages, true); assert.equal(phone.final.wrongSessionDenied, true);
  assert.equal(phone.final.profileModelPermissionsUnchanged, true);
  const transport = check.promptSendingTransport, fixtures = check.attachmentFixtures;
  const publicHistory = phone.final.history ? { run: check.run, sessionId: check.sessionId, ...phone.final.history }
    : JSON.parse(await readFile(resolve(output, `attachment-sending-public-history-${check.run}.json`), 'utf8'));
  assert.equal(publicHistory.run, check.run); assert.equal(publicHistory.sessionId, check.sessionId);
  assert.equal(transport.externalProxy, true); assert.equal(transport.frontPort, 16956); assert.equal(transport.backendPort, 16957);
  assert.equal(transport.uploads.length, 4); assert.equal(transport.uploadCuts.length, 1);
  assert.equal(transport.cuts.length, 2); assert.equal(transport.writes.length, hostExit ? 5 : 4); assert.equal(fixtures.length, 2);
  const original = (state, file, expectedStates) => {
    assert.equal(state.selected, check.sessionId); assert.equal(state.files.length, 1);
    const item = state.files[0]; assert.equal(item.name, file.name); assert.equal(item.bytes, file.bytes);
    assert.equal(item.sourceBytes, file.bytes); assert.equal(item.sha256, file.sha256);
    if (expectedStates) assert.ok(expectedStates.includes(item.state));
  };
  const partial = phone.partialUpload;
  if (hostExit) {
    assert.deepEqual(phone.final.partial, partial.held);
    // 同一手机桥接仍服务后两次Host退出；逐次核对当时冻结的真实错误前缀。
    assert.deepEqual(transport.uploadCuts[0].hostDisconnectFrames.slice(0, partial.cut.hostDisconnectFrames.length),
      partial.cut.hostDisconnectFrames);
    assert.deepEqual({ ...partial.cut, socketClosed: transport.uploadCuts[0].socketClosed,
      hostDisconnectFrames: transport.uploadCuts[0].hostDisconnectFrames }, transport.uploadCuts[0]);
    original(partial.preHostOriginal, fixtures[0], ['uploading']);
  } else {
    assert.deepEqual(partial.cut, transport.uploadCuts[0]); assert.deepEqual(phone.final.partial, partial.cut);
    assert.equal(partial.cut.socketClosed, true);
  }
  assert.equal(partial.cut.forwardedBytes, 65536);
  assert.equal(partial.cut.endForwarded, false); assert.equal(partial.cut.receipt, undefined);
  assert.equal(partial.cut.consumedCredit.value.count, 1); assert.equal(partial.cut.consumedCredit.id, partial.cut.id);
  assert.equal(partial.reconnected.noAutomaticUploadOrMessage, true); assert.equal(partial.explicitPrepareClicked, true);
  original(processExit ? partial.preExitOriginal : partial.offlineOriginal, fixtures[0], processExit ? ['uploading'] : undefined);
  original(partial.restoredOriginal, fixtures[0], processExit ? ['restored'] : ['restored', 'error']);
  assert.equal(partial.restoredOriginal.files[0].hasReceipt, false); assert.equal(partial.restoredOriginal.files[0].hasFileRef, false);
  const prepared = (value, file, count) => {
    assert.equal(value.count, count); assert.equal(value.realOfficialReceipt, true); assert.equal(value.originalBytesVerified, true);
    const row = value.upload; assert.deepEqual(row, transport.uploads.find(item => item.id === row.id));
    assert.equal(row.operation.sessionId, check.sessionId); assert.equal(row.operation.name, file.name);
    assert.equal(row.endForwarded, true); assert.equal(row.forwardedBytes, file.bytes); assert.equal(row.sha256, file.sha256);
    assert.equal(row.chunks.reduce((sum, item) => sum + item.bytes, 0), file.bytes);
    assert.ok(row.chunks.every(item => item.forwarded && item.bytes > 0 && item.bytes <= 65536));
    assert.equal(row.receipt.type, 'result'); assert.equal(row.receipt.id, row.id); assert.equal(row.receipt.value.ok, true);
    assert.equal(row.receipt.value.value.file.name, file.name); assert.equal(row.receipt.value.value.file.bytes, file.bytes);
    assert.equal(typeof row.receipt.value.value.receiptId, 'string');
  };
  prepared(partial.prepared, fixtures[0], 2);
  assert.deepEqual(phone.phases.map(item => item.phase), ['before-forward', 'after-receipt']);
  for (const [index, phase] of phone.phases.entries()) {
    const file = fixtures[index], settled = phase.settled, cut = phase.cut;
    const preRecovery = processExit ? phase.preExitOriginal : hostExit ? phase.preHostOriginal : phase.offlineOriginal;
    original(preRecovery, file); assert.equal(preRecovery.draft, cut.request.content[0].text);
    if (hostExit) assert.deepEqual({ ...cut, socketClosed: transport.cuts[index].socketClosed }, transport.cuts[index]);
    else { assert.deepEqual(cut, transport.cuts[index]); assert.equal(cut.socketClosed, true); }
    assert.equal(cut.request.content.length, 2); assert.equal(cut.request.content[1].type, 'file');
    assert.equal(cut.request.sessionId, check.sessionId); assert.equal(cut.request.mode, 'queue');
    assert.ok(!cut.request.content[0].text.includes(settled.marker));
    assert.equal(phase.reconnected.noAutomaticResend, true); assert.equal(settled.originalBytesVerified, true);
    assert.equal(settled.attachment.name, file.name); assert.equal(settled.attachment.bytes, file.bytes);
    assert.equal(settled.reply.source.model, check.android.phoneInference.source.model);
    const users = publicHistory.records.filter(row => row.event.type === 'user/message'
      && row.event.data.source?.rpcId === settled.requestId);
    assert.equal(users.length, 1); assert.equal(users[0].event.seq, settled.userSeq);
    const followup = hostExit && index === 1 ? publicHistory.records.filter(row => row.event.type === 'user/message'
      && row.event.data.source?.rpcId === settled.followup.requestId) : undefined;
    if (followup) {
      assert.equal(followup.length, 1); assert.equal(followup[0].event.data.content.length, 1);
      assert.ok(!followup[0].event.data.content[0].text.includes(settled.marker));
      assert.equal(phase.explicitNewFollowup, true); assert.equal(settled.followup.explicitNewRequest, true);
      assert.equal(settled.followup.writes.length, 1); assert.equal(settled.followup.writes[0].forwarded, true);
      assert.notEqual(settled.followup.requestId, settled.requestId);
      assert.equal(phase.reconnected.originalSettledWithoutReplay, true);
      assert.ok(['completed', 'interrupted'].includes(phase.reconnected.reason.kind));
      assert.equal(phase.reconnected.reason.kind === 'interrupted' ? phase.interruptedOriginalShownWithoutRetry
        : phase.completedOriginalShownWithoutRetry, true);
      assert.deepEqual(transport.writes.filter(write => write.request.requestId === settled.followup.requestId), settled.followup.writes);
      const ends = publicHistory.records.filter(row => row.event.type === 'turn/end'
        && row.event.seq > settled.userSeq && row.event.seq < followup[0].event.seq);
      assert.equal(ends.length, 1); assert.equal(ends[0].event.seq, phase.reconnected.endSeq);
      assert.deepEqual(ends[0].event.data.reason, phase.reconnected.reason);
    }
    const reads = publicHistory.records.filter(row => row.event.type === 'tool/call' && row.event.data.name === 'read'
      && row.event.seq > (followup ? followup[0].event.seq : settled.userSeq) && row.event.seq < settled.reply.assistantSeq);
    assert.equal(reads.length, 1);
    const input = JSON.parse(reads[0].event.data.arguments), path = input.file_path.replaceAll('\\', '/').replace(/\/+/g, '/');
    assert.equal(input.limit, 1); assert.ok(path.includes('/attachments/v1/files/'));
    assert.ok(path.includes(file.sha256)); assert.ok(path.endsWith('/' + file.name));
    assert.deepEqual(settled, phone.final.phases[index]);
    assert.deepEqual(transport.writes.filter(write => write.request.content[0].text === cut.request.content[0].text), settled.writes);
    const accepted = settled.writes.filter(write => write.forwarded); assert.equal(accepted.length, 1);
    assert.equal(accepted[0].request.requestId, settled.requestId);
    if (phase.phase === 'before-forward') {
      assert.equal(cut.forwarded, false); assert.equal(cut.receipt, undefined);
      assert.equal(phase.reconnected.noOriginalUserMessage, true); original(phase.uncertainOriginal, file, ['uncertain']);
      assert.equal(phase.explicitReselectAndNewSend, true); prepared(phase.reselected, file, 3);
      assert.equal(settled.writes.length, 2); assert.notEqual(settled.requestId, cut.request.requestId);
      assert.equal(publicHistory.records.filter(row => row.event.type === 'user/message'
        && row.event.data.source?.rpcId === cut.request.requestId).length, 0);
      assert.equal(accepted[0].request.content[1].receiptId, phase.reselected.upload.receipt.value.value.receiptId);
    } else {
      prepared(phase.prepared, file, 1); assert.equal(cut.forwarded, true);
      assert.equal(cut.receipt.type, 'result'); assert.equal(cut.receipt.value.ok, true);
      assert.equal(cut.receipt.value.value.accepted, true); assert.equal(cut.withheldTypes.at(-1), 'result');
      assert.equal(phase.originalReceiptClearedDraftAndAttachment, true); assert.equal(settled.writes.length, 1);
      assert.equal(settled.requestId, cut.request.requestId);
    }
  }
  const failure = JSON.parse(await readFile(resolve(output, 'attachment-state-failure-restoration.json'), 'utf8'));
  assert.equal(failure.run, 'ef526e51-922e-403d-b0b9-6472743acc72'); assert.equal(failure.passed, false);
  assert.equal(failure.rawOriginalsPreserved, true); assert.equal(failure.cleanupVerified, true);
  assert.equal(failure.restoration.original.pid, '4249'); assert.equal(failure.originals.length, 9);
  for (const original of failure.originals) {
    const bytes = await readFile(resolve(root, '..', original.path));
    assert.equal(bytes.length, original.bytes); assert.equal(createHash('sha256').update(bytes).digest('hex'), original.sha256);
  }
  if (processExit) {
    const failed = JSON.parse(await readFile(resolve(output, 'attachment-process-editor-failure-restoration.json'), 'utf8'));
    assert.equal(failed.run, 'ad30c71e-b9e7-48d5-a4c2-0877586ac822'); assert.equal(failed.passed, false);
    assert.equal(failed.rawOriginalsPreserved, true); assert.equal(failed.cleanupVerified, true);
    assert.equal(failed.restoration.runs.length, 65); assert.equal(failed.restoration.original.pid, '4249');
    assert.equal(failed.originals.length, 10);
    for (const original of failed.originals) {
      const bytes = await readFile(resolve(root, '..', original.path));
      assert.equal(bytes.length, original.bytes); assert.equal(createHash('sha256').update(bytes).digest('hex'), original.sha256);
    }
  }
}
const promptSendingChecks = checks.filter(check => ['phone-plain-message-before-forward-and-receipt-loss-reconnect',
  'phone-plain-message-app-exit-before-forward-and-after-acceptance-recovery'].includes(check.scope));
for (const check of promptSendingChecks) {
  const processExit = check.scope === 'phone-plain-message-app-exit-before-forward-and-after-acceptance-recovery';
  const output = resolve(root, '../backend/artifacts/official-plugin-only');
  const outcome = JSON.parse(await readFile(resolve(output, `official-android-${check.run}.outcome.json`), 'utf8'));
  assert.equal(outcome.exitCode, 0); assert.equal(outcome.unhandledErrors, false);
  assert.equal(outcome.productsBuilt, false); assert.equal(outcome.appInstalled, false);
  assert.equal(check.promptSendingVerified, true); assert.equal(check.coreInferenceVerified, false);
  assert.equal(check.android.promptSendingVerified, true); assert.equal(check.android.appInstalledThisRun, false);
  assert.equal(check.externalProxyClosed, true);
  const phone = JSON.parse(await readFile(resolve(root, 'artifacts/official-plugin-only', check.run, 'prompt-sending.json'), 'utf8'));
  assert.deepEqual(phone, check.android.promptSending);
  assert.equal(phone.passed, true); assert.equal(phone.sessionId, check.sessionId);
  if (processExit) {
    assert.equal(check.promptProcessVerified, true); assert.equal(check.android.promptProcessVerified, true);
    assert.equal(phone.twoActualExitsAndOriginalSession, true);
    assert.equal(new Set(phone.phases.flatMap(item => [item.oldPid, item.newPid])).size, 3);
    assert.equal(phone.phases[0].newPid, phone.phases[1].oldPid); assert.equal(phone.appPid, phone.phases[1].newPid);
  } else assert.equal(phone.sameProcessAndSession, true);
  assert.equal(phone.final.passed, true); assert.equal(phone.final.originalHistoryPrefixUnchanged, true);
  assert.equal(phone.final.noDuplicateUserMessagesOrRealReplies, true); assert.equal(phone.final.profileModelPermissionsUnchanged, true);
  const transport = check.promptSendingTransport;
  assert.equal(transport.externalProxy, true); assert.equal(transport.frontPort, 16956); assert.equal(transport.backendPort, 16957);
  assert.equal(transport.cuts.length, 2); assert.equal(transport.writes.length, 4);
  assert.deepEqual(phone.phases.map(item => item.phase), ['before-forward', 'after-receipt']);
  for (const [index, phase] of phone.phases.entries()) {
    const cut = phase.disconnected.cut, settled = phase.settled, accepted = settled.writes.filter(write => write.forwarded);
    assert.deepEqual(cut, transport.cuts[index]); assert.equal(cut.socketClosed, true);
    assert.equal(cut.request.sessionId, check.sessionId); assert.equal(cut.request.mode, 'queue');
    assert.equal(cut.request.clientTimeZone, transport.writes[0].request.clientTimeZone);
    assert.doesNotThrow(() => new Intl.DateTimeFormat('zh-CN', { timeZone: cut.request.clientTimeZone }));
    if (processExit) {
      assert.match(phase.oldPid, /^[1-9]\d*$/); assert.match(phase.newPid, /^[1-9]\d*$/);
      assert.notEqual(phase.oldPid, phase.newPid); assert.equal(phase.actualProcessEnded, true);
      assert.equal(phase.originalRequestClosedByAppExit, true); assert.equal(phase.normalLauncherAndExistingBinding, true);
      assert.equal(phase.held.awaitingProcessExit, true); assert.equal(phase.held.socketClosed, false);
      assert.deepEqual({ ...phase.held, socketClosed: true }, cut);
    } else assert.equal(phase.originalDraftRetainedWhileUnknown, true);
    assert.equal(phase.reconnected.noAutomaticReplay, true); assert.equal(phase.reconnected.requestCount, 1);
    assert.equal(phase.reconnected.originalRequestId, cut.request.requestId);
    assert.equal(settled.singleRealTurn, true); assert.equal(settled.profileModelPermissionsUnchanged, true);
    assert.equal(settled.noAutomaticReplay, true); assert.equal(accepted.length, 1);
    assert.equal(settled.originalRequestId, accepted[0].request.requestId);
    assert.equal(settled.reply.source.model, check.android.phoneInference.source.model);
    assert.deepEqual(phone.final.phases[index], settled);
    assert.deepEqual(transport.writes.filter(write => write.request.content[0].text === cut.request.content[0].text), settled.writes);
    if (phase.phase === 'before-forward') {
      assert.equal(cut.forwarded, false); assert.equal(cut.receipt, undefined);
      assert.equal(phase.disconnected.noOfficialReceiptOrEvent, true); assert.equal(phase.disconnected.unchangedHistory, true);
      assert.equal(phase.unreceivedDraftRetainedAfterReconnect, true); assert.equal(phase.explicitRetryClicked, true);
      assert.equal(settled.writes.length, 2); assert.notEqual(settled.originalRequestId, cut.request.requestId);
    } else {
      assert.equal(cut.forwarded, true); assert.equal(cut.receipt.type, 'result'); assert.equal(cut.receipt.id, cut.id);
      assert.equal(cut.receipt.value.ok, true); assert.equal(cut.withheldTypes.at(-1), 'result');
      assert.equal(phase.disconnected.modelCompletedWhilePhoneOffline, true);
      assert.equal(phase.confirmedDraftClearedFromOriginalRequest, true); assert.equal(settled.writes.length, 1);
      assert.equal(settled.originalRequestId, cut.request.requestId);
    }
  }
}
const feedbackChecks = checks.filter(check => check.scope === 'phone-message-and-session-feedback-live-sync-reconnect-and-local-otlp');
for (const check of feedbackChecks) {
  const evidence = resolve(root, '../backend/artifacts/official-plugin-only');
  const outcome = JSON.parse(await readFile(resolve(evidence, `official-android-${check.run}.outcome.json`), 'utf8'));
  assert.equal(outcome.exitCode, 0); assert.equal(outcome.unhandledErrors, false);
  assert.equal(outcome.productsBuilt, false); assert.equal(outcome.appInstalled, false);
  assert.equal(check.feedbackVerified, true); assert.equal(check.android.feedbackVerified, true);
  assert.equal(check.coreInferenceVerified, false); assert.equal(check.android.appInstalledThisRun, false);
  const phone = check.android.feedback;
  assert.deepEqual(JSON.parse(await readFile(resolve(root, 'artifacts/official-plugin-only', check.run, 'feedback.json'), 'utf8')), phone);
  for (const key of ['passed', 'desktopNegativeObservedWithoutInteraction', 'desktopDeleteObservedWithoutInteraction',
    'reconnectKeepsRatingAndDraftWithoutResubmit']) assert.equal(phone[key], true);
  assert.equal(phone.initial.sessionId, check.sessionId); assert.ok(phone.initial.messageId.length > 0);
  assert.equal(phone.initial.emptyInitialRating, true); assert.equal(phone.initial.noTelemetryBeforeFeedback, true);
  assert.deepEqual(phone.staleVersion, { versionConflict: true, noAddedEvent: true });
  assert.equal(phone.recorded.bodyDiscarded, true); assert.equal(phone.recorded.acknowledgementIsLoggedNotDurability, true);
  const phases = phone.recorded.phases;
  assert.deepEqual(phases.map(item => [item.phase, item.rating, item.events.length]), [
    ['dialog-cancelled', null, 0], ['phone-positive', 'positive', 1], ['desktop-negative', 'negative', 2],
    ['stale-version-refused', 'negative', 2], ['phone-retracted', null, 3], ['desktop-positive', 'positive', 4],
    ['reconnected', 'positive', 4], ['desktop-deleted', null, 5], ['session-recorded', null, 6],
  ]);
  const events = phases.at(-1).events, note = 'DSHM_LOCAL_FEEDBACK_' + check.run.replaceAll('-', '');
  assert.deepEqual(events.map(item => item.type), ['feedback/message-put', 'feedback/message-put',
    'feedback/message-delete', 'feedback/message-put', 'feedback/message-delete', 'feedback/record']);
  for (const [index, event] of events.entries()) {
    assert.equal(event.seq, events[0].seq + index);
    if (index < 5) {
      assert.equal(event.data.sessionId, check.sessionId);
      assert.equal(event.type === 'feedback/message-put' ? event.data.item.messageId : event.data.messageId, phone.initial.messageId);
    }
  }
  assert.equal(events[0].data.item.rating, 'positive'); assert.equal(events[0].data.item.note, note);
  assert.equal(events[0].data.item.category, 'task-result'); assert.equal(events[1].data.item.rating, 'negative');
  assert.equal(events[1].data.item.note, note + '_DESKTOP'); assert.equal(events[1].data.item.category, 'other');
  assert.equal(events[3].data.item.rating, 'positive');
  assert.equal(new Set([events[0], events[1], events[3]].map(item => item.data.item.version)).size, 3);
  assert.deepEqual(events[5].data, { text: note + '_SESSION', category: 'product-interaction' });
  for (const item of [...phases, ...phone.phases]) {
    for (const key of ['originalMessagesUnchanged', 'profileUnchanged', 'modelAndPermissionsUnchanged', 'noModelWork'])
      assert.equal(item[key], true);
    assert.deepEqual(item.events, events.slice(0, item.events.length));
  }
  const collector = JSON.parse(await readFile(resolve(evidence, `feedback-collector-${check.run}.json`), 'utf8'));
  assert.deepEqual(collector, check.feedbackCollector);
  assert.deepEqual(Object.keys(collector).sort(), ['closed', 'endpoint', 'events', 'rejected', 'requests']);
  assert.match(collector.endpoint, /^http:\/\/127\.0\.0\.1:\d+\/v1\/logs$/);
  assert.equal(collector.endpoint, check.feedbackCollectorEndpoint); assert.equal(collector.endpoint, phone.recorded.endpoint);
  assert.equal(collector.closed, true); assert.equal(collector.rejected, 0); assert.ok(collector.requests > 0);
  assert.equal(collector.requests, phone.recorded.actualOtlpRequests);
  for (const item of collector.events) {
    assert.deepEqual(Object.keys(item).sort(), ['seq', 'sessionId', 'type']); assert.equal(item.sessionId, check.sessionId);
  }
  assert.deepEqual(collector.events.filter(item => item.type.startsWith('feedback/')),
    events.map(({ seq, type }) => ({ sessionId: check.sessionId, seq, type })));
  assert.deepEqual(phone.recorded.feedbackEventsReceived, collector.events.filter(item => item.type.startsWith('feedback/')));
  for (const key of ['feedbackLocalHostUsesOfficialEnvironment', 'feedbackTelemetryConfigRestored', 'feedbackCollectorClosed'])
    assert.equal(check[key], true);
  for (const stopped of [check.feedbackOriginalHostStopped, check.feedbackLocalHostStopped]) {
    assert.equal(stopped.processTreeEnded, true); assert.equal(stopped.portClosed, true);
  }
  assert.equal(check.feedbackLocalHostStopped.oldLaunchPid, check.feedbackLocalHost.launchPid);
  assert.equal(check.feedbackLocalHostStopped.oldRun, check.feedbackLocalHost.run);
  assert.notEqual(check.feedbackDefaultHostRestored.launchPid, check.feedbackLocalHost.launchPid);
  for (const started of [check.feedbackLocalHost, check.feedbackDefaultHostRestored]) {
    assert.equal(started.entry, 'pnpm dsh web'); assert.equal(started.loginStatus, 303); assert.equal(started.pluginStatus, 200);
  }
}
const feedbackHistoryChecks = checks.filter(check => check.scope === 'phone-message-feedback-cold-archive-fork-isolation-and-two-host-restarts');
for (const check of feedbackHistoryChecks) {
  const evidence = resolve(root, '../backend/artifacts/official-plugin-only');
  const outcome = JSON.parse(await readFile(resolve(evidence, `official-android-${check.run}.outcome.json`), 'utf8'));
  assert.equal(outcome.exitCode, 0); assert.equal(outcome.unhandledErrors, false);
  assert.equal(outcome.productsBuilt, false); assert.equal(outcome.appInstalled, false);
  assert.equal(check.feedbackHistoryVerified, true); assert.equal(check.android.feedbackHistoryVerified, true);
  assert.equal(check.coreInferenceVerified, false); assert.equal(check.android.appInstalledThisRun, false);
  const phone = check.android.feedbackHistory;
  assert.deepEqual(JSON.parse(await readFile(resolve(root, 'artifacts/official-plugin-only', check.run, 'feedback-history.json'), 'utf8')), phone);
  for (const key of ['passed', 'coldRatingVisibleInOwnHistory', 'parentAndForkNavigationKeepIndependentRatingAndDraft',
    'sameForkRatingVersionAndDraftAfterHostRestart']) assert.equal(phone[key], true);
  assert.equal(phone.parentId, check.sessionId); assert.equal(phone.initial.sessionId, check.sessionId);
  assert.notEqual(phone.forkId, phone.parentId); assert.match(phone.appPid, /^[1-9]\d*$/);
  const initial = phone.initial, note = 'DSHM_FEEDBACK_HISTORY_' + check.run.replaceAll('-', '');
  assert.notEqual(initial.messageId, initial.inherited.messageId); assert.equal(initial.originalFeedbackCount, 1);
  assert.equal(check.feedbackHistoryPrepared.actualFirstReplyFeedback, true);
  assert.equal(check.feedbackHistoryPrepared.messageId, initial.inherited.messageId);
  assert.equal(check.feedbackHistoryPrepared.version, initial.inherited.version);
  assert.equal(phone.cold.noAgentCreated, true); assert.equal(phone.cold.rating, 'negative');
  assert.equal(phone.cold.item.note, note + '_COLD'); assert.notEqual(phone.cold.item.version, phone.positive.item.version);
  assert.equal(phone.opened.item.version, phone.cold.item.version);
  for (const item of [phone.positive, phone.archived, phone.cold, phone.opened, phone.retracted, phone.restored,
    phone.child, phone.parentDelete, phone.recovered, phone.final, ...phone.final.phases]) {
    for (const key of ['originalMessagesUnchanged', 'profileUnchanged', 'modelAndPermissionsUnchanged', 'noModelWork'])
      assert.equal(item[key], true);
    assert.ok(item.officialRestoreMarkers >= 0 && item.officialRestoreMarkers <= 1);
  }
  const parent = phone.final.parentEvents, child = phone.final.events;
  assert.deepEqual(parent.map(item => item.type), ['feedback/message-put', 'feedback/message-put', 'feedback/message-put',
    'feedback/message-delete', 'feedback/message-put', 'feedback/message-delete']);
  assert.deepEqual(parent[0].data.item, initial.inherited);
  assert.equal(parent[0].data.item.note, note + '_INHERITED');
  assert.equal(parent[1].data.item.note, note); assert.equal(parent[1].data.item.rating, 'positive');
  assert.equal(parent[2].data.item.note, note + '_COLD'); assert.equal(parent[2].data.item.rating, 'negative');
  assert.equal(parent[4].data.item.note, note + '_RESTORED'); assert.equal(parent[4].data.item.rating, 'positive');
  for (const [index, item] of parent.entries()) {
    assert.equal(item.data.sessionId, check.sessionId);
    if (index > 0) assert.equal(item.data.item?.messageId ?? item.data.messageId, initial.messageId);
    if (index > 0) assert.ok(item.seq > parent[index - 1].seq);
  }
  assert.equal(phone.fork.childId, phone.forkId); assert.equal(phone.fork.parentId, phone.parentId);
  for (const key of ['inheritedMessagesMatched', 'actualInheritedFeedbackIgnored', 'childInitiallyUnrated']) assert.equal(phone.fork[key], true);
  assert.equal(phone.fork.inheritedFeedbackSeq, parent[0].seq); assert.equal(phone.fork.inheritedFeedbackMessageId, initial.inherited.messageId);
  assert.equal(phone.child.parentPositiveUnchanged, true); assert.equal(phone.parentDelete.childFeedbackUnchanged, true);
  assert.equal(phone.parentDelete.childMessagesUnchanged, true);
  assert.deepEqual(phone.parentDelete.received.feedbackEventsReceived,
    parent.map(({ seq, type }) => ({ sessionId: phone.parentId, seq, type })));
  assert.deepEqual(phone.parentDelete.childReceived.feedbackEventsReceived,
    phone.child.events.map(({ seq, type }) => ({ sessionId: phone.forkId, seq, type })));
  assert.equal(phone.parentDelete.received.bodyDiscarded, true); assert.equal(phone.parentDelete.childReceived.bodyDiscarded, true);
  assert.equal(phone.child.item.messageId, initial.messageId); assert.equal(phone.child.item.note, note + '_FORK');
  assert.equal(phone.child.item.rating, 'negative'); assert.notEqual(phone.child.item.version, parent[4].data.item.version);
  assert.deepEqual(phone.recovered.item, phone.child.item);
  assert.deepEqual(child.map(item => item.type), ['feedback/message-put', 'feedback/message-delete']);
  assert.deepEqual(child[0].data.item, phone.child.item); assert.ok(child[1].seq > child[0].seq);
  for (const item of child) {
    assert.equal(item.data.sessionId, phone.forkId); assert.equal(item.data.item?.messageId ?? item.data.messageId, initial.messageId);
  }
  assert.equal(phone.final.childUnrated, true); assert.equal(phone.final.parentInheritedRatingUnchanged, true);
  assert.equal(phone.final.restarts.length, 2); assert.equal(check.feedbackHistoryHostStops.length, 2);
  assert.equal(check.feedbackHistoryHostStarts.length, 2);
  for (const [index, item] of phone.final.restarts.entries()) {
    assert.deepEqual(item.stopped, check.feedbackHistoryHostStops[index]); assert.deepEqual(item.started, check.feedbackHistoryHostStarts[index]);
    assert.equal(item.stopped.processTreeEnded, true); assert.equal(item.stopped.portClosed, true);
    assert.notEqual(item.stopped.oldLaunchPid, item.started.launchPid); assert.notEqual(item.stopped.oldRun, item.started.run);
    assert.equal(item.started.entry, 'pnpm dsh web'); assert.equal(item.started.loginStatus, 303); assert.equal(item.started.pluginStatus, 200);
  }
  const collector = JSON.parse(await readFile(resolve(evidence, `feedback-collector-${check.run}.json`), 'utf8'));
  assert.deepEqual(collector, check.feedbackCollector);
  assert.deepEqual(Object.keys(collector).sort(), ['closed', 'endpoint', 'events', 'rejected', 'requests']);
  assert.match(collector.endpoint, /^http:\/\/127\.0\.0\.1:\d+\/v1\/logs$/);
  assert.equal(collector.endpoint, check.feedbackCollectorEndpoint); assert.equal(collector.closed, true); assert.equal(collector.rejected, 0);
  assert.ok(collector.requests > 0);
  for (const row of collector.events) {
    assert.deepEqual(Object.keys(row).sort(), ['seq', 'sessionId', 'type']); assert.ok([phone.parentId, phone.forkId].includes(row.sessionId));
  }
  for (const [id, events, received] of [[phone.parentId, parent, phone.final.parentReceived], [phone.forkId, child, phone.final.childReceived]]) {
    assert.equal(received.endpoint, collector.endpoint); assert.equal(received.bodyDiscarded, true); assert.ok(received.actualOtlpRequests > 0);
    assert.deepEqual(received.feedbackEventsReceived, events.map(({ seq, type }) => ({ sessionId: id, seq, type })));
    for (const event of received.feedbackEventsReceived) assert.ok(collector.events.some(row => row.sessionId === id && row.seq === event.seq && row.type === event.type));
  }
  for (const key of ['feedbackLocalHostUsesOfficialEnvironment', 'feedbackTelemetryConfigRestored', 'feedbackCollectorClosed', 'testForksArchived'])
    assert.equal(check[key], true);
  assert.equal(check.feedbackHistoryCleanup.ownedSessionsUnarchivedForCleanup, true);
  assert.equal(check.feedbackHistoryCleanup.childId, phone.forkId);
  assert.equal(check.feedbackLocalHostStopped.oldLaunchPid, check.feedbackHistoryHostStarts.at(-1).launchPid);
  assert.equal(check.feedbackLocalHostStopped.processTreeEnded, true); assert.equal(check.feedbackLocalHostStopped.portClosed, true);
  assert.notEqual(check.feedbackDefaultHostRestored.launchPid, check.feedbackLocalHostStopped.oldLaunchPid);
  assert.equal(check.feedbackDefaultHostRestored.entry, 'pnpm dsh web'); assert.equal(check.feedbackDefaultHostRestored.pluginStatus, 200);
}
const presetChecks = checks.filter(check => check.scope === 'phone-preset-selection-declaration-default-inheritance-and-restoration');
for (const check of presetChecks) {
  const outcome = JSON.parse(await readFile(resolve(root, '../backend/artifacts/official-plugin-only',
    `official-android-${check.run}.outcome.json`), 'utf8'));
  assert.equal(outcome.exitCode, 0); assert.equal(outcome.unhandledErrors, false);
  assert.equal(check.presetSettingsVerified, true); assert.equal(check.coreInferenceVerified, false);
  assert.equal(check.android.presetSettingsVerified, true); assert.equal(check.android.appInstalledThisRun, false);
  const phone = check.android.presets;
  for (const key of ['historyLocked', 'managementRequired', 'managementReturned', 'draftPreserved']) assert.equal(phone[key], true);
  assert.equal(phone.declaration.officialDeclarationMatched, true);
  assert.equal(phone.location.officialPathMatched, true); assert.equal(phone.location.oldLocationCleared, true);
  assert.equal(phone.location.mobileWidthContained, true);
  assert.equal(phone.defaults.officialDefaultChanged, true); assert.equal(phone.defaults.historyUnchanged, true);
  for (const value of [phone.blank, phone.inherited]) {
    assert.equal(value.officialProjectionVerified, true); assert.equal(value.sameWorkspace, true);
    assert.equal(value.preset, phone.original.chosen);
    assert.notEqual(value.selected, phone.original.sessionId);
  }
  assert.notEqual(phone.blank.selected, phone.inherited.selected);
  for (const restored of [phone.restored, check.testPresetSettingsRestored])
    for (const key of ['restored', 'defaultsAndInheritanceRestored', 'profileRestored', 'historyUnchanged']) assert.equal(restored[key], true);
}
const creatorChecks = checks.filter(check => ['phone-four-preset-declarations-selection-and-creator-entry-history-protection',
  'phone-four-preset-declarations-selection-creator-new-and-reused-session'].includes(check.scope));
for (const check of creatorChecks) {
  const outcome = JSON.parse(await readFile(resolve(root, '../backend/artifacts/official-plugin-only',
    `official-android-${check.run}.outcome.json`), 'utf8'));
  assert.equal(outcome.exitCode, 0); assert.equal(outcome.unhandledErrors, false);
  assert.equal(outcome.productsBuilt, false); assert.equal(outcome.appInstalled, false);
  assert.equal(check.presetCreatorVerified, true); assert.equal(check.coreInferenceVerified, false);
  assert.equal(check.android.presetCreatorVerified, true); assert.equal(check.android.appInstalledThisRun, false);
  const phone = check.android.presetCreator, ids = ['cordis', 'minimal', 'ptc', 'standard'];
  for (const key of ['managementRequired', 'managementReturned', 'draftPreserved', 'noEmbeddedDesktop']) assert.equal(phone[key], true);
  assert.deepEqual(phone.declarations.map(row => row.id).sort(), ids);
  assert.deepEqual(phone.choices.map(row => row.preset).sort(), ids);
  for (const row of phone.declarations) { assert.equal(row.officialDeclarationMatched, true); assert.ok(row.bytes > 0); }
  assert.deepEqual(phone.creator.map(row => row.phase), ['history', 'blank', 'plugin']);
  assert.equal(new Set(phone.creator.map(row => row.selected)).size, 1);
  for (const row of [...phone.choices, ...phone.creator]) {
    for (const key of ['sameWorkspace', 'officialProjectionVerified', 'noTaskStarted', 'historyAndDefaultsUnchanged']) assert.equal(row[key], true);
    assert.notEqual(row.selected, phone.original.sessionId);
  }
  assert.ok(phone.creator.every(row => row.preset === 'cordis'));
  assert.equal(phone.creator[1].blankReused, true); assert.equal(phone.creator[2].blankReused, true);
  if (check.scope === 'phone-four-preset-declarations-selection-creator-new-and-reused-session') {
    assert.equal(phone.creator[0].newlyCreated, true);
    assert.deepEqual(phone.creatorPreparation.workspaceSessionIds, [phone.original.sessionId]);
    assert.ok(phone.choices.every(row => row.selected === phone.creator[0].selected));
  }
  for (const value of [phone.final, check.testPresetCreatorUnchanged])
    for (const key of ['unchanged', 'profileUnchanged', 'defaultsAndInheritanceUnchanged', 'rosterUnchanged', 'historyUnchanged']) assert.equal(value[key], true);
}
const creatorTaskChecks = checks.filter(check => check.scope === 'creator-host-inspection-and-plugin-source-write-approvals');
for (const check of creatorTaskChecks) {
  const outcome = JSON.parse(await readFile(resolve(root, '../backend/artifacts/official-plugin-only',
    `official-android-${check.run}.outcome.json`), 'utf8'));
  assert.equal(outcome.exitCode, 0); assert.equal(outcome.unhandledErrors, false);
  assert.equal(outcome.productsBuilt, false); assert.equal(outcome.appInstalled, false);
  assert.equal(check.coreInferenceVerified, true); assert.equal(check.creatorTaskVerified, true);
  assert.equal(check.android.creatorTaskVerified, true); assert.equal(check.android.appInstalledThisRun, false);
  const phone = check.android.creatorTask;
  assert.equal(phone.prepared.preset, 'cordis');
  for (const key of ['actualToolDetailsShown', 'noEmbeddedDesktop']) assert.equal(phone[key], true);
  for (const key of ['hostProviderDiscovered', 'queryMatchesActualManifest', 'realToolResultsVerified',
    'profileUnchanged', 'historyPrefixUnchanged']) assert.equal(phone.official[key], true);
  assert.equal(phone.official.callIds.length, 2); assert.equal(phone.official.outputs.length, 2);
  assert.ok(phone.official.toolCount > 0);
  assert.deepEqual(check.android.approvals.map(row => row.outcome), ['allow', 'reject']);
  for (const row of check.android.approvals) {
    for (const key of ['officialDecisionVerified', 'diffPreviewVerified', 'diskContentVerified', 'pluginSourceSyntaxVerified'])
      assert.equal(row[key], true);
    assert.equal(row.fileName, `creator-${row.outcome}.mjs`);
    const seed = JSON.parse(await readFile(resolve(root, 'artifacts/official-plugin-only', check.run,
      `approval-${row.outcome}.json`), 'utf8'));
    assert.equal(seed.passed, true); assert.equal(seed.fileRestored, true);
    assert.equal(seed.callId, row.callId);
    if (row.outcome === 'allow') assert.equal(row.actualWriteVerified, true);
    else { assert.equal(row.rejectedWithoutWrite, true); assert.equal(row.noToolRetry, true); }
  }
  for (const key of ['unchanged', 'historyPrefixUnchanged', 'profileUnchanged'])
    assert.equal(check.testCreatorTaskUnchanged[key], true);
}
const upgradeChecks = checks.filter(check => check.scope === 'phone-plugin-upgrade-official-restart-and-local-ui');
const layoutChecks = checks.filter(check => check.scope === 'phone-plugin-author-layout-user-overrides-and-persistence');
for (const check of layoutChecks) {
  const outcome = JSON.parse(await readFile(resolve(root, '../backend/artifacts/official-plugin-only',
    `official-android-${check.run}.outcome.json`), 'utf8'));
  assert.equal(outcome.exitCode, 0); assert.equal(outcome.unhandledErrors, false);
  assert.equal(outcome.productsBuilt, false); assert.equal(outcome.appInstalled, false);
  assert.equal(check.pluginLayoutVerified, true); assert.equal(check.pluginsVerified, true);
  assert.equal(check.android.appInstalledThisRun, false);
  const phone = check.android.plugins, layout = phone.layout;
  for (const key of ['passed', 'authorDefaultVerified', 'userPriorityVerified', 'resetVerified',
    'reconnectVerified', 'pageRebuildPersistenceVerified', 'internalStyleUnchanged', 'draftPreserved',
    'iframeAbsent', 'userPreferencesRestored', 'authorDeclarationDisposed']) assert.equal(layout[key], true);
  assert.deepEqual(layout.phases.map(phase => phase.phase), ['author-default-off', 'user-overrides-author-on',
    'explicit-user-off', 'reset-to-author-off', 'persisted-user-on-before-reconnect', 'reconnected-user-on',
    'rebuilt-page-user-on', 'rebuilt-page-author-default-off', 'user-on-for-normal-local-interactions']);
  for (const phase of layout.phases) {
    assert.equal(phase.original, 720);
    if (phase.enabled) { assert.ok(phase.displayed < 720); assert.ok(phase.displayed <= phase.viewport); }
    else assert.ok(Math.abs(phase.displayed - 720) < 1);
  }
  assert.equal(phone.managementRequired, true); assert.equal(phone.managementReturned, true);
  assert.equal(phone.draftPreserved, true); assert.equal(phone.localUi.modalAndMenu, true);
  assert.equal(phone.remove.officialInventoryVerified, true); assert.equal(phone.remove.present, false);
  for (const key of ['unchanged', 'otherBundlesUnchanged', 'profileUnchanged', 'historyPrefixUnchanged', 'testBundleRemoved'])
    assert.equal(check.testPluginUpgradeUnchanged[key], true);
  assert.equal(check.pluginLayoutFixture.version, '0.0.12'); assert.equal(check.pluginLayoutFixture.authorAutoFit, false);
  assert.equal(check.pluginLayoutFixture.sourceFiles.length, 5); assert.equal(check.pluginLayoutFixture.noInstallScripts, true);
  assert.equal(check.pluginLayoutFixture.productsBuilt, false);
}
for (const check of upgradeChecks) {
  const outcome = JSON.parse(await readFile(resolve(root, '../backend/artifacts/official-plugin-only',
    `official-android-${check.run}.outcome.json`), 'utf8'));
  assert.equal(outcome.exitCode, 0); assert.equal(outcome.unhandledErrors, false);
  assert.equal(outcome.productsBuilt, false); assert.equal(outcome.appInstalled, false);
  assert.equal(check.pluginUpgradeVerified, true); assert.equal(check.pluginsVerified, true);
  assert.equal(check.android.appInstalledThisRun, false);
  const phone = check.android.plugins, upgraded = phone.upgrade;
  for (const key of ['restartRequiredShown', 'newGuideEntryVerified', 'newVersionRendered', 'interactionExecuted', 'noEmbeddedDesktop'])
    assert.equal(upgraded[key], true);
  assert.ok(['dialog', 'recent-operation-history'].includes(upgraded.completionSource));
  if (upgraded.completionSource === 'recent-operation-history') assert.match(upgraded.operationId, /^[0-9a-f-]{36}$/);
  for (const inventory of [upgraded.installed, upgraded.reloadedInventory]) {
    assert.equal(inventory.officialInventoryVerified, true); assert.equal(inventory.present, true);
    assert.equal(inventory.version, '0.0.6');
  }
  const { stopped, started } = upgraded.restart;
  assert.equal(stopped.processTreeEnded, true); assert.equal(stopped.portClosed, true);
  assert.notEqual(stopped.oldLaunchPid, started.launchPid); assert.notEqual(stopped.oldRun, started.run);
  assert.equal(started.entry, 'pnpm dsh web'); assert.equal(started.loginStatus, 303); assert.equal(started.pluginStatus, 200);
  for (const key of ['managementReturned', 'draftPreserved']) assert.equal(phone[key], true);
  for (const restored of [phone.upgradeCleanup, check.testPluginUpgradeUnchanged])
    for (const key of ['unchanged', 'historyPrefixUnchanged', 'officialResumeBoundaryVerified', 'otherBundlesUnchanged', 'profileUnchanged', 'testBundleRemoved'])
      assert.equal(restored[key], true);
  assert.equal(check.testPluginUpgradeUnchanged.cleanupCommandsVerified, true);
  assert.equal(phone.remove.officialInventoryVerified, true); assert.equal(phone.remove.present, false);
  assert.equal(check.pluginUpgradeFixture.version, '0.0.6'); assert.equal(check.pluginUpgradeFixture.sourceFiles.length, 5);
  assert.equal(check.pluginUpgradeFixture.noInstallScripts, true); assert.equal(check.pluginUpgradeFixture.productsBuilt, false);
}
const pluginInterruptionChecks = checks.filter(check => check.scope === 'phone-plugin-download-cancellation-and-host-exit-outcome-unknown');
for (const check of pluginInterruptionChecks) {
  const outcome = JSON.parse(await readFile(resolve(root, '../backend/artifacts/official-plugin-only',
    `official-android-${check.run}.outcome.json`), 'utf8'));
  assert.equal(outcome.exitCode, 0); assert.equal(outcome.unhandledErrors, false);
  assert.equal(outcome.productsBuilt, false); assert.equal(outcome.appInstalled, false);
  assert.equal(check.pluginInterruptionVerified, true); assert.equal(check.pluginsVerified, true);
  assert.equal(check.pluginDownloadClosed, true); assert.equal(check.android.appInstalledThisRun, false);
  const phone = check.android.plugins, flow = phone.interruption;
  assert.equal(flow.passed, true); assert.equal(flow.cancel.cancelledReceiptShown, true);
  assert.equal(flow.host.unknownResultShown, true); assert.equal(flow.host.noAutomaticRetryControl, true);
  assert.notEqual(flow.cancel.operationId, flow.host.operationId);
  for (const [mode, item] of [['cancel', flow.cancel], ['host-exit', flow.host]]) {
    assert.match(item.operationId, /^[0-9a-f-]{36}$/);
    assert.ok(item.started.requests.some(row => row.mode === mode && !row.closed && row.bytesSent === 32));
    assert.ok(item.started.archiveBytes > 32);
    assert.equal(item.settled.noDownloadReplay, true); assert.equal(item.settled.manifestAndLockUnchanged, true);
    const before = item.started.requests.filter(row => row.mode === mode);
    const after = item.settled.requests.filter(row => row.mode === mode);
    assert.equal(after.length, before.length); assert.ok(after.every(row => row.closed && row.bytesSent === 32));
    assert.equal(item.inventory.officialInventoryVerified, true); assert.equal(item.inventory.present, false);
  }
  assert.equal(check.pluginDownload.requests.length, 2);
  assert.ok(check.pluginDownload.requests.every(row => row.closed));
  const { stopped, started } = flow.restart;
  assert.equal(stopped.processTreeEnded, true); assert.equal(stopped.portClosed, true);
  assert.notEqual(stopped.oldLaunchPid, started.launchPid); assert.notEqual(stopped.oldRun, started.run);
  assert.equal(started.entry, 'pnpm dsh web'); assert.equal(started.loginStatus, 303); assert.equal(started.pluginStatus, 200);
  for (const value of [flow.restored, phone.interruptionCleanup, check.testPluginUpgradeUnchanged])
    for (const key of ['unchanged', 'historyPrefixUnchanged', 'officialResumeBoundaryVerified', 'otherBundlesUnchanged', 'profileUnchanged', 'testBundleRemoved'])
      assert.equal(value[key], true);
  for (const key of ['managementReturned', 'draftPreserved']) assert.equal(phone[key], true);
  assert.equal(phone.remove.officialInventoryVerified, true); assert.equal(phone.remove.present, false);
}
const scriptChecks = checks.filter(check => check.scope === 'phone-plugin-build-script-approval-cancellation-failure-success');
for (const check of scriptChecks) {
  const outcome = JSON.parse(await readFile(resolve(root, '../backend/artifacts/official-plugin-only',
    `official-android-${check.run}.outcome.json`), 'utf8'));
  assert.equal(outcome.exitCode, 0); assert.equal(outcome.unhandledErrors, false);
  assert.equal(outcome.productsBuilt, false); assert.equal(outcome.appInstalled, false);
  assert.equal(check.pluginScriptsVerified, true); assert.equal(check.pluginsVerified, true);
  assert.equal(check.pluginScriptsClosed, true); assert.equal(check.android.appInstalledThisRun, false);
  const phone = check.android.plugins, flow = phone.scripts;
  assert.equal(flow.passed, true);
  for (const key of ['scriptNeverStarted', 'manifestAndLockUnchanged', 'pendingApprovalRecorded']) assert.equal(flow.blocked[key], true);
  assert.equal(flow.approvals.length, 3);
  assert.deepEqual(flow.approvals.map(item => item.mode), ['cancel', 'failure', 'success']);
  assert.equal(new Set(flow.approvals.map(item => item.key)).size, 3);
  for (const approval of flow.approvals) {
    assert.ok(approval.key.startsWith('@dsh-mobile/panel-ui-verification@file:'));
    assert.ok(approval.key.includes(check.run + '/official-plugin-fixtures/' + approval.mode + '/'));
    for (const key of ['scriptNeverStarted', 'manifestAndLockUnchanged', 'pendingApprovalRecorded']) assert.equal(approval[key], true);
  }
  for (const mode of ['cancel', 'failure', 'success']) {
    assert.equal(flow[mode + 'Started'].scriptProcessAlive, true);
    assert.equal(flow[mode].scriptProcessEnded, true); assert.equal(flow[mode].noAutomaticScriptReplay, true);
    const rows = flow[mode].requests.filter(row => row.mode === mode); assert.equal(rows.length, 1);
    assert.equal(rows[0].closed, true); assert.equal(rows[0].released, mode !== 'cancel');
    assert.ok(Number.isSafeInteger(rows[0].pid) && rows[0].pid > 0);
    assert.throws(() => process.kill(rows[0].pid, 0), error => error.code === 'ESRCH');
    assert.equal(flow[mode].inventory.officialInventoryVerified, true);
    assert.equal(flow[mode].inventory.present, mode === 'success');
    if (mode !== 'success') assert.equal(flow[mode].manifestAndLockUnchanged, true);
  }
  assert.equal(flow.success.inventory.version, '0.0.9'); assert.equal(flow.failure.failureShown, true);
  assert.equal(check.pluginScripts.requests.length, 3); assert.ok(check.pluginScripts.requests.every(row => row.closed));
  for (const value of [flow.policy, check.scriptPolicyRestored])
    for (const key of ['ownBuildApprovalRemoved', 'originalPolicyBytesRestored']) assert.equal(value[key], true);
  const baseline = JSON.parse(await readFile(resolve(root, '../backend/artifacts/official-plugin-only',
    check.run, 'script-control-baseline.json'), 'utf8'));
  assert.equal(baseline.scope, 'non-credential-package-manager-files');
  assert.equal(baseline.profile, resolve(root, '../plugin/artifacts/official-dsh-alpha2/home/profiles/web'));
  assert.deepEqual(await readFile(resolve(baseline.profile, 'pnpm-workspace.yaml')), Buffer.from(baseline.files['pnpm-workspace.yaml'], 'base64'));
  assert.equal(flow.removed.officialInventoryVerified, true); assert.equal(flow.removed.present, false);
  for (const value of [phone.scriptsCleanup, check.testPluginUpgradeUnchanged])
    for (const key of ['unchanged', 'historyPrefixUnchanged', 'otherBundlesUnchanged', 'profileUnchanged', 'testBundleRemoved']) assert.equal(value[key], true);
  for (const key of ['managementReturned', 'draftPreserved']) assert.equal(phone[key], true);
  assert.equal(phone.remove.officialInventoryVerified, true); assert.equal(phone.remove.present, false);
}
const activationChecks = checks.filter(check => check.scope === 'phone-plugin-activation-loading-and-host-exit-outcome-unknown');
const autoApplyingChecks = checks.filter(check => check.scope === 'phone-plugin-install-auto-enable-applying-too-late-and-host-exit-outcome-unknown');
for (const check of [...activationChecks, ...autoApplyingChecks]) {
  const automatic = autoApplyingChecks.includes(check);
  const outcome = JSON.parse(await readFile(resolve(root, '../backend/artifacts/official-plugin-only',
    `official-android-${check.run}.outcome.json`), 'utf8'));
  assert.equal(outcome.exitCode, 0); assert.equal(outcome.unhandledErrors, false);
  assert.equal(outcome.productsBuilt, false); assert.equal(outcome.appInstalled, false);
  assert.equal(check.pluginApplyingVerified, true); assert.equal(check.pluginsVerified, true);
  assert.equal(check.pluginApplyingClosed, true); assert.equal(check.android.appInstalledThisRun, false);
  const phone = check.android.plugins, flow = phone.applying;
  assert.equal(flow.passed, true);
  if (automatic) {
    assert.equal(flow.automaticInstall, true);
    assert.equal(flow.controller.installed.present, true); assert.equal(flow.controller.installed.enabled, false);
    assert.equal(flow.controller.enabled.present, true); assert.equal(flow.controller.enabled.enabled, true);
    assert.equal(flow.controller.enabled.version, '0.0.12'); assert.equal(flow.controller.removed.present, false);
    for (const result of Object.values(flow.controller)) assert.equal(result.officialInventoryVerified, true);
    assert.equal(flow.finish.cancellation.ok, true); assert.equal(flow.finish.cancellation.value.status, 'too-late');
    assert.equal(flow.finish.formalTooLateNoticeShown, true);
    const client = await readFile(resolve(root, '../backend/artifacts/official-plugin-only', check.run,
      'official-plugin-fixtures/controller/package/client.js'), 'utf8');
    assert.ok(client.includes('ctx.remote.pluginManager.installBundle(specs[mode], { enabled: true, requestId: ids[mode] })'));
    assert.ok(client.includes("ctx.remote.$on('plugin-manager/install-state'"));
    for (const mode of ['finish', 'host']) assert.ok(client.includes(flow[mode].requestId));
  }
  for (const mode of ['finish', 'host']) {
    const branch = flow[mode];
    if (automatic) {
      assert.equal(branch.progress.phase, 'applying'); assert.equal(branch.progress.started, true);
      assert.match(branch.requestId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    } else {
      assert.equal(branch.installed.officialInventoryVerified, true); assert.equal(branch.installed.present, true);
      assert.ok(branch.activationUi.enableButtonHidden || branch.activationUi.disabled && branch.activationUi.busy);
    }
    assert.equal(branch.started.officialBundleSelected, true); assert.equal(branch.started.moduleLoadStartedInsideHost, true);
    assert.equal(branch.settled.noArchiveDownloadReplay, true);
    if (automatic) assert.deepEqual(branch.settled.downloads, branch.started.downloads);
    assert.equal(branch.inventory.officialInventoryVerified, true); assert.equal(branch.inventory.present, true);
    assert.equal(branch.inventory.version, mode === 'finish' ? '0.0.10' : '0.0.11');
    if (automatic) assert.equal(branch.inventory.enabled, true);
    assert.equal(branch.removed.officialInventoryVerified, true); assert.equal(branch.removed.present, false);
    const loads = branch.settled.loads.filter(row => row.mode === mode);
    assert.equal(loads.length, mode === 'finish' ? 1 : 2); assert.ok(loads.every(row => row.closed));
    assert.equal(loads[0].released, mode === 'finish');
    if (mode === 'host') {
      assert.equal(loads[1].released, true); assert.notEqual(loads[0].pid, loads[1].pid);
      assert.throws(() => process.kill(loads[0].pid, 0), error => error.code === 'ESRCH');
    }
  }
  if (!automatic) assert.equal(flow.finish.activationCannotBeCancelled, true);
  assert.equal(flow.finish.actualCompletionShown, true);
  assert.equal(flow.host.unknownResultShown, true); assert.equal(flow.host.noAutomaticRetryControl, true);
  assert.equal(flow.host.settled.savedInstallationUnchanged, true);
  assert.equal(flow.host.settled.normalStartupActivatedExistingBundle, true);
  assert.equal(flow.restart.stopped.processTreeEnded, true); assert.equal(flow.restart.stopped.portClosed, true);
  assert.equal(flow.restart.prior.oldHostEndedBeforeRestart, true); assert.equal(flow.restart.started.entry, 'pnpm dsh web');
  assert.notEqual(flow.restart.stopped.oldLaunchPid, flow.restart.started.launchPid);
  assert.equal(check.pluginApplying.loads.length, 3); assert.ok(check.pluginApplying.loads.every(row => row.closed));
  assert.ok(check.pluginApplying.downloads.every(row => row.closed));
  assert.equal(check.pluginApplyingFixtures.length, automatic ? 3 : 2);
  if (automatic) {
    // 显式添加新依赖时包管理器也可请求已登记的控制包；不把该请求当成重启重放。
    // 两个在途目标须各一次，加载等待至结算期间所有归档请求则必须逐项保持。
    for (const mode of ['finish', 'host']) assert.equal(check.pluginApplying.downloads.filter(row => row.mode === mode).length, 1);
    assert.ok(check.pluginApplying.downloads.some(row => row.mode === 'controller'));
  }
  for (const fixture of check.pluginApplyingFixtures) {
    assert.equal(fixture.noInstallScripts, true); assert.equal(fixture.productsBuilt, false); assert.equal(fixture.sourceFiles.length, 5);
  }
  assert.equal(flow.policy.scriptPolicyUnchanged, true); assert.equal(check.applyingPolicyUnchanged.scriptPolicyUnchanged, true);
  const baseline = JSON.parse(await readFile(resolve(root, '../backend/artifacts/official-plugin-only',
    check.run, 'applying-control-baseline.json'), 'utf8'));
  assert.equal(baseline.scope, 'non-credential-package-manager-files');
  assert.equal(baseline.profile, resolve(root, '../plugin/artifacts/official-dsh-alpha2/home/profiles/web'));
  assert.deepEqual(await readFile(resolve(baseline.profile, 'pnpm-workspace.yaml')), Buffer.from(baseline.files['pnpm-workspace.yaml'], 'base64'));
  for (const value of [flow.restored, phone.applyingCleanup, check.testPluginUpgradeUnchanged])
    for (const key of ['unchanged', 'historyPrefixUnchanged', 'otherBundlesUnchanged', 'profileUnchanged', 'testBundleRemoved']) assert.equal(value[key], true);
  for (const key of ['managementReturned', 'draftPreserved']) assert.equal(phone[key], true);
  assert.equal(phone.remove.officialInventoryVerified, true); assert.equal(phone.remove.present, false);
}
const keyChecks = checks.filter(check => check.scope === 'isolated-synthetic-provider-native-key-write-use-remove-no-inference');
const addressChecks = checks.filter(check => check.scope === 'isolated-service-address-write-restore-and-stale-review-no-inference');
const policyChecks = checks.filter(check => check.scope === 'isolated-service-address-reset-policy-and-catalog-default-no-inference');
const interruptionChecks = checks.filter(check => check.scope === 'isolated-service-address-phone-write-before-forward-and-receipt-loss-no-inference');
const raceChecks = checks.filter(check => check.scope === 'isolated-service-address-phone-and-other-real-connection-concurrent-writes-no-inference');
const processChecks = checks.filter(check => check.scope === 'isolated-service-address-phone-write-app-process-death-and-recovery-no-inference');
let isolatedEndpointProcessHost;
if (processChecks.length) {
  const addressRoot = resolve(root, '../plugin/artifacts/official-dsh-alpha2-endpoint-process');
  const stopped = JSON.parse(await readFile(resolve(addressRoot, 'official-web-receipt.json'), 'utf8'));
  assert.equal(stopped.scope, 'isolated-service-address-process'); assert.equal(stopped.port, 16965);
  assert.equal(stopped.home, resolve(addressRoot, 'home')); assert.equal(stopped.stage, 'exited');
  processIdentityChecks.push(await assertOfficialProcessStopped(stopped, resolve(addressRoot, 'official-web-receipt.json')));
  for (const check of processChecks) {
    const outcome = JSON.parse(await readFile(resolve(root, '../backend/artifacts/official-plugin-only',
      `official-android-${check.run}.outcome.json`), 'utf8'));
    assert.equal(outcome.run, check.run); assert.equal(outcome.exitCode, 0); assert.equal(outcome.unhandledErrors, false);
    assert.equal(check.officialLaunchPid, stopped.pid); assert.equal(check.coreInferenceVerified, false);
    assert.equal(check.endpointProcessVerified, true); assert.equal(check.android.inferenceVerified, false);
    assert.equal(check.externalProxyClosed, true);
    const phone = check.android.endpointProcess, transport = check.endpointProcessTransport;
    assert.equal(phone.completed, true); assert.equal(phone.managementReturned, true);
    assert.equal(phone.cases.length, 6); assert.equal(transport.cuts.length, 6); assert.equal(transport.writes.length, 6);
    for (const [index, item] of phone.cases.entries()) {
      assert.equal(item.target, ['chat', 'search', 'provider'][Math.floor(index / 2)]);
      assert.equal(item.mode, index % 2 ? 'after-receipt' : 'before-forward');
      for (const key of ['passed', 'unknownResultShown', 'noAutomaticReplay', 'normalLauncherAndChatDraft']) assert.equal(item[key], true);
      assert.match(item.oldPid, /^[1-9]\d*$/); assert.match(item.newPid, /^[1-9]\d*$/);
      assert.notEqual(item.newPid, item.oldPid);
      assert.equal(item.held.holdUntilClientCloses, true); assert.equal(item.held.socketClosed, false);
      assert.equal(item.cut.holdUntilClientCloses, true); assert.equal(item.cut.socketClosed, true);
      assert.equal(item.cut.forwarded, index % 2 === 1);
      if (index % 2) { assert.equal(item.cut.receipt.type, 'result'); assert.equal(item.cut.receipt.value.origin, new URL(item.destination).origin); }
      else assert.equal(item.cut.receipt, undefined);
      assert.equal(item.cut.id, transport.writes[index].id); assert.deepEqual(item.cut, transport.cuts[index]);
      for (const snapshot of [item.offline, item.reconnected])
        for (const key of ['allThreeNamespacesVerified', 'otherFieldsUnchanged', 'historyUnchanged']) assert.equal(snapshot[key], true);
    }
    assert.equal(check.testEndpointsRestored.profileRestored, true); assert.equal(check.testEndpointsRestored.credentialsConfigured, false);
    assert.equal(check.testEndpointsRestored.credentialContentsRead, false); assert.equal(check.testEndpointsRestored.officialSearchReferenceControlVerified, true);
    assert.deepEqual(check.testEndpointsRestored.directoryCalls, []);
  }
  isolatedEndpointProcessHost = { home: stopped.home, launchPid: stopped.pid, stopped: true,
    sixActualAppProcessDeathsVerified: true, pendingSocketsClosedByAppDeath: true,
    normalLauncherRecovery: true, unknownResultsVisible: true, noAutomaticReplay: true,
    profileAndHistoryRestored: true, credentialsConfigured: false, credentialContentsRead: false, inferenceVerified: false };
}
let isolatedEndpointRaceHost;
if (raceChecks.length) {
  const addressRoot = resolve(root, '../plugin/artifacts/official-dsh-alpha2-endpoint-race');
  const stopped = JSON.parse(await readFile(resolve(addressRoot, 'official-web-receipt.json'), 'utf8'));
  assert.equal(stopped.scope, 'isolated-service-address-race'); assert.equal(stopped.port, 16964);
  assert.equal(stopped.home, resolve(addressRoot, 'home')); assert.equal(stopped.stage, 'exited');
  processIdentityChecks.push(await assertOfficialProcessStopped(stopped, resolve(addressRoot, 'official-web-receipt.json')));
  for (const check of raceChecks) {
    const outcome = JSON.parse(await readFile(resolve(root, '../backend/artifacts/official-plugin-only',
      `official-android-${check.run}.outcome.json`), 'utf8'));
    assert.equal(outcome.run, check.run); assert.equal(outcome.exitCode, 0); assert.equal(outcome.unhandledErrors, false);
    assert.equal(check.officialLaunchPid, stopped.pid); assert.equal(check.coreInferenceVerified, false);
    assert.equal(check.endpointRaceVerified, true); assert.equal(check.android.inferenceVerified, false);
    assert.equal(check.externalProxyClosed, true);
    const phone = check.android.endpointRace, transport = check.endpointRaceTransport;
    assert.equal(phone.completed, true); assert.equal(phone.managementReturned, true);
    assert.equal(phone.cases.length, 6); assert.equal(transport.races.length, 6);
    assert.equal(transport.writes.length, 12); assert.equal(transport.cuts.length, 0);
    assert.deepEqual([...new Set(phone.cases.map(item => item.winner))].sort(), ['other', 'phone']);
    for (const [index, item] of phone.cases.entries()) {
      const pair = transport.races[index];
      assert.equal(item.target, ['chat', 'search', 'provider'][Math.floor(index / 2)]);
      assert.equal(item.order, index % 2 ? 'other-first' : 'phone-first');
      for (const key of ['passed', 'noAutomaticReplay', 'sameAppAndChatDraft']) assert.equal(item[key], true);
      assert.equal(pair.released, true); assert.equal(pair.writes.length, 2); assert.equal(pair.receipts.length, 2);
      assert.equal(new Set(pair.writes.map(write => write.bridgeId)).size, 2);
      assert.equal(new Set(pair.writes.map(write => write.operation.snapshot)).size, 2);
      assert.ok(pair.writes.every(write => write.forwarded && write.operation.expectedRevision === item.prepared.revision));
      const success = pair.receipts.filter(frame => frame.type === 'result'); assert.equal(success.length, 1);
      const error = pair.receipts.filter(frame => frame.type === 'error'); assert.equal(error.length, 1);
      assert.equal(error[0].code, 'remote_endpoint_stale');
      assert.deepEqual([...pair.writes].sort((a, b) => a.id.localeCompare(b.id)),
        [...item.settled.writes].sort((a, b) => a.id.localeCompare(b.id)));
      assert.deepEqual(pair.receipts, item.settled.receipts);
      assert.equal(item.configuration.revision, item.prepared.revision + 1);
      assert.equal(success[0].value.revision, item.configuration.revision);
      assert.equal(success[0].value.origin, item.configuration.currentOrigin);
      for (const key of ['allThreeNamespacesVerified', 'otherFieldsUnchanged', 'historyUnchanged']) assert.equal(item.configuration[key], true);
    }
    assert.equal(check.testEndpointsRestored.profileRestored, true); assert.equal(check.testEndpointsRestored.credentialsConfigured, false);
    assert.equal(check.testEndpointsRestored.credentialContentsRead, false); assert.deepEqual(check.testEndpointsRestored.directoryCalls, []);
    assert.equal(check.testEndpointsRestored.officialSearchReferenceControlVerified, true);
  }
  isolatedEndpointRaceHost = { pid: stopped.pid, port: stopped.port, stopped: true, scope: stopped.scope,
    profileRestored: true, concurrentPairs: 6, actualWrites: 12, noInference: true };
}
let isolatedEndpointInterruptionHost;
if (interruptionChecks.length) {
  const addressRoot = resolve(root, '../plugin/artifacts/official-dsh-alpha2-endpoint-interruption');
  const stopped = JSON.parse(await readFile(resolve(addressRoot, 'official-web-receipt.json'), 'utf8'));
  assert.equal(stopped.scope, 'isolated-service-address-interruption'); assert.equal(stopped.port, 16963);
  assert.equal(stopped.home, resolve(addressRoot, 'home')); assert.equal(stopped.stage, 'exited');
  processIdentityChecks.push(await assertOfficialProcessStopped(stopped, resolve(addressRoot, 'official-web-receipt.json')));
  for (const check of interruptionChecks) {
    assert.equal(check.officialLaunchPid, stopped.pid); assert.equal(check.coreInferenceVerified, false);
    assert.equal(check.endpointInterruptionVerified, true); assert.equal(check.android.inferenceVerified, false);
    assert.equal(check.externalProxyClosed, true);
    const phone = check.android.endpointInterruption, transport = check.endpointInterruptionTransport;
    assert.equal(phone.completed, true); assert.equal(phone.managementReturned, true);
    assert.equal(phone.cases.length, 6); assert.equal(transport.cuts.length, 6); assert.equal(transport.writes.length, 6);
    for (const [index, item] of phone.cases.entries()) {
      assert.equal(item.target, ['chat', 'search', 'provider'][Math.floor(index / 2)]);
      assert.equal(item.mode, index % 2 ? 'after-receipt' : 'before-forward');
      for (const key of ['passed', 'unknownResultShown', 'noAutomaticReplay', 'sameAppAndChatDraft']) assert.equal(item[key], true);
      assert.equal(item.cut.socketClosed, true); assert.equal(item.cut.forwarded, index % 2 === 1);
      if (index % 2) { assert.equal(item.cut.receipt.type, 'result'); assert.equal(item.cut.receipt.value.origin, new URL(item.destination).origin); }
      else assert.equal(item.cut.receipt, undefined);
      assert.equal(item.cut.id, transport.writes[index].id); assert.deepEqual(item.cut, transport.cuts[index]);
      for (const key of ['allThreeNamespacesVerified', 'otherFieldsUnchanged', 'historyUnchanged']) assert.equal(item.offline[key], true);
    }
    assert.equal(check.testEndpointsRestored.profileRestored, true); assert.equal(check.testEndpointsRestored.credentialsConfigured, false);
    assert.equal(check.testEndpointsRestored.credentialContentsRead, false); assert.equal(check.testEndpointsRestored.officialSearchReferenceControlVerified, true);
    assert.deepEqual(check.testEndpointsRestored.directoryCalls, []);
  }
  isolatedEndpointInterruptionHost = { home: stopped.home, launchPid: stopped.pid, stopped: true,
    sixPhoneTransportCutsVerified: true, unknownResultsVisible: true, noAutomaticReplay: true,
    profileAndHistoryRestored: true, credentialsConfigured: false, credentialContentsRead: false, inferenceVerified: false };
}
let isolatedEndpointPolicyHost;
if (policyChecks.length) {
  const addressRoot = resolve(root, '../plugin/artifacts/official-dsh-alpha2-endpoint-policy');
  const stopped = JSON.parse(await readFile(resolve(addressRoot, 'official-web-receipt.json'), 'utf8'));
  assert.equal(stopped.scope, 'isolated-service-address-policy'); assert.equal(stopped.port, 16962);
  assert.equal(stopped.home, resolve(addressRoot, 'home')); assert.equal(stopped.stage, 'exited');
  processIdentityChecks.push(await assertOfficialProcessStopped(stopped, resolve(addressRoot, 'official-web-receipt.json')));
  for (const check of policyChecks) {
    assert.equal(check.officialLaunchPid, stopped.pid); assert.equal(check.coreInferenceVerified, false);
    assert.equal(check.endpointWritesVerified, true); assert.equal(check.android.inferenceVerified, false);
    assert.equal(check.android.endpoints.resetPolicyVerified, true); assert.equal(check.android.endpoints.catalogDefaultRestored, true);
    assert.equal(check.testEndpointsRestored.profileRestored, true); assert.equal(check.testEndpointsRestored.credentialsConfigured, false);
    assert.equal(check.testEndpointsRestored.credentialContentsRead, false); assert.equal(check.testEndpointsRestored.catalogDefaultRestored, true);
    assert.deepEqual(check.testEndpointsRestored.bypassGuard,
      { oldClientRefused: true, negotiatedClientRefused: true, code: 'remote_endpoint_reset_unavailable' });
    for (const phase of ['provider:reset-policy', 'provider:reset-refused', 'provider:reset-policy-write', 'provider:removed',
      'catalog:created', 'catalog:saved', 'catalog:restored', 'catalog:removed'])
      assert.ok(check.testEndpointsRestored.phases.includes(phase));
    assert.deepEqual(check.testEndpointsRestored.directoryCalls, [{ path: '/v1/models', authentication: 'none' }]);
  }
  isolatedEndpointPolicyHost = { home: stopped.home, launchPid: stopped.pid, stopped: true,
    profileRestored: true, catalogDefaultRestored: true, bypassRefused: true, credentialsConfigured: false,
    credentialContentsRead: false, inferenceVerified: false };
}
let isolatedAddressHost;
if (addressChecks.length) {
  const addressRoot = resolve(root, '../plugin/artifacts/official-dsh-alpha2-endpoint');
  const stopped = JSON.parse(await readFile(resolve(addressRoot, 'official-web-receipt.json'), 'utf8'));
  assert.equal(stopped.scope, 'isolated-service-address'); assert.equal(stopped.port, 16961);
  assert.equal(stopped.home, resolve(addressRoot, 'home')); assert.equal(stopped.stage, 'exited');
  processIdentityChecks.push(await assertOfficialProcessStopped(stopped, resolve(addressRoot, 'official-web-receipt.json')));
  for (const check of addressChecks) {
    assert.equal(check.officialLaunchPid, stopped.pid); assert.equal(check.coreInferenceVerified, false);
    assert.equal(check.endpointWritesVerified, true); assert.equal(check.android.inferenceVerified, false);
    assert.equal(check.testEndpointsRestored.profileRestored, true);
    assert.equal(check.testEndpointsRestored.credentialsConfigured, false);
    assert.equal(check.testEndpointsRestored.credentialContentsRead, false);
    assert.equal(check.testEndpointsRestored.officialSearchReferenceControlVerified, true);
    for (const phase of ['chat:restored', 'search:restored', 'provider:reset-baseline', 'provider:reset-refused', 'provider:removed'])
      assert.ok(check.testEndpointsRestored.phases.includes(phase));
    assert.ok(!check.testEndpointsRestored.phases.includes('provider:restored'));
    assert.deepEqual(check.testEndpointsRestored.directoryCalls, [{ path: '/v1/models', authentication: 'none' }]);
  }
  isolatedAddressHost = { home: stopped.home, launchPid: stopped.pid, stopped: true,
    profileRestored: true, credentialsConfigured: false, credentialContentsRead: false, inferenceVerified: false };
}
let isolatedKeyHost;
if (keyChecks.length) {
  const keyRoot = resolve(root, '../plugin/artifacts/official-dsh-alpha2-key');
  const stopped = JSON.parse(await readFile(resolve(keyRoot, 'official-web-receipt.json'), 'utf8'));
  assert.equal(stopped.scope, 'isolated-synthetic-provider-key'); assert.equal(stopped.port, 16960);
  assert.equal(stopped.home, resolve(keyRoot, 'home')); assert.equal(stopped.stage, 'exited');
  processIdentityChecks.push(await assertOfficialProcessStopped(stopped, resolve(keyRoot, 'official-web-receipt.json')));
  for (const check of keyChecks) {
    assert.equal(check.officialLaunchPid, stopped.pid); assert.equal(check.coreInferenceVerified, false);
    assert.equal(check.providerKeysVerified, true); assert.equal(check.android.inferenceVerified, false);
    assert.equal(check.testProviderKeysRestored.profileRestored, true);
    assert.equal(check.testProviderKeysRestored.refsUnconfigured, 2);
    assert.equal(check.testProviderKeysRestored.credentialContentsRead, false);
    assert.deepEqual(check.testProviderKeysRestored.directoryCalls,
      [{ path: '/v1/models', authentication: 'stored' }, { path: '/v1/models', authentication: 'stored' }]);
  }
  isolatedKeyHost = { home: stopped.home, launchPid: stopped.pid, stopped: true,
    refsUnconfigured: true, credentialContentsRead: false, inferenceVerified: false };
}
const path = await shell('pm path ' + original), pid = await shell('pidof ' + original);
assert.equal(pid, '4249');
const sha256 = (await shell('sha256sum ' + path.slice(8))).split(/\s+/)[0];
assert.equal(sha256, '58921967f03c2a2d8e6b2c9dfdfc623052dbb7ddbfb291684013d2863111114b');
for (const check of checks) for (const identity of [check.android.before, check.android.after])
  assert.deepEqual({ path, pid, sha256 }, identity);
// 只接受正常的无进程/无文件结果；连接故障不能作为清理通过。
await assert.rejects(shell('pidof ' + own), error => error.code === 1 && error.stdout === '' && error.stderr === '');
assert.equal(await shell('run-as ' + own + ' find cache/remote-downloads -type f'), '');
if (shareChecks.length) {
  assert.equal(await shell('run-as ' + own + ' find cache/remote-shares -type f'), '');
  assert.doesNotMatch(await shell('pm list packages'), /package:dev\.dshmobile\.validation\.officialtest\.test(?:\r?\n|$)/);
}
// 正常保存结算会删除记录文件并保留空目录；目录存在本身不是未确认写入。
try {
  assert.equal(await shell('run-as ' + own + ' stat -c %F no_backup/remote-save-writes'), 'directory');
  assert.equal(await shell('run-as ' + own + ' find no_backup/remote-save-writes -mindepth 1 -maxdepth 1'), '');
} catch (error) {
  assert.equal(error.code, 1);
  assert.match(error.stderr + error.stdout, /No such file or directory/);
}
const reverse = await execute(adb, ['-s', serial, 'reverse', '--list'], { windowsHide: true });
assert.doesNotMatch(reverse.stdout, /tcp:16956|tcp:16957/);
for (const port of [16956, 16957, ...[...feedbackChecks, ...feedbackHistoryChecks].map(check => Number(new URL(check.feedbackCollectorEndpoint).port)), ...backgroundChecks.map(check => check.backgroundControl.port), ...backgroundHostChecks.map(check => check.backgroundHostControl.port), ...backgroundStopChecks.map(check => check.backgroundStopControl.port), ...pluginInterruptionChecks.map(check => check.pluginDownload.port), ...scriptChecks.map(check => check.pluginScripts.port), ...[...activationChecks, ...autoApplyingChecks].map(check => check.pluginApplying.port), ...(keyChecks.length ? [16960] : []), ...(addressChecks.length ? [16961] : []), ...(policyChecks.length ? [16962] : []), ...(interruptionChecks.length ? [16963] : []), ...(raceChecks.length ? [16964] : []), ...(processChecks.length ? [16965] : [])]) await new Promise((done, reject) => {
  const socket = createConnection({ host: '127.0.0.1', port });
  socket.setTimeout(1000);
  socket.once('connect', () => { socket.destroy(); reject(Error('Test gateway still listening: ' + port)); });
  socket.once('timeout', () => { socket.destroy(); reject(Error('Cannot establish port cleanup: ' + port)); });
  socket.once('error', error => error.code === 'ECONNREFUSED' ? done() : reject(error));
});
const plugin = resolve(root, '../plugin'), official = resolve(plugin, 'artifacts/official-dsh-alpha2');
const receipt = JSON.parse(await readFile(resolve(official, 'official-web-receipt.json'), 'utf8'));
assert.equal(receipt.stage, 'plugin-ready'); assert.equal(receipt.version, '0.2.1-alpha.2');
assert.equal(receipt.entry, 'pnpm dsh web'); assert.equal(receipt.port, 16958);
process.kill(receipt.pid, 0);
// 私有登录链接仅交给正常官方HTTP入口；不输出token、cookie或凭据。
assert.equal(receipt.privateLog, resolve(official, `web-${receipt.run}.private.log`));
const log = await readFile(receipt.privateLog, 'utf8');
const url = log.match(/dsh web: (http:\/\/127\.0\.0\.1:\d+\/\?token=[^\s]+)/)?.[1];
assert.equal(new URL(url).origin, 'http://127.0.0.1:16958');
const login = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
assert.equal(login.status, 303);
const cookie = login.headers.get('set-cookie').split(';')[0];
const response = await fetch('http://127.0.0.1:16958/api/dsh-mobile', { headers: { cookie }, signal: AbortSignal.timeout(10000) });
assert.equal(response.status, 200);
const state = await response.json(); assert.equal(state.enabled, false);
let originalKeyStatus;
if (keyChecks.length) {
  const credentials = await fetch('http://127.0.0.1:16958/api/credentials/describe', {
    method: 'POST', headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'client-request', rpcId: 'key-restoration-public-status', method: 'credentials/describe',
      payload: { args: { refs: ['DEEPSEEK_API_KEY'] } } }), signal: AbortSignal.timeout(10000),
  });
  assert.equal(credentials.status, 200); const frame = await credentials.json(); assert.equal(frame.result.ok, true);
  const info = frame.result.value.DEEPSEEK_API_KEY; assert.equal(info.configured, true); assert.equal(info.writable, true);
  originalKeyStatus = { configured: true, writable: true, credentialContentsRead: false };
}
const audit = JSON.parse((await execute(process.execPath, ['scripts/inspect-official-alpha2.mjs', 'verify'], { cwd: plugin, windowsHide: true })).stdout.trim());
const oldAudit = JSON.parse((await execute(process.execPath, ['scripts/audit-official-dsh-files.mjs', 'verify-pnpm'], { cwd: plugin, windowsHide: true })).stdout.trim());
assert.equal(audit.unchanged, true); assert.equal(oldAudit.unchanged, true);
const source = resolve(root, 'artifacts/official-alpha2-source');
assert.equal((await execute('git', ['status', '--porcelain'], { cwd: source, windowsHide: true })).stdout.trim(), '');
assert.equal((await execute('git', ['rev-parse', 'HEAD'], { cwd: source, windowsHide: true })).stdout.trim(), 'd743267388641bc76f17c45ce8b4c231aed1d32c');
const launch = await shell('am start -W -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -n '
  + original + '/dev.dshmobile.validation.ValidationActivity');
assert.match(launch, /Status: ok/);
assert.equal(await shell('pidof ' + original), pid);
assert.ok((await shell('dumpsys window')).split('\n').some(line => /mCurrentFocus/.test(line) && line.includes(original)));
const screenshot = await execute(adb, ['-s', serial, 'exec-out', 'screencap', '-p'],
  { windowsHide: true, encoding: 'buffer', maxBuffer: 8 * 1024 * 1024 });
await writeFile(resolve(root, 'artifacts/official-plugin-only/alpha2-original-foreground.png'), screenshot.stdout);
const report = { at: new Date().toISOString(), version: receipt.version, runs,
  scopes: checks.map(check => ({ run: check.run, scope: check.scope, stages: check.android.stages.length })),
  original: { path, pid, sha256, foreground: true }, ownStopped: true, downloadsEmpty: true,
  saveRecordsAbsent: true, testReverseMappingsAbsent: true, testGatewaysStopped: true,
  ...(shareChecks.length ? { shareSnapshotsEmpty: true, shareReceiverRemoved: true } : {}),
  ...(desktopChecks.length ? { actualDesktopWindowsVerified: true, ownedDesktopWindowsClosed: true,
    unrelatedExplorerWindowsPreserved: true } : {}),
  ...(reviewChecks.length ? { actualPlannedDiffAndTurnReviewVerified: true } : {}),
  ...(historyChecks.length ? { actualLongHistoryPaginationVerified: true } : {}),
  ...(historyInflightChecks.length ? { actualHistoryInflightVerified: true } : {}),
  ...(ptcChecks.length ? { actualPtcNestedExecutionAndStopVerified: true } : {}),
  ...(skillChecks.length ? { actualSkillManualInvocationVerified: true } : {}),
  ...(childStopChecks.length ? { actualContinuableChildStopVerified: true } : {}),
  ...(externalChildChecks.length ? { actualExternalAcpTaskVerified: true } : {}),
  ...(referenceChecks.length ? { actualFileAndChatReferencesVerified: true } : {}),
  ...(pairingChecks.length ? { actualNativeQrImageAndNaturalExpiryVerified: true, archiveInstallationVerified: true,
    physicalCameraQrRecognitionVerified: false } : {}),
  ...(layoutChecks.length ? { actualPluginAuthorLayoutVerified: true } : {}),
  testDevicesRevoked: true, officialLaunchPid: receipt.pid, officialPort: receipt.port,
  officialEntry: receipt.entry, remoteDisabled: true, audit, oldAudit, sourceUnchanged: true,
  ...(isolatedKeyHost ? { isolatedKeyHost, originalKeyStatus } : {}),
  ...(isolatedAddressHost ? { isolatedAddressHost } : {}),
  ...(isolatedEndpointPolicyHost ? { isolatedEndpointPolicyHost } : {}),
  ...(isolatedEndpointInterruptionHost ? { isolatedEndpointInterruptionHost } : {}),
  ...(isolatedEndpointRaceHost ? { isolatedEndpointRaceHost } : {}),
  ...(isolatedEndpointProcessHost ? { isolatedEndpointProcessHost } : {}),
  appInstalledThisCheck: false, appBuiltThisCheck: false, dshModified: false, dshBuilt: false,
  sdkBuilt: false, keyRead: false, bindingReplaced: false, processIdentityChecks };
await writeFile(resolve(root, 'artifacts/official-plugin-only/alpha2-final-restoration.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
