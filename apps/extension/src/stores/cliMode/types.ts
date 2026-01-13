export type BridgeStatus = 'connected' | 'connecting' | 'offline';

export interface AgentInfo {
  name: string;
  command: string;
  args: string[];
  available: boolean;
  envHints?: string[];
}

export interface CliModeState {
  // Bridge connection state
  bridgeBaseUrl: string;
  bridgeToken: string | null;
  bridgeStatus: BridgeStatus;
  isCheckingBridge: boolean;
  repoCwd: string | null;  // Working directory from bridge for editor links

  // Provider selection (decoupled from ToolsMode)
  // When true, chat requests are routed to the local CLI bridge provider.
  isCliProviderSelected: boolean;

  /**
   * Snapshot of the last cloud (non-CLI) model selection.
   * Used to restore the user's prior selection if they cancel out of CLI provider mode.
   * Not persisted.
   */
  previousCloudModelConfig: {
    remoteModel: string;
    remoteProvider?: string;
  } | null;

  // Agent selection
  selectedAgentName: string;
  availableAgents: AgentInfo[];

  // Agent status (for loading indicator)
  agentStatus: string | null;

  // Actions - Bridge
  setBridgeBaseUrl: (url: string) => void;
  setBridgeToken: (token: string | null) => void;
  setBridgeStatus: (status: BridgeStatus) => void;
  checkBridgeHealth: () => Promise<void>;
  fetchAvailableAgents: () => Promise<void>;

  // Actions - Provider selection
  setIsCliProviderSelected: (selected: boolean) => void;
  setPreviousCloudModelConfig: (
    config: { remoteModel: string; remoteProvider?: string } | null
  ) => void;

  // Actions - Agent
  setSelectedAgentName: (name: string) => void;
  setAgentStatus: (status: string | null) => void;
}
