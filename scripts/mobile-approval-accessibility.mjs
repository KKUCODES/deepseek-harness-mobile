import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';

// 参考检出保持只读；仅为手机打包补充读屏说明，保留原审批组件与决定逻辑。
export function mobileApprovalAccessibility() {
  return {
    name: 'mobile-approval-accessibility',
    setup(builder) {
      builder.onLoad({ filter: /ui-approval[\\/]src[\\/]client[\\/]ApprovalPanel\.tsx$/ }, async ({ path }) => {
        let contents = await readFile(path, 'utf8');
        // Android TalkBack 未朗读该 group 的 aria-describedby；将理由纳入名称。
        const changes = [[
          "aria-label={t('detail.aria')}",
          "aria-label={`${t('detail.aria')}: ${pending.reason ?? t('escalation', { toolName: pending.toolName })}`}",
        ]];
        for (const [before, after] of changes) {
          // 上游升级后显式要求重新核对，避免静默漏掉修补或改到其他位置。
          if (contents.split(before).length !== 2) throw new Error(`ApprovalPanel accessibility adaptation needs review: ${before}`);
          contents = contents.replace(before, after);
        }
        return { contents, loader: 'tsx', resolveDir: dirname(path) };
      });
    },
  };
}
