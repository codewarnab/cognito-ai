import { z } from 'zod';

// Agent definition
export interface AgentDefinition {
  name: string;
  command: string;
  args: string[];
  envHints?: string[];
  /** AI SDK provider to use instead of ACP. Enables native tool calling. */
  aiSdkProvider?: 'gemini-cli' | 'codex-cli' | 'claude-code';
  /** Indicates if this agent supports custom extension tools. */
  supportsCustomTools?: boolean;
}

// Content part types for multimodal messages
export const TextContentPartSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
});

export const ImageContentPartSchema = z.object({
  type: z.literal('image'),
  data: z.string(),      // Base64-encoded image data
  mimeType: z.string(),  // e.g., "image/png", "image/jpeg"
});

export const AudioContentPartSchema = z.object({
  type: z.literal('audio'),
  data: z.string(),      // Base64-encoded audio data
  mimeType: z.string(),  // e.g., "audio/mp3", "audio/wav"
});

export const ResourceContentPartSchema = z.object({
  type: z.literal('resource'),
  data: z.string(),      // Base64-encoded file data
  mimeType: z.string(),  // e.g., "application/pdf"
  name: z.string(),      // Original filename
});

export const ContentPartSchema = z.discriminatedUnion('type', [
  TextContentPartSchema,
  ImageContentPartSchema,
  AudioContentPartSchema,
  ResourceContentPartSchema,
]);

export type ContentPart = z.infer<typeof ContentPartSchema>;
export type TextContentPart = z.infer<typeof TextContentPartSchema>;
export type ImageContentPart = z.infer<typeof ImageContentPartSchema>;
export type AudioContentPart = z.infer<typeof AudioContentPartSchema>;
export type ResourceContentPart = z.infer<typeof ResourceContentPartSchema>;


// Chat request from extension
export const CliChatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.array(ContentPartSchema),
  })),
  agent: z.object({
    name: z.string(),
    command: z.string(),
    args: z.array(z.string()),
    acpMode: z.string().optional(),
    acpModel: z.string().optional(),
  }),
  sessionId: z.string().optional(),
});

export type CliChatRequest = z.infer<typeof CliChatRequestSchema>;

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
