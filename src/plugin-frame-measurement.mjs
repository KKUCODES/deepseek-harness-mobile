import { flushSync } from 'react-dom';

const queues = new WeakMap();

/** 同一窗口先读完所有插件尺寸，再提交缩放，避免插件挂载阶段交错读写造成逐项重排。 */
export function schedulePluginFrameMeasurement(view, read, commit, initial = false) {
  let queue = queues.get(view);
  if (!queue) { queue = { pending: new Set(), frame: null, initial: false }; queues.set(view, queue); }
  const job = { read, commit, active: true };
  queue.pending.add(job);
  const flush = () => {
    queue.frame = null; queue.initial = false;
    const batch = [...queue.pending]; queue.pending.clear();
    const sizes = batch.map(item => item.active ? item.read() : undefined);
    flushSync(() => batch.forEach((item, index) => { if (item.active && sizes[index] !== undefined) item.commit(sizes[index]); }));
  };
  // 首次测量在整次React提交之后、历史定位的rAF之前完成；后续ResizeObserver仍按帧合并。
  if (initial && !queue.initial) {
    if (queue.frame !== null) view.cancelAnimationFrame(queue.frame);
    queue.frame = null; queue.initial = true;
    view.queueMicrotask(() => { if (queue.initial) flush(); });
  } else if (!queue.initial && queue.frame === null) queue.frame = view.requestAnimationFrame(flush);
  return () => {
    job.active = false; queue.pending.delete(job);
    if (!queue.pending.size && queue.frame !== null) { view.cancelAnimationFrame(queue.frame); queue.frame = null; }
    if (!queue.pending.size) queue.initial = false;
  };
}
