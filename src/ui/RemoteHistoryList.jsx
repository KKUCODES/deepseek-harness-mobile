import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer, defaultRangeExtractor, elementScroll } from '@tanstack/react-virtual';
import { ScrollFollow, scrollMetrics } from '@upstream/ui-chat/src/client/chat/use-scroll-follow.ts';
import { RemoteErrorBoundary } from './RemoteRecovery.jsx';
import { historyGroups } from '../remote-history.mjs';

/** 按回合组织，每组至多四个节点；保留原席位和会话级状态，活动输入保持挂载。 */
export function RemoteHistoryList({ conversation, cached, container, history, renderNode, following, sessionKey, reading, target, resume, onReading }) {
  const groups = useMemo(() => cached ?? historyGroups(conversation), [cached, conversation]);
  const element = useRef(null), previous = useRef(null), sizes = useRef(new Map());
  // 子组件layout effect先于父滚动区ref回调；首次已有历史时也要接上真实滚动区。
  const scrollElement = () => container.current ?? element.current?.closest('.conversation');
  const cacheMode = !!cached;
  const [margin, setMargin] = useState(0), [focused, setFocused] = useState(null);
  const [pinned, setPinned] = useState(null);
  const pendingAnchor = useRef(null);
  const restored = useRef(false);
  const virtual = useVirtualizer({ count: groups.length, getScrollElement: scrollElement,
    scrollToFn: (offset, options, instance) => {
      const host = instance.scrollElement;
      const owner = host && ScrollFollow.forElement(host);
      if (!owner) return elementScroll(offset, options, instance);
      // 虚拟高度校正是已知定位；经过原控制器登记，不能误当成读者上滑取消跟随。
      const active = owner.active;
      owner.jump(host, scrollMetrics(host), offset + (options.adjustments ?? 0));
      owner.setFollowing(active);
    },
    getItemKey: index => groups[index].id, estimateSize: index => sizes.current.get(groups[index].id) ?? 240,
    overscan: 2, scrollMargin: margin,
    rangeExtractor: useCallback(range => {
      const result = defaultRangeExtractor(range);
      for (const key of [focused, pinned]) {
        const index = groups.findIndex(group => group.id === key);
        if (index >= 0 && !result.includes(index)) result.push(index);
      }
      return result.sort((a, b) => a - b);
    }, [groups, focused, pinned]),
    measureElement: (node, entry) => {
      const height = entry?.borderBoxSize?.[0]?.blockSize ?? node.getBoundingClientRect().height;
      const id = node.dataset.historyGroup;
      if (id) {
        sizes.current.delete(id); sizes.current.set(id, height);
        // 连续历史不裁剪；只保留数字高度，避免回看已读记录时退回估算高度造成跳动。
      }
      return height;
    },
    shouldAdjustScrollPositionOnItemSizeChange: (item, _delta, instance) => !pendingAnchor.current && !following.current && item.start < (instance.scrollOffset ?? 0),
  });
  useLayoutEffect(() => {
    const host = scrollElement(), list = element.current;
    if (!host || !list) return;
    const measure = () => setMargin(list.getBoundingClientRect().top - host.getBoundingClientRect().top + host.scrollTop);
    measure(); const observer = new ResizeObserver(measure); observer.observe(host); observer.observe(list.parentElement);
    return () => observer.disconnect();
  }, [container, sessionKey]);
  useLayoutEffect(() => {
    const host = scrollElement();
    if (!host) return;
    // 最后一页会移除加载按钮。先用新列表起点重算虚拟位置，再恢复锚点；
    // 不能先采样已经偏移的 DOM，否则会把按钮高度的变化记成读者滚动。
    const actualMargin = element.current.getBoundingClientRect().top - host.getBoundingClientRect().top + host.scrollTop;
    if (Math.abs(actualMargin - margin) > 0.5) { setMargin(actualMargin); return; }
    const before = pendingAnchor.current ?? previous.current;
    let correction, correcting = false;
    if (!restored.current && resume?.selected === sessionKey && groups.length) {
      restored.current = true;
      const index = groups.findIndex(group => resume.nodeKey
        ? group.nodes.some(node => node.key === resume.nodeKey) : group.id === resume.group);
      if (index >= 0) {
        following.current = false;
        host.scrollTop = (virtual.getMeasurements()[index]?.start ?? 0) + resume.offset;
        if (resume.nodeKey) correction = requestAnimationFrame(() => {
          const start = virtual.getMeasurements()[index]?.start ?? 0;
          ScrollFollow.forElement(host)?.jump(host, scrollMetrics(host), start + resume.offset);
          following.current = false;
        });
      } else if (resume.nodeKey && !cached) {
        following.current = true;
      }
    }
    if (before && (pendingAnchor.current || before.key !== groups[0]?.id || before.cacheMode !== cacheMode || before.margin !== margin) && !following.current) {
      const index = groups.findIndex(group => group.id === before.anchor);
      if (index >= 0) {
        // 高度估算可能让目标暂时落在虚拟范围外。固定挂载原锚点，等实际测量
        // 与加载按钮起点都稳定后才采集新位置，不能只补偿一帧就丢弃它。
        pendingAnchor.current = before;
        setPinned(before.anchor);
        correcting = true;
        let last, stable = 0;
        const restore = () => {
          if (pendingAnchor.current !== before || !host.isConnected) return;
          const node = [...(element.current?.querySelectorAll('[data-history-group]') ?? [])].find(node => node.dataset.historyGroup === before.anchor);
          if (node && Number.isFinite(before.pixelOffset)) {
            const offset = node.getBoundingClientRect().top - host.getBoundingClientRect().top - before.pixelOffset;
            const metrics = scrollMetrics(host), targetTop = host.scrollTop + offset;
            const clamped = targetTop < 0 || targetTop > metrics.floor;
            const owner = ScrollFollow.forElement(host);
            if (owner) { owner.jump(host, metrics, targetTop); owner.setFollowing(false); }
            else host.scrollTop += offset;
            const next = [host.scrollTop, virtual.getTotalSize(), element.current.getBoundingClientRect().top - host.getBoundingClientRect().top + host.scrollTop];
            stable = last && next.every((value, i) => Math.abs(value - last[i]) < 0.5) && (Math.abs(offset) < 0.5 || clamped) ? stable + 1 : 0;
            last = next;
            if (stable >= 2) {
              pendingAnchor.current = null; setPinned(null); correcting = false; capture(); return;
            }
          }
          correction = requestAnimationFrame(restore);
        };
        correction = requestAnimationFrame(restore);
      }
    }
    const capture = () => {
      if (correcting || pendingAnchor.current) return;
      const currentMargin = element.current.getBoundingClientRect().top - host.getBoundingClientRect().top + host.scrollTop;
      if (Math.abs(currentMargin - margin) > 0.5) return;
      const items = virtual.getVirtualItems();
      // ResizeObserver 的新高度可能已画到 DOM，而虚拟器的滚动快照还在上一帧。
      // 以实际可见组为准，避免把前一组误记为锚点，随后 margin 更新又跳回它。
      const top = host.getBoundingClientRect().top;
      const node = [...element.current.querySelectorAll('[data-history-group]')].find(node => node.getBoundingClientRect().bottom > top);
      const item = items.find(item => item.key === node?.dataset.historyGroup);
      previous.current = { key: groups[0]?.id, cacheMode, margin, anchor: item?.key, offset: host.scrollTop - (item?.start ?? 0),
        pixelOffset: node ? node.getBoundingClientRect().top - host.getBoundingClientRect().top : undefined };
      history?.setAnchor(following.current ? undefined : groups[item?.index]?.seq);
      const group = groups[item?.index];
      if (group && !cached) {
        const anchor = { selected: sessionKey, seq: group.seq, group: group.id, nodeKey: group.nodes[0].key, offset: previous.current.offset };
        reading?.remember(sessionKey, target, anchor);
        onReading?.(following.current ? null : anchor);
      }
    };
    const interrupt = () => {
      pendingAnchor.current = null; setPinned(null); correcting = false;
      cancelAnimationFrame(correction); capture();
    };
    capture(); host.addEventListener('scroll', capture, { passive: true });
    for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown']) host.addEventListener(type, interrupt, { passive: true, capture: true });
    return () => {
      cancelAnimationFrame(correction); host.removeEventListener('scroll', capture);
      for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown']) host.removeEventListener(type, interrupt, true);
    };
  }, [groups, history, virtual, following, container, cacheMode, cached, resume, onReading, reading, sessionKey, target, margin]);
  useLayoutEffect(() => { element.current.inert = cacheMode; }, [cacheMode]);
  return <div ref={element} className="remote-history-list" data-history-count={groups.length} data-cached-history={cached ? '' : undefined} data-history-positioning={pinned ? '' : undefined}
    style={{ height: virtual.getTotalSize(), position: 'relative', width: '100%', overflowAnchor: 'none' }}>
    {virtual.getVirtualItems().map(item => {
      const group = groups[item.index];
      return <div key={item.key} ref={virtual.measureElement} data-index={item.index} data-history-group={group.id}
        // 直接定位，避免旧WebView把变换容器内原DSH的sticky代码工具栏推到块底部。
        className="remote-history-group" style={{ position: 'absolute', top: item.start - margin, left: 0, width: '100%' }}
        onFocusCapture={() => setFocused(group.id)} onBlurCapture={event => {
          if (!event.currentTarget.contains(event.relatedTarget)) setFocused(null);
        }}>
        <RemoteErrorBoundary resetKey={`${sessionKey}:${group.id}`} message="这段记录暂时无法显示，可以重试。">
          {group.nodes.map(node => <React.Fragment key={node.key}>{renderNode(node)}</React.Fragment>)}
        </RemoteErrorBoundary>
      </div>;
    })}
  </div>;
}
