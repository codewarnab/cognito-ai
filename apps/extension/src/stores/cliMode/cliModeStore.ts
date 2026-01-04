import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createLogger } from '~logger';
import type { CliModeState, AgentInfo } from './types';

const log = createLogger('cliModeStore', 'CLI_MODE_STORE');

const DEFAULT_BRIDGE_URL = 'http://127.0.0.1:8787';

export const useCliModeStore = create<CliModeState>()(
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
    }),
    {
      name: 'cognito-cli-mode',
      partialize: (state) => ({
        bridgeBaseUrl: state.bridgeBaseUrl,
        bridgeToken: state.bridgeToken,
        selectedAgentName: state.selectedAgentName,
      }),
    }
  )
);

