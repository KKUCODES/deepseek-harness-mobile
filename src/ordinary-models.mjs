// 能力核验：2026-09-23，https://api-docs.deepseek.com/quick_start/pricing/
export const ORDINARY_MODELS = Object.freeze([
  Object.freeze({ id: 'deepseek-flash', label: 'DeepSeek Flash', vision: true }),
  Object.freeze({ id: 'deepseek-v4-pro', label: 'DeepSeek Pro', vision: false }),
]);
export const DEFAULT_MODEL = ORDINARY_MODELS[0].id;
export const isModel = value => ORDINARY_MODELS.some(model => model.id === value);
export const isActiveTurn = turn => turn.status === 'sending' || turn.status === 'streaming';

export function chatPreferences(chat) {
  // 旧验证历史没有会话设置，优先保留它最后一次实际使用的模型。
  const last = chat.turns?.at(-1);
  return { model: isModel(chat.model) ? chat.model : isModel(last?.model) ? last.model : DEFAULT_MODEL,
    thinking: typeof chat.thinking === 'boolean' ? chat.thinking : false,
    ...(chat.requestOptions === undefined ? {} : { requestOptions: requestOptions(chat.requestOptions) }) };
}
import { requestOptions } from './ordinary-options.mjs';
