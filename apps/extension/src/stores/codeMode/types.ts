import type { CodeModeElementContext } from '@cognito/shared/types';

export type BridgeStatus = 'connected' | 'needs-pairing' | 'offline';

export type PatchStatus = 'pending' | 'applying' | 'applied' | 'rejected' | 'error';

export interface PatchState {
  patchId: string;
  unifiedDiff: string;
  summary?: string;
  status: PatchStatus;
  error?: string;
  filesChanged?: string[];
  createdAt: number;
}

export interface AgentInfo {
  name: string;
  command: string;
  args: string[];
  available: boolean;
  envHints?: string[];
}

export interface CodeModeState {
  // Element picker state
  elementContext: CodeModeElementContext | null;
  isPicking: boolean;

  // Bridge connection state
  bridgeBaseUrl: string;
  bridgeToken: string | null;
  bridgeStatus: BridgeStatus;
  isCheckingBridge: boolean;
  repoCwd: string | null;  // Working directory from bridge for editor links

  // Agent selection
  selectedAgentName: string;
  availableAgents: AgentInfo[];

  // Patch tracking
  patches: Record<string, PatchState>;

  // Actions - Element picker
  setElementContext: (ctx: CodeModeElementContext | null) => void;
  clearElementContext: () => void;
  startPicker: () => Promise<void>;

  // Actions - Bridge
  setBridgeBaseUrl: (url: string) => void;
  setBridgeToken: (token: string | null) => void;
  setBridgeStatus: (status: BridgeStatus) => void;
  checkBridgeHealth: () => Promise<void>;
  pairWithBridge: (code: string) => Promise<boolean>;
  fetchAvailableAgents: () => Promise<void>;

  // Actions - Agent
  setSelectedAgentName: (name: string) => void;

  // Actions - Patches
  addPatch: (patch: Omit<PatchState, 'status' | 'createdAt'>) => void;
  setPatchStatus: (patchId: string, status: PatchStatus, error?: string, filesChanged?: string[]) => void;
  clearPatches: () => void;
  applyPatch: (patchId: string) => Promise<boolean>;
  rejectPatch: (patchId: string) => void;
}

