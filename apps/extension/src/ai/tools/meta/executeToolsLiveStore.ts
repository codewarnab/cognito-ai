import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { createLogger } from '~logger';
import type { TrackedToolCall } from './types';

const log = createLogger('ExecuteToolsLiveStore', 'TOOLS_EXECUTION');

interface ExecuteToolsLiveState {
  /**
   * The currently active sandbox request id (SandboxBridge internal request id).
   * We use this to avoid stale updates if multiple executions overlap.
   */
  activeRequestId: string | null;
  /** Live tool calls for the active sandbox execution */
  toolCalls: TrackedToolCall[];

  /** Start tracking a new sandbox execution */
  startExecution: (requestId: string) => void;
  /** Update tool calls for the active sandbox execution */
  updateToolCalls: (requestId: string, toolCalls: TrackedToolCall[]) => void;
  /** Clear all live tracking state */
  clear: () => void;
}

export const useExecuteToolsLiveStore = create<ExecuteToolsLiveState>()(
  subscribeWithSelector((set, get) => ({
    activeRequestId: null,
    toolCalls: [],

    startExecution: (requestId) => {
      log.debug('Starting executeTools live tracking', { requestId });
      set({ activeRequestId: requestId, toolCalls: [] });
    },

    updateToolCalls: (requestId, toolCalls) => {
      // Only update if this is the currently active execution
      if (get().activeRequestId !== requestId) return;
      // Clone the array to trigger React updates (tool call objects may be mutated)
      set({ toolCalls: [...toolCalls] });
    },

    clear: () => set({ activeRequestId: null, toolCalls: [] }),
  }))
);

