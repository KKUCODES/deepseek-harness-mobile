/** 手机设置 provider；只接受已核验的本地 namespace，不冒充完整 DSH Host。 */
const specs = {
  'ordinary-prompts': {
    defaults: { prompts: [{ name: '总结', label: '总结', value: '请总结下面的内容：' }, { name: 'translate', label: '翻译', value: '请翻译以下内容：' }] },
    valid: { prompts: value => Array.isArray(value) && value.length <= 30 && new Set(value.map(item => item?.name)).size === value.length && value.every(item =>
      item && typeof item.name === 'string' && /^[\p{L}\p{N}_-]{1,30}$/u.test(item.name) &&
      typeof item.label === 'string' && item.label.trim().length > 0 && item.label.length <= 60 &&
      typeof item.value === 'string' && item.value.trim().length > 0 && item.value.length <= 10000 &&
      Object.keys(item).every(key => ['name', 'label', 'value'].includes(key))) },
  },
  'ordinary-chat': {
    defaults: { model: 'deepseek-flash' },
    valid: { model: value => ['deepseek-flash', 'deepseek-v4-pro'].includes(value) },
  },
  'ui-theme': {
    defaults: { preference: 'system', fontSize: 14 },
    valid: {
      preference: value => ['light', 'dark', 'system'].includes(value),
      fontSize: value => Number.isInteger(value) && value >= 12 && value <= 17,
    },
  },
  locale: {
    defaults: {},
    valid: { preference: value => typeof value === 'string' && /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/.test(value) },
  },
};

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

export class LocalSettings {
  #scopes = new Map();
  constructor(storage, prefix = 'dshm:ordinary:settings:') {
    this.storage = storage;
    this.prefix = prefix;
  }

  bind({ namespace, decode }) {
    if (!Object.hasOwn(specs, namespace)) throw new Error(`unsupported_settings_namespace:${namespace}`);
    const spec = specs[namespace];
    if (decode) throw new Error('custom_settings_decoder_not_supported');
    if (this.#scopes.has(namespace)) return this.#scopes.get(namespace);
    const key = this.prefix + namespace;
    let user = {};
    let revision = 0;
    const stored = this.storage.getItem(key);
    if (stored !== null) {
      const record = JSON.parse(stored);
      if (!record || !Number.isSafeInteger(record.revision) || record.revision < 0
        || !record.user || Array.isArray(record.user) || typeof record.user !== 'object') {
        throw new Error('invalid_settings_record');
      }
      for (const [field, value] of Object.entries(record.user)) {
        if (!Object.hasOwn(spec.valid, field) || !spec.valid[field](value)) throw new Error('invalid_stored_setting');
      }
      user = record.user;
      revision = record.revision;
    }
    const listeners = new Set();
    const snapshotOf = () => freeze({
      status: 'ready', value: { ...spec.defaults, ...user }, base: { ...spec.defaults },
      user: { ...user }, revision, writable: true,
      // 兼容 SettingsScope 的 host/memory 联合类型；实际权威 provider 是手机本地，不是远程电脑。
      mode: 'host',
    });
    let snapshot = snapshotOf();
    let tail = Promise.resolve();
    const mutate = (operations, expectedRevision) => {
      const ops = structuredClone(operations);
      const job = tail.then(() => {
        if (expectedRevision !== undefined && expectedRevision !== revision) throw new Error('settings_revision_conflict');
        const next = { ...user };
        for (const operation of ops) {
          const { op, path, value } = operation;
          if (!Array.isArray(path) || path.length !== 1 || !Object.hasOwn(spec.valid, path[0])) {
            throw new Error('unsupported_settings_path');
          }
          if (op === 'unset') delete next[path[0]];
          else if (op === 'set' && spec.valid[path[0]](value)) next[path[0]] = value;
          else throw new Error('invalid_setting');
        }
        // 持久化失败时不发布成功快照；整组变更一次提交。
        this.storage.setItem(key, JSON.stringify({ revision: revision + 1, user: next }));
        user = next;
        revision++;
        snapshot = snapshotOf();
        for (const listener of [...listeners]) {
          try { listener(); } catch { /* 消费方错误不撤销已经持久化的提交，也不阻断其他订阅。 */ }
        }
      });
      tail = job.catch(() => {});
      return job;
    };
    const scope = {
      getSnapshot: () => snapshot,
      subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
      mutate,
      set: (field, value) => mutate([{ op: 'set', path: [field], value }]),
      unset: field => mutate([{ op: 'unset', path: [field] }]),
    };
    this.#scopes.set(namespace, scope);
    return scope;
  }

  /** 新版 ConfigForm 的本地适配；仅开放已校验的手机设置。 */
  configForms({ themeDefaults = {} } = {}) {
    const forms = new Map();
    return Object.freeze({ get: namespace => {
      if (forms.has(namespace)) return forms.get(namespace);
      // 新版 ConfigForm 与旧 SettingsScope 共用手机存储、订阅和原子校验。
      // get仍经bind校验固定namespace；不加载电脑配置目录或开放任意路径。
      const scope = this.bind({ namespace });
      let source, snapshot;
      const getSnapshot = namespace !== 'ui-theme' || Object.keys(themeDefaults).length === 0 ? scope.getSnapshot : () => {
        const next = scope.getSnapshot();
        if (source !== next) {
          source = next;
          // 新 SDK 的固定字体默认值属于手机 composition；写入仍受原本地字段校验约束。
          snapshot = freeze({ ...next, value: { ...themeDefaults, ...next.value }, base: { ...themeDefaults, ...next.base } });
        }
        return snapshot;
      };
      const form = Object.freeze({ getSnapshot, subscribe: scope.subscribe,
        mutate: (ops, revision) => scope.mutate(ops, revision).then(() => true),
        set: (field, value) => scope.set(field, value).then(() => true),
        unset: field => scope.unset(field).then(() => true) });
      forms.set(namespace, form); return form;
    } });
  }

  /** 明确的本地 service face；不提供 workspace、Agent、文件或电脑登录事实。 */
  facade() {
    return Object.freeze({
      provider: 'dshm-local-settings',
      settings: Object.freeze({
        read: namespace => this.bind({ namespace }).getSnapshot(),
        mutate: (namespace, ops, revision) => this.bind({ namespace }).mutate(ops, revision),
      }),
    });
  }
}
