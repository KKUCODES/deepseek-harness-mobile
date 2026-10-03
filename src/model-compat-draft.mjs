import { modelCompatTemplates } from '../../backend/packages/protocol/dist/index.js';

export const compatTemplateDraft = value => Object.fromEntries(modelCompatTemplates.flatMap(key =>
  value?.[key] === undefined ? [] : [[key, JSON.stringify(value[key], null, 2)]]));

export function compatPayload(value, templates = {}) {
  const compat = { ...value };
  for (const [key, text] of Object.entries(templates)) {
    if (!text.trim()) delete compat[key];
    else try { compat[key] = JSON.parse(text); } catch { throw new Error('模板参数需要有效的 JSON 对象。'); }
  }
  return compat;
}
