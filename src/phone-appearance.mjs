/** 只投影手机外观与语言；普通聊天设置仍是权威，原生镜像供另一个来源及冷启动读取。 */
export function appearanceValue(value) {
  if (!value || !['enabled,fontSize,preference', 'enabled,fontSize,language,preference'].includes(Object.keys(value).sort().join(','))
    || !['light', 'dark', 'system'].includes(value.preference) || typeof value.enabled !== 'boolean'
    || (Object.hasOwn(value, 'language') && !['zh', 'en'].includes(value.language))
    || !Number.isInteger(value.fontSize) || value.fontSize < 12 || value.fontSize > 17) throw new Error('invalid_phone_appearance');
  return { preference: value.preference, fontSize: value.fontSize, enabled: value.enabled, language: value.language ?? 'zh' };
}

export function mirrorPhoneAppearance(settings, plugins, native) {
  const theme = settings.bind({ namespace: 'ui-theme' }), locale = settings.bind({ namespace: 'locale' }), listeners = new Set();
  let tail = Promise.resolve(), saved = '', state = { error: false }, stopped = false;
  const publish = error => { state = { error }; for (const listener of listeners) listener(); };
  const sync = () => {
    const value = appearanceValue({ ...theme.getSnapshot().value, enabled: plugins.enabled('theme'), language: locale.getSnapshot().value.preference ?? 'zh' });
    const work = tail.then(async () => {
      if (stopped || !native.available || saved === JSON.stringify(value)) return;
      await native.call('appearance.write', value);
      saved = JSON.stringify(value); publish(false);
    });
    tail = work.catch(() => { if (!stopped) publish(true); });
    return tail;
  };
  const offTheme = theme.subscribe(sync), offLocale = locale.subscribe(sync), offPlugins = plugins.state.subscribe(sync);
  void sync();
  return { getSnapshot: () => state, subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    retry: sync, dispose: () => { stopped = true; offTheme(); offLocale(); offPlugins(); listeners.clear(); } };
}

export function watchPhoneAppearance(client, presenter, { events = window, media = matchMedia('(prefers-color-scheme: dark)'), onLanguage = () => {} } = {}) {
  let active = true, revision = 0, current = { preference: 'system', fontSize: 14, enabled: true, language: 'zh' };
  const apply = () => {
    onLanguage(current.language);
    if (!current.enabled) { presenter.dispose(); return; }
    const scheme = current.preference === 'system' ? media.matches ? 'dark' : 'light' : current.preference;
    // 手机仍只提供正文字号；新版 presenter 另需明确的代码/终端默认值与字体列表。
    presenter.apply({ preference: current.preference, fontSize: current.fontSize,
      fontSizes: { text: current.fontSize, code: 11, terminal: 13 },
      fontFamilies: { text: '', code: '', terminal: '' },
      active: { id: scheme, colorScheme: scheme, tokens: {} } });
  };
  const read = async () => {
    const owner = ++revision;
    try {
      const next = appearanceValue(await client.call('appearance.read'));
      if (active && owner === revision) { current = next; apply(); }
    } catch { /* 旧APK或短暂桥错误保留最后有效外观；恢复页面时重新读取。 */ }
  };
  const system = () => { if (active && current.preference === 'system') apply(); };
  events.addEventListener('dshm-appearance-change', read);
  events.addEventListener('pageshow', read);
  media.addEventListener('change', system);
  apply(); void read();
  return () => { active = false; revision++; events.removeEventListener('dshm-appearance-change', read); events.removeEventListener('pageshow', read); media.removeEventListener('change', system); presenter.dispose(); };
}
