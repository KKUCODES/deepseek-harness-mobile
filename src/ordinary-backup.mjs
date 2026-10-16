import { chatPreferences, isActiveTurn, isModel, isProviderId } from './ordinary-models.mjs';
import { cleanAttachments } from './ordinary-attachments.mjs';
import { requestOptions } from './ordinary-options.mjs';

export const BACKUP_FORMAT = 'dshm.ordinary-history';
export const BACKUP_VERSION = 2;
export const MAX_BACKUP_BYTES = 32 * 1024 * 1024;
const statuses = new Set(['sending', 'streaming', 'completed', 'interrupted', 'failed']);
const fail = () => { throw new Error('invalid_backup'); };
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const string = (value, max, empty = true) => {
  if (typeof value !== 'string' || value.length > max || (!empty && !value)) fail();
  return value;
};
const optionalString = (value, max) => value == null ? null : string(value, max);
const timestamp = value => {
  if (!Number.isSafeInteger(value) || value < 0) fail();
  return value;
};

/** 显式挑选聊天字段；设置、Key、Remote 身份或额外属性都不进入备份。 */
export function portableChat(value) {
  if (!object(value) || value.mode !== 'ordinary' || !Array.isArray(value.turns) || value.turns.length > 10000) fail();
  if (value.provider !== undefined && !isProviderId(value.provider)) fail();
  if (value.model !== undefined && !isModel(value.model, value.provider)) fail();
  if (value.thinking !== undefined && typeof value.thinking !== 'boolean') fail();
  const ids = new Set();
  const turns = value.turns.map(turn => {
    if (!object(turn) || !statuses.has(turn.status) || !isModel(turn.model, turn.provider)) fail();
    const requestId = string(turn.requestId, 80, false);
    if (ids.has(requestId)) fail();
    ids.add(requestId);
    const result = { requestId, prompt: string(turn.prompt, 100000), model: turn.model,
      ...(turn.provider && turn.provider !== 'deepseek' ? { provider: turn.provider } : {}),
      thinking: turn.thinking ?? false, status: isActiveTurn(turn) ? 'interrupted' : turn.status,
      content: string(turn.content, 4 * 1024 * 1024), reasoning: string(turn.reasoning ?? '', 4 * 1024 * 1024),
      error: isActiveTurn(turn) ? 'backup_interrupted' : optionalString(turn.error, 128),
      finishReason: optionalString(turn.finishReason, 128), responseId: optionalString(turn.responseId, 256) };
    if (turn.attachments !== undefined) {
      const attachments = cleanAttachments(turn.attachments);
      if (attachments.length) result.attachments = attachments;
    }
    if (typeof result.thinking !== 'boolean') fail();
    if (turn.requestOptions !== undefined) result.requestOptions = requestOptions(turn.requestOptions);
    if (turn.usage != null) {
      if (!object(turn.usage)) fail();
      result.usage = Object.fromEntries(['prompt_tokens', 'completion_tokens', 'total_tokens'].map(key => [key, timestamp(turn.usage[key])]));
    }
    return result;
  });
  const attachments = cleanAttachments(value.attachments);
  return { id: string(value.id, 80, false), mode: 'ordinary', title: string(value.title, 200, false),
    draft: string(value.draft, 100000), ...chatPreferences(value), turns, updatedAt: timestamp(value.updatedAt),
    ...(attachments.length ? { attachments } : {}),
    ...(value.branchOf ? { branchOf: string(value.branchOf, 80, false) } : {}) };
}

export function encodeBackup(chats, now = Date.now()) {
  const backup = JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now, chats: chats.map(portableChat) });
  if (new TextEncoder().encode(backup).length > MAX_BACKUP_BYTES) throw new Error('backup_too_large');
  return backup;
}

export function decodeBackup(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) throw new Error('backup_too_large');
  let value;
  try { value = JSON.parse(text); } catch { fail(); }
  if (!object(value) || value.format !== BACKUP_FORMAT || ![1, BACKUP_VERSION].includes(value.version) ||
      !Array.isArray(value.chats) || value.chats.length > 10000) fail();
  timestamp(value.exportedAt);
  const ids = new Set();
  return value.chats.map(chat => {
    // 旧备份只能指向 DeepSeek；新格式防止旧 App 忽略供应商后用错 Key/目标。
    if (value.version === 1 && (chat?.provider !== undefined || Array.isArray(chat?.turns) && chat.turns.some(turn => turn?.provider !== undefined))) fail();
    const clean = portableChat(chat);
    if (ids.has(clean.id)) fail();
    ids.add(clean.id);
    return clean;
  });
}
