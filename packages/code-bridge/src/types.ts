import { z } from 'zod';

// Agent definition
export interface AgentDefinition {
  name: string;
  command: string;
  args: string[];
  envHints?: string[];
}

// Element context from the extension
export interface CodeModeElementContext {
  url: string;
  title?: string;
  selector?: string;
  tagName: string;
  id?: string;
  classList: string[];
  textPreview?: string;
  outerHtmlPreview?: string;
  boundingBox?: { top: number; left: number; width: number; height: number };
  computedStyle?: {
    display?: string;
    position?: string;
    zIndex?: string;
    color?: string;
    backgroundColor?: string;
    fontSize?: string;
    fontFamily?: string;
  };
  sourceHint?: {
    filePath?: string;
    line?: number;
    column?: number;
    componentName?: string;
  };
}

// Chat request from extension
export const CodeModeChatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.array(z.object({
      type: z.literal('text'),
      text: z.string(),
    })),
  })),
  elementContext: z.any().optional(),
  agent: z.object({
    name: z.string(),
    command: z.string(),
    args: z.array(z.string()),
    acpMode: z.string().optional(),
    acpModel: z.string().optional(),
  }),
  sessionId: z.string().optional(),
});

export type CodeModeChatRequest = z.infer<typeof CodeModeChatRequestSchema>;

// Patch proposal
export interface PatchProposal {
  id: string;
  unifiedDiff: string;
  summary?: string;
}

// Stored patch with metadata
export interface StoredPatch {
  patchId: string;
  unifiedDiff: string;
  summary?: string;
  createdAt: number;
  tokenHash: string;
}

// Stored token
export interface StoredToken {
  tokenHash: string;
  createdAt: number;
  lastUsedAt?: number;
}

// Pairing code
export interface PairingCode {
  code: string;
  expiresAt: number;
}

// Server config
export interface ServerConfig {
  host: string;
  port: number;
  cwd: string;
}
