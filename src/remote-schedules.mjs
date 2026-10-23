import { isProfileDshVersion } from './remote-dsh-version.mjs';

/** 新版提醒属于Host持久服务；每个打开的面板只观察其会话，不唤醒Agent。 */
export class RemoteScheduleCatalog {
  listeners = new Set();
  snapshot = { modern: false, status: 'idle', records: [], error: null };
  reads = 0;
  stopped = true;
  constructor(model, sessionId) {
    this.model = model; this.sessionId = sessionId;
    this.snapshot = { ...this.snapshot, modern: this.available };
  }
  get available() {
    const capabilities = this.model.transport.capabilities;
    return isProfileDshVersion(capabilities?.dshVersion) && capabilities.endpoints?.calls?.includes('schedule/list') === true;
  }
  subscribe = listener => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  getSnapshot = () => this.snapshot;
  publish(patch) {
    if (this.stopped) return;
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }
  start() {
    if (!this.stopped) return;
    this.stopped = false;
    this.offState = this.model.subscribe(this.observe);
    this.observe();
  }
  observe = () => {
    const modern = this.available;
    const available = this.available;
    if (available && !this.offChanged) this.offChanged = this.model.remote.$on('schedule/changed', () => { void this.refresh(); });
    const generation = available && this.model.getSnapshot().connectionState === 'connected'
      ? this.model.connection.generation.getSnapshot() : null;
    if (this.generation === generation && this.supported === available) return;
    this.generation = generation; this.supported = available; this.reads++;
    // 断线保留最后一次结果，迟到读取不能将旧连接的数据认作当前状态。
    this.publish({ modern: modern || this.snapshot.modern, status: generation ? 'loading' : 'idle', error: null });
    if (generation) void this.refresh();
  };
  async refresh() {
    if (this.stopped || !this.available || this.model.getSnapshot().connectionState !== 'connected') return;
    const read = ++this.reads;
    this.publish({ status: 'loading', error: null });
    try {
      const result = await this.model.remote.schedule.list({ sessionId: this.sessionId });
      if (this.stopped || read !== this.reads) return;
      if (!result.ok) throw result.error;
      if (!Array.isArray(result.value)) throw Error('invalid_schedule_list');
      this.publish({ status: 'ready', records: result.value });
    } catch (error) {
      if (!this.stopped && read === this.reads) this.publish({ status: 'error', error: error.message });
    }
  }
  dispose() {
    this.stopped = true; this.reads++; this.generation = undefined; this.supported = undefined;
    this.offChanged?.(); this.offState?.();
    this.offChanged = undefined; this.offState = undefined;
  }
}

const units = [[86400, 'day'], [3600, 'hour'], [60, 'minute'], [1, 'second']];
export function scheduleRuleText(record, t, locale) {
  if (record.kind === 'after' || record.kind === 'at') return t('单次提醒');
  if (record.kind === 'every') {
    const [seconds, unit] = units.find(([value]) => record.everySeconds % value === 0) ?? units.at(-1);
    return t('每 {interval}', { interval: new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'long' }).format(record.everySeconds / seconds) });
  }
  const fields = { time: record.time?.slice(0, 8), zone: record.timeZone };
  if (record.kind === 'daily') return t('每天 {time}（{zone}）', fields);
  if (record.kind === 'weekly') {
    const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
    const days = new Intl.ListFormat(locale, { style: 'short', type: 'conjunction' })
      .format(record.weekdays.map(day => formatter.format(Date.UTC(2024, 0, day))));
    return t('每周 {days} {time}（{zone}）', { ...fields, days });
  }
  if (record.kind === 'cron') return t('自定义周期：{expression}（{zone}）', { expression: record.expression, zone: record.timeZone });
  return t('定时提醒');
}
