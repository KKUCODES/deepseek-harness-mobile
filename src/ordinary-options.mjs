// 已核验 API 字段：https://api-docs.deepseek.com/api/create-chat-completion/ (2026-09-23)
export const DEFAULT_REQUEST_OPTIONS = Object.freeze({ maxTokens: null, reasoningEffort: 'high', temperature: 1, topP: 1 });
export function requestOptions(value = DEFAULT_REQUEST_OPTIONS) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !Object.hasOwn(DEFAULT_REQUEST_OPTIONS, key))) throw new Error('invalid_preferences');
  const result = { ...DEFAULT_REQUEST_OPTIONS, ...value };
  if (result.maxTokens !== null && (!Number.isSafeInteger(result.maxTokens) || result.maxTokens < 1 || result.maxTokens > 393216) ||
    !['low', 'high', 'max'].includes(result.reasoningEffort) ||
    typeof result.temperature !== 'number' || !Number.isFinite(result.temperature) || result.temperature < 0 || result.temperature > 2 ||
    typeof result.topP !== 'number' || !Number.isFinite(result.topP) || result.topP < 0.95 || result.topP > 1) throw new Error('invalid_preferences');
  return result;
}
