/** Public owner props for the experimental DSHM Remote home API v1. */
export interface RemoteHome {
  readonly apiVersion: 1;
  readonly locale: string;
  t(text: string, values?: Record<string, unknown>): string;
  readonly view: {
    key: string; scrollTop: number; title: string; workspace: string | null; query: string; archived: boolean;
    ready: boolean; busy: boolean; connection: string;
    workspaces: ReadonlyArray<{id: string; title: string}>;
    sessions: ReadonlyArray<{id: string; title: string; running: boolean; updatedAt: number; snippet?: string}>;
    searching: boolean; searchError: string | null; hasMore: boolean;
  };
  readonly actions: {
    back(): void; menu(): void; connection(): void; workspace(id: string): void; session(id: string): void;
    query(text: string): void; retrySearch(): void; newSession(): void;
    rememberScroll(top: number): void; readScroll(): number;
  };
}
export interface HomeProps { home: RemoteHome }

/** Optional dshm.remote.connection surface; available before a desktop is connected. */
export interface RemoteConnection {
  readonly apiVersion: 1;
  readonly locale: string;
  t(text: string, values?: Record<string, unknown>): string;
  readonly view: Readonly<{
    phase: string; status: string; paired: boolean | null; unpaired: boolean; pending: boolean; waiting: boolean;
    connecting: boolean; reading: boolean; readError: boolean; busy: boolean;
    title: string; description: string; error: string | null; server: string | null; insecure: boolean;
    actionDisabled: boolean; actionLabel: string;
  }>;
  readonly actions: {
    back(): void; menu(): void; scanCamera(): void; scanImage(): void;
    primary(): void; retry(): void; retryRead(): void;
  };
  /** Place host-owned elements; do not inspect their implementation. No pairing link is in view. */
  readonly parts: { readonly fields: import('react').ReactNode; readonly identity: import('react').ReactNode; readonly diagnostics: import('react').ReactNode };
}
export interface ConnectionProps { connection: RemoteConnection }
