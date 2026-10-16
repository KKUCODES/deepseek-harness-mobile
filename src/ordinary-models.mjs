// 能力核验：2026-09-23，https://api-docs.deepseek.com/quick_start/pricing/
export const ORDINARY_MODELS = Object.freeze([
  Object.freeze({ id: 'deepseek-flash', label: 'DeepSeek Flash', vision: true }),
  Object.freeze({ id: 'deepseek-v4-pro', label: 'DeepSeek Pro', vision: false }),
]);
export const DEFAULT_MODEL = ORDINARY_MODELS[0].id;
export const isProviderId = value => value === 'deepseek' || typeof value === 'string' && /^p-[a-f0-9-]{36}$/.test(value);
export const isModelId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,199}$/.test(value);
export const isModel = (value, provider = 'deepseek') => provider === 'deepseek' ? ORDINARY_MODELS.some(model => model.id === value) : isProviderId(provider) && isModelId(value);
export const isActiveTurn = turn => turn.status === 'sending' || turn.status === 'streaming';

export function chatPreferences(chat) {
  // 旧验证历史没有会话设置，优先保留它最后一次实际使用的模型。
  const last = chat.turns?.at(-1);
  const provider = chat.provider ?? (chat.model === undefined ? last?.provider : undefined) ?? 'deepseek';
  return { ...(provider === 'deepseek' ? {} : { provider }),
    model: isModel(chat.model, provider) ? chat.model : (last?.provider ?? 'deepseek') === provider && isModel(last?.model, provider) ? last.model : DEFAULT_MODEL,
    thinking: typeof chat.thinking === 'boolean' ? chat.thinking : false,
    ...(chat.requestOptions === undefined ? {} : { requestOptions: requestOptions(chat.requestOptions) }) };
}
import { requestOptions } from './ordinary-options.mjs';
