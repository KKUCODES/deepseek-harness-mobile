import React from 'react';
import { useTranslate } from './locale.jsx';

const labels = { id: '模型 ID', name: '模型名称', contextWindow: '上下文容量（Token）', maxTokens: '输出容量（Token）' };

/** 新增与已有模型共用字段；容量保留输入文本，提交时才解析K/M。 */
export function RemoteModelFields({ row, position, disabled, onChange }) {
  const t = useTranslate();
  return <>{Object.entries(labels).map(([field, label]) => <label key={field}>{t(label)}
    <input className="sheet-editor" aria-label={`${t(label)} ${position}`} value={row[field]} disabled={disabled} maxLength={1024}
      onChange={event => onChange({ ...row, [field]: event.target.value })}/>
  </label>)}</>;
}
