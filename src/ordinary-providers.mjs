import { ORDINARY_MODELS, isProviderId, isModelId } from './ordinary-models.mjs';
export { isProviderId, isModelId } from './ordinary-models.mjs';

export const DEEPSEEK_PROVIDER = 'deepseek';
export const providerOf = value => value?.provider ?? DEEPSEEK_PROVIDER;
export const deepseekProvider = configured => ({ id: DEEPSEEK_PROVIDER, name: 'DeepSeek', baseURL: 'https://api.deepseek.com',
  revision: 'builtin-1', builtin: true, configured, models: ORDINARY_MODELS.map(model => ({ ...model, thinking: 'deepseek', tokenField: 'max_tokens', sampling: true })) });

export function selectedModel(providers, selection) {
  const provider = providers.find(item => item.id === providerOf(selection));
  const model = provider?.models.find(item => item.id === selection.model);
  return { provider, model, label: model ? `${model.label}${provider.builtin ? '' : ` · ${provider.name}`}` : selection.model };
}

/** 只保存服务配置；Key 通过独立原生密码窗口填写。 */
export function providerDraft(value) {
  const name = value.name?.trim();
  if (!name || name.length > 80 || !Array.isArray(value.models) || value.models.length < 1 || value.models.length > 50) throw new Error('invalid_provider');
  let url;
  try { url = new URL(value.baseURL); } catch { throw new Error('invalid_api_address'); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.search || url.hash || value.baseURL.length > 2048) throw new Error('invalid_api_address');
  const baseURL = url.href.replace(/\/+$/, '');
  if (baseURL.endsWith('/chat/completions')) throw new Error('api_base_required');
  const ids = new Set();
  const models = value.models.map(model => {
    const id = model.id?.trim(), label = model.label?.trim() || id;
    if (!isModelId(id) || ids.has(id) || !label || label.length > 80 || typeof model.vision !== 'boolean' ||
        !['none', 'thinking', 'reasoning_effort'].includes(model.thinking) || !['max_tokens', 'max_completion_tokens'].includes(model.tokenField) || typeof model.sampling !== 'boolean') throw new Error('invalid_provider');
    ids.add(id);
    return { id, label, vision: model.vision, thinking: model.thinking, tokenField: model.tokenField, sampling: model.sampling };
  });
  if (value.id !== undefined && (!isProviderId(value.id) || value.id === DEEPSEEK_PROVIDER)) throw new Error('invalid_provider');
  return { ...(value.id ? { id: value.id, revision: value.revision } : {}), name, baseURL, models };
}
