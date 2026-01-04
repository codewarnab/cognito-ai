import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createLogger } from '~logger';
import type { CodeModeState, AgentInfo, PatchState } from './types';
import { applyPatch as applyPatchToServer } from '@/services/codeBridge';

const log = createLogger('codeModeStore', 'CODE_MODE_STORE');

const DEFAULT_BRIDGE_URL = 'http://127.0.0.1:8787';

export const useCodeModeStore = create<CodeModeState>()(
  persist(
    (set, get) => ({
      // Initial State - Bridge
      bridgeBaseUrl: DEFAULT_BRIDGE_URL,
      bridgeToken: null,
      bridgeStatus: 'offline',
      isCheckingBridge: false,
      repoCwd: null,

      // Initial State - Agent
      selectedAgentName: 'Gemini CLI',
      availableAgents: [],

      // Initial State - Patches
      patches: {},

      // Initial State - Agent status (for loading indicator)
      agentStatus: null,

      // Actions - Bridge
      setBridgeBaseUrl: (url) => {
        set({ bridgeBaseUrl: url });
        log.info('Bridge URL set', { url });
      },

      setBridgeToken: (token) => {
        set({ bridgeToken: token });
        log.info('Bridge token updated', { hasToken: !!token });
      },

      setBridgeStatus: (status) => {
        set({ bridgeStatus: status });
        log.info('Bridge status changed', { status });
      },

      checkBridgeHealth: async () => {
        const { bridgeBaseUrl, bridgeToken } = get();
        set({ isCheckingBridge: true });

        try {
          const response = await fetch(`${bridgeBaseUrl}/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(3000),
          });

          if (!response.ok) {
            set({ bridgeStatus: 'offline', repoCwd: null });
            return;
          }

          // Parse response to get cwd for editor links
          const data = await response.json().catch(() => ({}));
          const repoCwd = data.cwd || null;

          // Bridge is reachable - now validate token if we have one
          if (bridgeToken) {
            // Validate the token with the bridge
            try {
              const validateResponse = await fetch(`${bridgeBaseUrl}/validate`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${bridgeToken}`,
                },
                signal: AbortSignal.timeout(3000),
              });

              if (validateResponse.ok) {
                const validateData = await validateResponse.json();
                if (validateData.valid) {
                  set({ bridgeStatus: 'connected', repoCwd });
                } else {
                  // Token is invalid - clear it and require re-pairing
                  log.warn('Bridge token invalid, clearing', { reason: validateData.reason });
                  set({ bridgeToken: null, bridgeStatus: 'needs-pairing', repoCwd });
                }
              } else {
                // Validation endpoint error - assume token is invalid
                log.warn('Bridge token validation failed');
                set({ bridgeToken: null, bridgeStatus: 'needs-pairing', repoCwd });
              }
            } catch (validateError) {
              // If validation fails but health passed, token might still be valid
              // Be conservative and mark as needs-pairing
              log.warn('Bridge token validation error', validateError);
              set({ bridgeToken: null, bridgeStatus: 'needs-pairing', repoCwd });
            }
          } else {
            set({ bridgeStatus: 'needs-pairing', repoCwd });
          }
        } catch (error) {
          log.warn('Bridge health check failed', error);
          set({ bridgeStatus: 'offline' });
        } finally {
          set({ isCheckingBridge: false });
        }
      },

      pairWithBridge: async (code) => {
        const { bridgeBaseUrl } = get();
        log.info('Attempting to pair with bridge', { code });

        try {
          const response = await fetch(`${bridgeBaseUrl}/pair/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
          });

          if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            log.error('Pairing failed', new Error(error.error));
            return false;
          }

          const data = await response.json();
          if (data.token) {
            set({ bridgeToken: data.token, bridgeStatus: 'connected' });
            log.info('Pairing successful');
            return true;
          }

          return false;
        } catch (error) {
          log.error('Pairing request failed', error);
          return false;
        }
      },

      fetchAvailableAgents: async () => {
        const { bridgeBaseUrl } = get();

        try {
          const response = await fetch(`${bridgeBaseUrl}/agents`, {
            method: 'GET',
            signal: AbortSignal.timeout(3000),
          });

          if (!response.ok) {
            log.warn('Failed to fetch agents');
            return;
          }

          const data = await response.json();
          if (data.agents && Array.isArray(data.agents)) {
            set({ availableAgents: data.agents as AgentInfo[] });
            log.info('Fetched available agents', { count: data.agents.length });
          }
        } catch (error) {
          log.warn('Failed to fetch agents', error);
        }
      },

      // Actions - Agent
      setSelectedAgentName: (name) => {
        set({ selectedAgentName: name });
        log.info('Selected agent changed', { name });
      },

      setAgentStatus: (status) => {
        set({ agentStatus: status });
      },

      // Actions - Patches
      addPatch: (patch) => {
        const { patches } = get();
        const newPatch: PatchState = {
          ...patch,
          status: 'pending',
          createdAt: Date.now(),
        };
        set({ patches: { ...patches, [patch.patchId]: newPatch } });
        log.info('Patch added', { patchId: patch.patchId, summary: patch.summary });
      },

      setPatchStatus: (patchId, status, error, filesChanged) => {
        const { patches } = get();
        const patch = patches[patchId];
        if (!patch) {
          log.warn('Patch not found', { patchId });
          return;
        }
        set({
          patches: {
            ...patches,
            [patchId]: { ...patch, status, error, filesChanged },
          },
        });
        log.info('Patch status updated', { patchId, status });
      },

      clearPatches: () => {
        set({ patches: {} });
        log.info('All patches cleared');
      },

      applyPatch: async (patchId) => {
        const { bridgeBaseUrl, bridgeToken, patches } = get();
        const patch = patches[patchId];

        if (!patch) {
          log.error('Patch not found', new Error(`Patch ${patchId} not found`));
          return false;
        }

        if (!bridgeToken) {
          log.error('Not authenticated with bridge', new Error('No bridge token'));
          return false;
        }

        // Set status to applying
        get().setPatchStatus(patchId, 'applying');

        try {
          const result = await applyPatchToServer(bridgeBaseUrl, bridgeToken, patchId);

          if (result.applied) {
            get().setPatchStatus(patchId, 'applied', undefined, result.filesChanged);
            log.info('Patch applied successfully', { patchId, filesChanged: result.filesChanged });
            return true;
          } else {
            get().setPatchStatus(patchId, 'error', result.error, result.filesChanged);
            log.error('Patch apply failed', new Error(result.error || 'Unknown error'));
            return false;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          get().setPatchStatus(patchId, 'error', errorMessage);
          log.error('Patch apply request failed', error);
          return false;
        }
      },

      rejectPatch: (patchId) => {
        get().setPatchStatus(patchId, 'rejected');
        log.info('Patch rejected', { patchId });
      },
    }),
    {
      name: 'cognito-code-mode',
      partialize: (state) => ({
        bridgeBaseUrl: state.bridgeBaseUrl,
        bridgeToken: state.bridgeToken,
        selectedAgentName: state.selectedAgentName,
        patches: state.patches,
      }),
    }
  )
);

