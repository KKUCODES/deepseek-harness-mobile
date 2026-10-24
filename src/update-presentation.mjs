const transferring = phase => ['downloading', 'verifying'].includes(phase);

/** 先完成已开始的任务，再优先安装新版APK，避免两个下载入口相互抢占。 */
export function updatePresentation(state) {
  const resources = state.resources;
  const newerApk = state.release && state.release.versionCode > state.currentVersionCode;
  let kind = 'apk';
  if (transferring(state.phase) || ['ready', 'permission', 'installing'].includes(state.phase)) kind = 'apk';
  else if (resources && (transferring(resources.phase) || resources.pendingRevision > 0 || resources.recoveryPending || ['preparing', 'restarting'].includes(resources.phase))) kind = 'resources';
  else if (state.phase === 'checking' || resources?.phase === 'checking') kind = state.phase === 'checking' ? 'apk' : 'resources';
  else if (newerApk || state.phase === 'error') kind = 'apk';
  else if (resources && (resources.release || resources.notice || resources.phase === 'error')) kind = 'resources';
  const selected = kind === 'resources' ? resources : state;
  let phase = selected.phase;
  if (kind === 'resources' && (resources.pendingRevision > 0 || resources.recoveryPending) && !['preparing', 'restarting'].includes(phase)) phase = 'staged';
  if (phase === 'current' && (state.phase === 'idle' || resources?.phase === 'idle')) phase = 'idle';
  const release = selected.release;
  const error = selected.error || (kind === 'resources' ? selected.notice : null);
  const busy = ['checking', 'downloading', 'verifying', 'permission', 'installing', 'preparing', 'restarting'].includes(phase);
  const action = phase === 'staged' ? resources.restartSupported ? 'resources.restart' : null
    : phase === 'ready' || phase === 'permission' ? 'install'
    : (['available', 'cancelled'].includes(phase) && release) || (phase === 'error' && release) ? kind === 'resources' ? 'resources.download' : 'download'
    : !busy && phase !== 'unavailable' ? 'check' : null;
  return { kind, phase, release, error, busy, action, newerApk: !!newerApk,
    canCancel: ['checking', 'downloading', 'verifying'].includes(phase), received: selected.received || 0, pending: resources?.pendingRevision || 0,
    canRecover: !!(resources?.currentRevision || resources?.pendingRevision || resources?.recoveryPending) };
}
