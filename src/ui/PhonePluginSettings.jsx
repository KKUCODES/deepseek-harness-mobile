import React, { useState } from 'react';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { useTranslate } from './locale.jsx';

function PromptSettings({ host, onDone }) {
  const t = useTranslate(), scope = host.ordinaryInput.promptSettings;
  const [prompts, setPrompts] = useState(() => structuredClone(scope.getSnapshot().value.prompts));
  const [error, setError] = useState(false);
  return <>
    {prompts.map((prompt, index) => <div className="prompt-field" key={index}>
      {['name', 'label', 'value'].map(field => <label key={field}>{t({ name: '触发词', label: '名称', value: '提示词' }[field])}{field === 'value'
        ? <textarea value={prompt[field]} onChange={event => setPrompts(rows => rows.map((item, i) => i === index ? { ...item, [field]: event.target.value } : item))}/>
        : <input value={prompt[field]} onChange={event => setPrompts(rows => rows.map((item, i) => i === index ? { ...item, [field]: event.target.value } : item))}/>}</label>)}
      <Button onClick={() => setPrompts(rows => rows.filter((_, i) => i !== index))}>{t('移除这条提示词')}</Button>
    </div>)}
    <Button disabled={prompts.length >= 30} onClick={() => setPrompts(rows => [...rows, { name: `prompt${rows.length + 1}`, label: t('新提示词'), value: '' }])}>{t('添加提示词')}</Button>
    <Button variant="primary" onClick={async () => { try { await scope.set('prompts', prompts); onDone(); } catch { setError(true); } }}>{t('保存')}</Button>
    {error && <p role="alert">{t('保存失败：触发词需唯一且不含空格，名称和提示词不能为空。')}</p>}
  </>;
}
function AppearanceSettings({ renderSlot }) { return renderSlot('settings.general.item', {}); }

/** 配置入口按目录声明的能力解析；新插件可以复用或提供新的配置组件。 */
export const phonePluginSettings = { prompts: PromptSettings, appearance: AppearanceSettings };
