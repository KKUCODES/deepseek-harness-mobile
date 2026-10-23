const phases = new Set(['idle', 'checking', 'available', 'current', 'downloading', 'verifying', 'ready', 'permission', 'installing', 'error', 'cancelled']);
export const updateFailures = Object.freeze({
  update_network: '无法连接更新服务，请检查网络后重试。',
  update_rate_limited: '更新服务暂时限流，请稍后重试。',
  update_invalid_release: '保存的更新信息无效，请重新检查更新。',
  update_release_list_invalid: '更新服务返回的版本列表格式无效，请稍后重试。',
  update_metadata_invalid_json: '版本信息文件格式无效，无法读取更新信息。',
  update_metadata_missing: '此版本缺少 compatibility.json 版本信息文件，无法自动更新。',
  update_apk_missing: '此版本缺少对应的 APK 安装包，请前往发行页查看。',
  update_asset_duplicate: '此版本存在同名的更新附件，无法确定下载文件。',
  update_asset_not_ready: '更新附件尚未上传完成，请稍后重新检查。',
  update_asset_url_mismatch: '更新附件地址与官方发行地址不一致，已停止更新。',
  update_missing_digest: '更新附件缺少 SHA-256 校验信息，已停止更新。',
  update_invalid_digest: '更新附件的 SHA-256 校验信息格式无效，已停止更新。',
  update_asset_size_invalid: '更新附件大小缺失、无效或超过允许范围，已停止更新。',
  update_release_version_invalid: '版本信息中的版本号缺失或格式无效，已停止更新。',
  update_release_tag_mismatch: '版本信息中的版本号与 Release 标签不一致，已停止更新。',
  update_release_url_mismatch: '版本发行页地址与官方仓库不一致，已停止更新。',
  update_release_package_missing: '版本信息未提供有效的 App 包名，无法确认更新对象。',
  update_release_signing_unknown: '版本信息未提供有效的签名状态，无法确认安装包已签名。',
  update_release_unsigned: '此版本标记为未签名，不能直接安装。',
  update_release_installability_unknown: '版本信息未提供有效的可安装状态，无法确认安装包可用。',
  update_release_not_installable: '此版本标记为不能直接安装，请前往发行页查看。',
  update_release_certificate_invalid: '版本信息中的签名证书指纹缺失或格式无效，已停止更新。',
  update_plugin_version_invalid: '版本信息中的配套插件版本号格式无效，已停止更新。',
  update_release_version_code_invalid: '版本信息中的内部版本号缺失或无效，已停止更新。',
  update_metadata_size_mismatch: '版本信息文件大小与发行记录不一致，请重新检查更新。',
  update_metadata_digest_mismatch: '版本信息文件 SHA-256 校验失败，请重新检查更新。',
  update_metadata_too_large: '更新信息超过允许大小，已停止读取。',
  update_invalid_url: '更新下载地址不符合官方 HTTPS 地址规则，已停止更新。',
  update_redirect_limit: '更新下载地址重定向次数过多，已停止更新。',
  update_digest_mismatch: '安装包校验失败，请重新下载。',
  update_size_mismatch: '安装包下载不完整，请重新下载。',
  update_signature_mismatch: '安装包签名与当前 App 不一致，不能覆盖安装。',
  update_package_mismatch: '新版与当前 App 的包名不一致，不能覆盖安装。',
  update_version_mismatch: '安装包实际版本与发行信息不一致，已停止安装。',
  update_version_not_newer: '安装包版本不高于当前 App，无需覆盖安装。',
  update_debug_apk: '此安装包是调试包，不能作为公开更新安装。',
  update_android_version: '此更新需要更高版本的 Android。',
  update_invalid_apk: '无法验证安装包，请重新下载。',
  update_no_space: '手机存储空间不足，请释放空间后重试。',
  update_permission_required: '请允许 DSHM 安装此来源的应用，返回后再次点击安装。',
  update_install_not_completed: '安装尚未完成，可再次点击安装更新。',
  update_installer_unavailable: '无法打开系统安装窗口，可从发行页下载安装。',
  update_bridge_failed: '更新操作未完成，请重试。',
  update_download_interrupted: '上次下载已中断，请重新下载。',
  update_cancelled: '更新操作已取消。',
  update_failed: '更新失败，原因未识别，请重新检查或前往发行页查看。',
});
export const updateError = error => updateFailures[error] ?? updateFailures.update_failed;

/** 普通聊天与Remote使用独立于模型/连接凭据的同一原生更新入口。 */
export class AppUpdates {
  #bridge;
  #listeners = new Set();
  #pending = new Map();
  #started = false;
  #state;
  constructor(bridge = globalThis.DSHMUpdates) {
    this.#bridge = bridge;
    this.#state = { phase: bridge ? 'idle' : 'unavailable', release: null, currentVersion: '', requiredPluginVersion: '', received: 0, revision: -1 };
    if (bridge) bridge.onmessage = event => {
      let response;
      try { response = JSON.parse(event.data); } catch { return; }
      if (response.event) { this.#accept(response.event); return; }
      const task = this.#pending.get(response.id);
      if (!task) return;
      clearTimeout(task.timer); this.#pending.delete(response.id);
      if (response.error) task.reject(Error(response.error));
      else { this.#accept(response.data); task.resolve(response.data); }
    };
  }
  #accept(state) {
    if (!state || !phases.has(state.phase) || !Number.isSafeInteger(state.revision) || state.revision < this.#state.revision) return;
    this.#state = state;
    for (const listener of this.#listeners) listener();
  }
  getSnapshot = () => this.#state;
  subscribe = listener => {
    this.#listeners.add(listener);
    if (!this.#started && this.#bridge) { this.#started = true; void this.action('watch'); }
    return () => this.#listeners.delete(listener);
  };
  openLink = url => this.action('openLink', { url });
  async action(operation, data = {}) {
    if (!this.#bridge) return;
    try {
      if (!['watch', 'read', 'check', 'download', 'cancel', 'install', 'openRelease', 'openLink'].includes(operation)) throw Error('update_bridge_failed');
      if (operation === 'openLink') {
        if (Object.keys(data).length !== 1 || typeof data.url !== 'string' || data.url.length > 8192) throw Error('update_bridge_failed');
        const url = new URL(data.url);
        if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) throw Error('update_bridge_failed');
      } else if (Object.keys(data).length) throw Error('update_bridge_failed');
      const id = crypto.randomUUID();
      return await new Promise((resolve, reject) => {
        const timer = setTimeout(() => { this.#pending.delete(id); reject(Error('update_bridge_failed')); }, 12000);
        this.#pending.set(id, { resolve, reject, timer });
        try { this.#bridge.postMessage(JSON.stringify({ id, op: `updates.${operation}`, data })); }
        catch { clearTimeout(timer); this.#pending.delete(id); reject(Error('update_bridge_failed')); }
      });
    } catch (error) {
      this.#state = { ...this.#state, phase: 'error', error: error.message };
      for (const listener of this.#listeners) listener();
    }
  }
}
let shared;
export const appUpdates = () => shared ??= new AppUpdates();
