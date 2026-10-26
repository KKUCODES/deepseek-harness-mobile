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
