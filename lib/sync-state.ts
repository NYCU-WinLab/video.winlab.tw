// instrumentation.ts and route handlers are bundled separately, so module
// state is not shared; keep it on globalThis.
const g = globalThis as unknown as {
  transcriptSync?: {
    started: boolean;
    running: boolean;
    lastSyncAt: number | null;
  };
};

export const syncState = (g.transcriptSync ??= {
  started: false,
  running: false,
  lastSyncAt: null,
});

export function lastSyncAt() {
  return syncState.lastSyncAt;
}
