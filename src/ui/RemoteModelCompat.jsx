import React from 'react';
import { modelCompatBooleans, modelCompatEnums, modelCompatTemplates } from '../../../backend/packages/protocol/dist/index.js';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { useTranslate } from './locale.jsx';

const labels = {
  supportsStore: '支持保存请求', supportsDeveloperRole: '支持开发者角色', supportsReasoningEffort: '支持思考强度参数',
  supportsUsageInStreaming: '流式响应包含用量', supportsFinishReason: '流式响应包含结束原因',
  requiresToolResultName: '工具结果需要名称', requiresAssistantAfterToolResult: '工具结果后需要助手消息',
  requiresThinkingAsText: '将思考内容作为文本发送', requiresReasoningContentOnAssistantMessages: '助手消息需要思考内容字段',
  supportsThinkingTokenBudget: '支持思考预算参数', supportsMaxOutputTokens: '支持最大输出参数', supportsStrictMode: '支持严格模式',
  supportsLongCacheRetention: '支持长期缓存', supportsEagerToolInputStreaming: '支持提前传输工具输入',
  supportsCacheControlOnTools: '支持工具缓存控制', supportsTemperature: '支持温度参数', forceAdaptiveThinking: '强制自适应思考',
  allowEmptySignature: '允许空思考签名', supportsStrictTools: '支持严格工具定义',
  maxTokensField: '输出容量参数名', thinkingFormat: '思考参数格式', thinkingTokenBudgetField: '思考预算参数名',
  cacheControlFormat: '缓存控制格式', vllmPriority: '调度优先级', chatTemplateKwargs: '聊天模板参数', chatTemplateArgs: 'Baseten 模板参数',
};

export function RemoteModelCompat({ value = {}, templates = {}, position, disabled, onChange, onTemplate, provider = false }) {
  const t = useTranslate();
  const set = (key, next) => { const result = { ...value }; if (next === undefined) delete result[key]; else result[key] = next; onChange(result); };
  return <details className="remote-model-capabilities remote-model-compat">
    <summary>{t(provider ? '提供方协议兼容设置' : '模型协议兼容设置')}</summary>
    <p className="remote-muted">{t(provider ? '作为此提供方下模型的共同默认值，单个模型的设置优先。继承会移除提供方的用户覆盖，电脑会检查协议适用性。' : '仅在模型服务要求时修改。继承会移除本模型的覆盖，电脑会检查选项是否适用于当前协议。')}</p>
    {[...modelCompatBooleans, ...Object.keys(modelCompatEnums)].map(key => {
      const boolean = modelCompatBooleans.includes(key), options = boolean ? ['true', 'false'] : modelCompatEnums[key];
      return <label key={key}>{t(labels[key])}<small>{key}</small>
        <select className="sheet-editor" aria-label={`${t(labels[key])} ${position}`} disabled={disabled}
          value={value[key] === undefined ? '' : value[key] === null ? 'invalid' : String(value[key])}
          onChange={event => set(key, event.target.value === '' ? undefined : boolean ? event.target.value === 'true' : event.target.value)}>
          <option value="">{t('继承电脑默认')}</option>
          {value[key] === null && <option value="invalid" disabled>{t('配置无效，请重新选择')}</option>}
          {options.map(option => <option key={option} value={option}>{boolean ? t(option === 'true' ? '开启' : '关闭') : option}</option>)}
        </select>
      </label>;
    })}
    <label>{t(labels.vllmPriority)}<small>vllmPriority</small>
      <input className="sheet-editor" type="number" step="1" aria-label={`${t(labels.vllmPriority)} ${position}`} disabled={disabled}
        value={value.vllmPriority ?? ''} onChange={event => set('vllmPriority', event.target.value === '' ? undefined : event.target.valueAsNumber)}/>
    </label>
    {modelCompatTemplates.map(key => <label key={key}>{t(labels[key])}<small>{key}</small>
      <textarea className="sheet-editor" rows={4} maxLength={65536} spellCheck={false} aria-label={`${t(labels[key])} ${position}`} disabled={disabled}
        value={templates[key] ?? ''} placeholder={t('留空继承；填写 JSON 对象')}
        onChange={event => onTemplate(key, event.target.value)}/>
    </label>)}
    <p className="remote-muted">{t('模板参数支持文字、数字、布尔值、null，以及 thinking.enabled、thinking.effort、thinking.budget 变量；按服务文档填写。')}</p>
    <Button type="button" disabled={disabled} onClick={() => { onChange({}); for (const key of modelCompatTemplates) onTemplate(key, ''); }}>{t(provider ? '恢复提供方兼容设置' : '恢复本模型兼容设置')}</Button>
  </details>;
}
