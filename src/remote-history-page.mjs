import { historyRecordFirstSeq, historyRecordLastSeq } from '../../deepseek-harness/packages/api/session-controller/src/client/sessions/history-records.ts';

/** 在原日志流把断层转为空起点前拒绝该页，保留窗口与手动重试能力。 */
export function validateRemoteHistoryPage(request, page) {
  const before = request?.beforeSeq;
  // 首次打开和重连补读由原 journal 校验，只有向前分页有相邻窗口边界。
  if (before === undefined) return;
  const earlier = page.records.filter(record => historyRecordFirstSeq(record) < before);
  const tail = earlier.at(-1);
  if (tail ? historyRecordLastSeq(tail) + 1 !== before : page.hasMore) {
    throw new Error('remote_history_page_discontinuous');
  }
}
