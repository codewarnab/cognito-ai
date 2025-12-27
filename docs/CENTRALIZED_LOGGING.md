# Centralized Logging Implementation Plan

The goal is to stream logs from the Chrome Extension to the Webapp (`/dev/logger`) for better filtering, searching, and visualization.

## Architecture

We will implement a streaming architecture using Chrome's `runtime.connect` API, allowing the webapp to "subscribe" to extension logs.

### 1. Unified Log Entry Type (`packages/shared`)
Define a standard `LogEntry` structure to be used by both Extension (producer) and Webapp (consumer).
```typescript
interface LogEntry {
  id: string;
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  category?: LogCategory;
  message: unknown;
  args: unknown[];
  prefix?: string;
}
```

### 2. Extension Side (`apps/extension`)
- **Buffering**: Enhance `apps/extension/src/logger.ts` to maintain a circular buffer (e.g., last 1000 logs) in memory.
- **Broadcasting**:
  - Implement a `LogBroadcaster` that listens for `chrome.runtime.onConnectExternal`.
  - When the webapp connects (port name `logger`), immediately send the buffered history.
  - Subscribe the new port to receive live log events.
  - Modify `createLogger` to push logs to the `LogBroadcaster` in addition to `console`.

### 3. Webapp Side (`apps/webapp`)
- **Connection Hook**: Create `useLogStream` hook that:
  - Connects to the extension via `chrome.runtime.connect`.
  - Listens for `onMessage` to receive `LogEntry` objects.
  - Manages the local state of logs (appending new ones).
- **Log Viewer Component**: Create `src/components/settings/logger/LogViewer.tsx` featuring:
  - **Virtualization**: Use `react-virtuoso` or similar handling for performance with large log lists.
  - **Filtering**: Filter by Level (Info/Error/etc.) and Category.
  - **Search**: Full-text search of messages and arguments.
  - **Auto-scroll**: "Tail" mode to follow new logs.
- **Integration**: Update `src/app/dev/logger/page.tsx` to include the `LogViewer` below the existing `LoggerPanel`.

### 4. Configuration
- Ensure `apps/webapp` runs on a port allowed by `externally_connectable` in `wxt.config.ts`.
- Current config matches `localhost:3002`.

## Proposed Changes

### Shared Package
#### [MODIFY] [packages/shared/src/types/logger.ts](file:///c:/Users/User/code/hackathons/chrome-ai/packages/shared/src/types/logger.ts)
- Add `LogEntry` interface export.

### Extension
#### [MODIFY] [apps/extension/src/logger.ts](file:///c:/Users/User/code/hackathons/chrome-ai/apps/extension/src/logger.ts)
- Implement circular buffer `LogHistory`.
- Add `addLogListener` and broadcasting logic.
- Integrate with `runtime.onConnectExternal`.

### Webapp
#### [NEW] [apps/webapp/src/hooks/useLogStream.ts](file:///c:/Users/User/code/hackathons/chrome-ai/apps/webapp/src/hooks/useLogStream.ts)
- Hook to handle extension connection and state.

#### [NEW] [apps/webapp/src/components/settings/logger/LogViewer.tsx](file:///c:/Users/User/code/hackathons/chrome-ai/apps/webapp/src/components/settings/logger/LogViewer.tsx)
- UI for viewing logs.

#### [MODIFY] [apps/webapp/src/app/dev/logger/page.tsx](file:///c:/Users/User/code/hackathons/chrome-ai/apps/webapp/src/app/dev/logger/page.tsx)
- Embed `LogViewer`.

## Verification Plan

### Automated Tests
- Unit test `LogHistory` buffer logic.
- Unit test `LogBroadcaster` subscription/unsubscription.

### Manual Verification
1. Open Extension and perform actions to generate logs.
2. Open Webapp at `/dev/logger`.
3. Verify previously generated logs appear (history).
4. Perform more actions in Extension.
5. Verify new logs appear in real-time in Webapp.
6. Test filters and search in Webapp UI.
