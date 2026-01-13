import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createLogger } from '~logger';
import type { CliModeState, AgentInfo } from './types';
import { registerToolsWithBridge, connectToToolEvents } from '@/services/codeBridge/toolBridgeClient';

const log = createLogger('cliModeStore', 'CLI_MODE_STORE');

const DEFAULT_BRIDGE_URL = 'http://127.0.0.1:8787';

// Keep at most one active tool-events SSE connection per sidepanel session
let toolEventsCleanup: (() => void) | null = null;

export const useCliModeStore = create<CliModeState>()(
  persist(
    (set, get) => ({
      // Initial State - Bridge
      bridgeBaseUrl: DEFAULT_BRIDGE_URL,
      bridgeToken: null,
      bridgeStatus: 'offline',
      isCheckingBridge: false,
      repoCwd: null,

      // Initial State - Provider selection
      isCliProviderSelected: false,
      previousCloudModelConfig: null,

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

          // Bridge is reachable
          set({ bridgeStatus: 'connecting', repoCwd });

          // 1) Validate existing token if present
          let activeToken: string | null = bridgeToken;
          let tokenIsValid = false;

          if (activeToken) {
            try {
              const validateResponse = await fetch(`${bridgeBaseUrl}/validate`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${activeToken}`,
                },
                signal: AbortSignal.timeout(3000),
              });

              if (validateResponse.ok) {
                const validateData = await validateResponse.json();
                tokenIsValid = !!validateData.valid;
                if (!tokenIsValid) {
                  log.warn('Bridge token invalid, clearing', { reason: validateData.reason });
                  activeToken = null;
                  set({ bridgeToken: null });
                }
              } else {
                log.warn('Bridge token validation failed');
                activeToken = null;
                set({ bridgeToken: null });
              }
            } catch (validateError) {
              log.warn('Bridge token validation error', validateError);
              activeToken = null;
              set({ bridgeToken: null });
            }
          }

          // 2) If no valid token, auto-connect to get one
          if (!tokenIsValid) {
            try {
              const connectResponse = await fetch(`${bridgeBaseUrl}/connect`, {
                method: 'POST',
                signal: AbortSignal.timeout(3000),
              });

              if (!connectResponse.ok) {
                const errorText = await connectResponse.text().catch(() => '');
                log.warn('Bridge auto-connect failed', { status: connectResponse.status, errorText });
                set({ bridgeStatus: 'connecting', repoCwd });
                return;
              }

              const connectData = await connectResponse.json().catch(() => ({}));
              if (!connectData.token || typeof connectData.token !== 'string') {
                log.warn('Bridge auto-connect missing token');
                set({ bridgeStatus: 'connecting', repoCwd });
                return;
              }

              activeToken = connectData.token;
              set({ bridgeToken: activeToken });
              log.info('Bridge auto-connect successful');
            } catch (connectError) {
              log.warn('Bridge auto-connect request failed', connectError);
              set({ bridgeStatus: 'connecting', repoCwd });
              return;
            }
          }

          if (!activeToken) {
            set({ bridgeStatus: 'connecting', repoCwd });
            return;
          }

          // Connected (token is present + valid or freshly issued)
          set({ bridgeStatus: 'connected', repoCwd });

          // Fetch available agents for provider selection UI
          get().fetchAvailableAgents();

          // (Re)register tools
          registerToolsWithBridge(bridgeBaseUrl, activeToken).then(result => {
            if (result.success) {
              log.info(`Registered ${result.count} tools with bridge`);
            } else {
              log.warn('Failed to register tools with bridge:', result.error);
            }
          });

          // (Re)connect to tool events SSE (ensure only one connection)
          if (toolEventsCleanup) {
            toolEventsCleanup();
            toolEventsCleanup = null;
          }
          toolEventsCleanup = connectToToolEvents(bridgeBaseUrl, activeToken, {
            onConnected: () => log.info('Connected to tool events SSE'),
            onDisconnected: () => log.info('Disconnected from tool events SSE'),
            onError: (err) => log.warn('Tool events SSE error:', err),
          });
        } catch (error) {
          log.warn('Bridge health check failed', error);
          set({ bridgeStatus: 'offline' });
        } finally {
          set({ isCheckingBridge: false });
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

      // Actions - Provider selection
      setIsCliProviderSelected: (selected) => {
        set({ isCliProviderSelected: selected });
        log.info('CLI provider selection changed', { selected });
      },
      setPreviousCloudModelConfig: (config) => {
        set({ previousCloudModelConfig: config });
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
        isCliProviderSelected: state.isCliProviderSelected,
        selectedAgentName: state.selectedAgentName,
      }),
    }
  )
);

