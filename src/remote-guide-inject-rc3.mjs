import { createGuidePins } from '@upstream/ui-sidebar-right/src/client/tabs/guide/guide-pins.ts';

/**
 * rc3 指南插槽的附加注入：卡片固定状态与入口操作存在性
 * @param ctx 插件上下文，用于读取指南操作插槽的注册情况
 */
export function guideInject(ctx) {
  const pins = createGuidePins();
  return {
    hooks: {
      entryPins: pins.unpinned,
      entryActions: {
        getSnapshot: () => ctx.slots.entriesOfSlot('sidebar.right.tab.guide.actions').length > 0,
        subscribe: listener => ctx.slots.subscribe('sidebar.right.tab.guide.actions', listener),
      },
    },
    setPinned: pins.setPinned,
  };
}
