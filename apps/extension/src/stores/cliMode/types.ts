export type BridgeStatus = 'connected' | 'needs-pairing' | 'offline';

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
  pairWithBridge: (code: string) => Promise<boolean>;
  fetchAvailableAgents: () => Promise<void>;

  // Actions - Agent
  setSelectedAgentName: (name: string) => void;
  setAgentStatus: (status: string | null) => void;
}
