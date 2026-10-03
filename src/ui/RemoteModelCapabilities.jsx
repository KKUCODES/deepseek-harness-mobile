import React from 'react';
import { useTranslate } from './locale.jsx';

const levels = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];
const levelNames = ['关闭', '极低', '低', '中', '高', '更高', '最高'];

/** 只编辑已公开的能力声明；省略与 false 必须保留区别，交给电脑解析实际能力。 */
export function RemoteModelCapabilities({ value = {}, position, disabled, onChange, inputOnly = false }) {
  const t = useTranslate(), efforts = value.reasoningEfforts;
  const mode = efforts === undefined ? 'inherit' : efforts === false ? 'disabled' : 'custom';
  const input = value.input?.length ? [...value.input].sort().join(',') : 'inherit';
  const set = (key, next) => { const result = { ...value }; if (next === undefined) delete result[key]; else result[key] = next; onChange(result); };
  return <details className="remote-model-capabilities">
    <summary>{t(inputOnly ? '输入类型' : '输入与思考能力')}</summary>
    <label>{t('输入类型')}
      <select className="sheet-editor" aria-label={`${t('输入类型')} ${position}`} value={input} disabled={disabled}
        onChange={event => set('input', event.target.value === 'inherit' ? undefined : event.target.value.split(','))}>
        <option value="inherit">{t('继承电脑默认')}</option>
        <option value="text">{t('文字')}</option><option value="image">{t('图片')}</option>
        <option value="image,text">{t('文字与图片')}</option>
      </select>
    </label>
    {!inputOnly && <label>{t('思考能力')}
      <select className="sheet-editor" aria-label={`${t('思考能力')} ${position}`} value={mode} disabled={disabled}
        onChange={event => set('reasoningEfforts', event.target.value === 'inherit' ? undefined : event.target.value === 'disabled' ? false : {})}>
        <option value="inherit">{t('继承电脑默认')}</option><option value="disabled">{t('关闭')}</option><option value="custom">{t('自定义档位')}</option>
      </select>
    </label>}
    {!inputOnly && mode === 'custom' && <fieldset disabled={disabled} aria-label={`${t('思考档位')} ${position}`}>
      <legend>{t('思考档位')}</legend>
      <p className="remote-muted">{t('勾选模型支持的档位，并填写服务接受的值。至少选择一个思考档位；关闭档位留空表示不发送参数。')}</p>
      {levels.map((level, index) => {
        const selected = efforts !== null && Object.hasOwn(efforts, level);
        return <div className="remote-model-effort" key={level}>
          <label><input type="checkbox" aria-label={`${t('启用档位')} ${level} ${position}`} checked={selected}
            onChange={event => { const next = { ...efforts }; if (event.target.checked) next[level] = level === 'off' ? null : ''; else delete next[level]; set('reasoningEfforts', next); }}/>
            {t(levelNames[index])} ({level})</label>
          {selected && <input className="sheet-editor" aria-label={`${t('服务参数值')} ${level} ${position}`} maxLength={1024}
            value={efforts[level] ?? ''} onChange={event => set('reasoningEfforts', { ...efforts, [level]: level === 'off' && event.target.value === '' ? null : event.target.value })}/>}
        </div>;
      })}
    </fieldset>}
  </details>;
}
