import React, { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import { translate } from './translations.mjs';

const Locale = createContext('zh');
const Translation = createContext((text, values) => translate('zh', text, values));

export function LocalizedApp({ host, children }) {
  const scope = host.settings.bind({ namespace: 'locale' });
  const locale = useSyncExternalStore(scope.subscribe, scope.getSnapshot).value.preference ?? 'zh';
  return <LocaleProvider locale={locale}>{children}</LocaleProvider>;
}

export function LocaleProvider({ locale, children }) {
  useEffect(() => { document.documentElement.lang = locale === 'en' ? 'en' : 'zh-CN'; }, [locale]);
  const t = useMemo(() => (text, values) => translate(locale, text, values), [locale]);
  return <Locale.Provider value={locale}><Translation.Provider value={t}>{children}</Translation.Provider></Locale.Provider>;
}
export const useLocale = () => useContext(Locale);
export const useTranslate = () => useContext(Translation);
