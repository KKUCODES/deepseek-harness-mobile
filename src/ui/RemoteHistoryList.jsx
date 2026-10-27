import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer, defaultRangeExtractor, elementScroll } from '@tanstack/react-virtual';
import { ScrollFollow, scrollMetrics } from '@upstream/ui-chat/src/client/chat/use-scroll-follow.ts';
import { RemoteErrorBoundary } from './RemoteRecovery.jsx';

export function historyGroups(conversation) {
  const groups = [];
  for (const key of conversation?.order ?? []) {
    const node = conversation.nodes.get(key);
    if (!node || node.visibility === 'hidden') continue;
    const locationTurn = node.location?.turn;
    const turn = typeof locationTurn === 'number' ? locationTurn : locationTurn?.turn ?? node.data?.turn;
    const id = turn === undefined ? key : `turn:${turn}`;
    let group = groups.at(-1);
    if (group?.turnId !== id || group.nodes.length >= 4) {
      group = { id: group?.turnId === id ? `${id}:${key}` : id, turnId: id, nodes: [], seq: Math.max(0, Math.floor(node.seq ?? node.data?.seq ?? node.anchorSeq)) };
      groups.push(group);
    }
    group.nodes.push(node);
  }
  return groups;
}

/** 按回合组织，每组至多四个节点；保留原席位和会话级状态，活动输入保持挂载。 */
export function RemoteHistoryList({ conversation, container, history, renderNode, following, sessionKey, reading, target, resume }) {
  const groups = useMemo(() => historyGroups(conversation), [conversation]);
  const element = useRef(null), previous = useRef(null), sizes = useRef(new Map());
  // 子组件layout effect先于父滚动区ref回调；首次已有历史时也要接上真实滚动区。
  const scrollElement = () => container.current ?? element.current?.closest('.conversation');
  const [margin, setMargin] = useState(0), [focused, setFocused] = useState(null);
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
      const result = defaultRangeExtractor(range), index = groups.findIndex(group => group.id === focused);
      return index >= 0 && !result.includes(index) ? [...result, index].sort((a, b) => a - b) : result;
    }, [groups, focused]),
    measureElement: (node, entry) => {
      const height = entry?.borderBoxSize?.[0]?.blockSize ?? node.getBoundingClientRect().height;
      const id = node.dataset.historyGroup;
      if (id) {
        sizes.current.delete(id); sizes.current.set(id, height);
        // 连续历史不裁剪；只保留数字高度，避免回看已读记录时退回估算高度造成跳动。
      }
      return height;
    },
    shouldAdjustScrollPositionOnItemSizeChange: (item, _delta, instance) => !following.current && item.start < (instance.scrollOffset ?? 0),
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
    const before = previous.current;
    let correction;
    if (!restored.current && resume?.selected === sessionKey && groups.length) {
      restored.current = true;
      const index = groups.findIndex(group => group.id === resume.group);
      if (index >= 0) {
        following.current = false;
        host.scrollTop = (virtual.getMeasurements()[index]?.start ?? 0) + resume.offset;
      }
    }
    if (before && before.key !== groups[0]?.id && !following.current) {
      const index = groups.findIndex(group => group.id === before.anchor);
      if (index >= 0) {
        const offset = virtual.getMeasurements()[index]?.start;
        if (offset !== undefined) host.scrollTop = offset + before.offset;
        correction = requestAnimationFrame(() => {
          const node = [...(element.current?.querySelectorAll('[data-history-group]') ?? [])].find(node => node.dataset.historyGroup === before.anchor);
          if (node && Number.isFinite(before.pixelOffset)) host.scrollTop += node.getBoundingClientRect().top - host.getBoundingClientRect().top - before.pixelOffset;
        });
      }
    }
    const capture = () => {
      const items = virtual.getVirtualItems();
      const item = items.find(item => item.end > host.scrollTop);
      const node = [...(element.current?.querySelectorAll('[data-history-group]') ?? [])].find(node => node.dataset.historyGroup === item?.key);
      previous.current = { key: groups[0]?.id, anchor: item?.key, offset: host.scrollTop - (item?.start ?? 0),
        pixelOffset: node ? node.getBoundingClientRect().top - host.getBoundingClientRect().top : undefined };
      history?.setAnchor(following.current ? undefined : groups[item?.index]?.seq);
      const group = groups[item?.index];
      if (group) reading?.remember(sessionKey, target, { seq: group.seq, group: group.id, offset: previous.current.offset });
    };
    capture(); host.addEventListener('scroll', capture, { passive: true });
    return () => { cancelAnimationFrame(correction); host.removeEventListener('scroll', capture); };
  }, [groups, history, virtual, following, container]);
  return <div ref={element} className="remote-history-list" data-history-count={groups.length}
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
