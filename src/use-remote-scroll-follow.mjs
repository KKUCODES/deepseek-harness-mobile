import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useScrollFollow, scrollMetrics } from '@upstream/ui-chat/src/client/chat/use-scroll-follow.ts';

/** 只绑定手机滚动容器；跟随判定和定位统一交给原DSH控制器。 */
export function useRemoteScrollFollow(identity) {
  // 与原useChatReading的FOLLOW_THRESHOLD + 1一致。
  const follow = useScrollFollow(true, 25);
  const [followingTail, setFollowingTail] = useState(follow.active);
  const scroll = useRef(null), position = useRef(0), frame = useRef(null), restore = useRef(null), dispose = useRef(null);
  const publish = useCallback(() => setFollowingTail(follow.active), [follow]);
  // 虚拟列表/分页只读写同一个原控制器，不另外维护可漂移的布尔状态。
  const bottom = useMemo(() => ({
    get current() { return follow.active; },
    set current(value) { follow.setFollowing(value); publish(); },
  }), [follow, publish]);
  const followBottom = useCallback(() => {
    if (!follow.active || !scroll.current || frame.current !== null) return;
    const element = scroll.current;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      if (!follow.active || scroll.current !== element || !element.clientHeight) return;
      follow.toBottom(element, scrollMetrics(element), 'instant');
      position.current = element.scrollTop; publish();
    });
  }, [follow, publish]);
  const attachScroll = useCallback(element => {
    cancelAnimationFrame(restore.current); cancelAnimationFrame(frame.current); frame.current = null;
    dispose.current?.(); dispose.current = null;
    if (scroll.current) position.current = scroll.current.scrollTop;
    scroll.current = element;
    if (!element) return;
    const unbind = follow.bind(element);
    restore.current = requestAnimationFrame(() => {
      if (scroll.current !== element) return;
      const active = follow.active;
      follow.jump(element, scrollMetrics(element), active ? element.scrollHeight : position.current);
      follow.setFollowing(active); position.current = element.scrollTop; publish();
    });
    const observer = new ResizeObserver(followBottom);
    observer.observe(element);
    const messages = element.querySelector('.messages');
    if (messages) observer.observe(messages);
    const interrupt = event => {
      if (event.type === 'keydown' && !['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) return;
      follow.interrupt(element, scrollMetrics(element));
    };
    const settle = event => {
      if (event.target !== element) return;
      follow.settle(scrollMetrics(element)); position.current = element.scrollTop; publish();
    };
    const intents = ['wheel', 'touchstart', 'pointerdown', 'keydown', 'beforematch'];
    for (const type of intents) element.addEventListener(type, interrupt, { passive: true, capture: true });
    element.addEventListener('scrollend', settle);
    dispose.current = () => {
      observer.disconnect(); unbind(); element.removeEventListener('scrollend', settle);
      for (const type of intents) element.removeEventListener(type, interrupt, true);
    };
  }, [follow, followBottom, publish]);
  const onScroll = useCallback(event => {
    const element = event.currentTarget;
    if (event.target !== element) return;
    follow.sample(scrollMetrics(element)); position.current = element.scrollTop; publish();
  }, [follow, publish]);
  const returnToBottom = useCallback(() => {
    const element = scroll.current;
    if (!element) return;
    // 与原ChatView的returnToBottom一致：立即回到物理尾部并恢复跟随，不翻页或新建会话。
    follow.toBottom(element, scrollMetrics(element), 'instant');
    position.current = element.scrollTop; publish();
    // 虚拟组随后测出真实高度时，由同一控制器跟到更新后的物理尾部。
    followBottom();
  }, [follow, followBottom, publish]);
  useLayoutEffect(() => {
    follow.reset(); follow.setFollowing(true); position.current = 0; publish();
  }, [identity, follow, publish]);
  useLayoutEffect(() => () => {
    cancelAnimationFrame(restore.current); cancelAnimationFrame(frame.current); dispose.current?.();
  }, []);
  return { scroll, bottom, attachScroll, onScroll, followBottom, followingTail, returnToBottom };
}
