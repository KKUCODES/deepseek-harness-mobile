import { ordinaryNative } from './ordinary-native.mjs';
import { writeClipboard as browserClipboard } from '@upstream/ui-primitives/src/clipboard.ts';

let remoteWriter;
// Remote 复用同一组复制控件，但写入必须走当前 Remote 宿主，不能借用普通聊天桥。
export function registerRemoteClipboard(writer) {
  remoteWriter = writer;
  return () => { if (remoteWriter === writer) remoteWriter = undefined; };
}

// 原代码块的复制反馈仍由原组件负责；手机只替换写入能力，不开放剪贴板读取。
export async function writeClipboard(text) {
  if (remoteWriter) {
    try { await remoteWriter(text); return true; } catch { return false; }
  }
  if (!globalThis.DSHMOrdinary) return browserClipboard(text);
  try { await ordinaryNative().call('clipboard.write', { text }); return true; }
  catch { return false; }
}
