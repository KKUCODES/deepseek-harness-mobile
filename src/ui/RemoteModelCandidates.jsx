import React, { useState } from 'react';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { useTranslate } from './locale.jsx';

export function RemoteModelCandidates({ candidates, rows, disabled, onAdopt }) {
  const t = useTranslate(), [query, setQuery] = useState(''), [selected, setSelected] = useState([]);
  const available = candidates.filter(candidate => !rows.some(row => row.id.trim() === candidate.id));
  const chosen = available.filter(row => selected.includes(row.id));
  const search = query.trim().toLowerCase();
  const visible = available.filter(row => !search || row.id.toLowerCase().includes(search) || row.name?.toLowerCase().includes(search));
  const allSelected = visible.length > 0 && visible.every(row => selected.includes(row.id));
  const toggle = () => {
    const ids = new Set(visible.map(row => row.id));
    // 批量操作只作用于当前筛选结果，隐藏的选择仍保留。
    setSelected(current => allSelected ? current.filter(id => !ids.has(id)) : [...new Set([...current, ...ids])]);
  };
  return <fieldset disabled={disabled} className="remote-model-candidates">
    <legend>{t('可用模型')}</legend>
    <input className="sheet-editor" type="search" aria-label={t('搜索模型 ID 或名称')} placeholder={t('搜索模型 ID 或名称')}
      value={query} onChange={event => setQuery(event.target.value)}/>
    <Button disabled={!visible.length} onClick={toggle}>{t(allSelected ? '取消选择当前结果' : '选择当前结果')}</Button>
    <p role="status">{t('已选择的模型')}：{chosen.length}</p>
    {!available.length && <p>{t('没有可添加的新模型。')}</p>}
    {!!available.length && !visible.length && <p role="status">{t('没有匹配的模型。')}</p>}
    {visible.map(row => <label key={row.id}>
      <input type="checkbox" checked={selected.includes(row.id)} onChange={event => setSelected(current => event.target.checked ? [...new Set([...current, row.id])] : current.filter(id => id !== row.id))}/>
      <span>{row.name && row.name !== row.id ? `${row.name} · ${row.id}` : row.id}</span>
    </label>)}
    <Button disabled={!chosen.length || rows.length + chosen.length > 1000} onClick={() => onAdopt(chosen)}>{t('加入编辑草稿')}</Button>
  </fieldset>;
}
