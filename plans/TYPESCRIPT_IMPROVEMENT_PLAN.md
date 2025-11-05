# TypeScript Improvement Plan - Multi-Phase Strategy

## Executive Summary

This plan outlines a comprehensive, multi-phase approach to significantly improve the TypeScript type system in the Chrome AI extension project. The goal is to increase type safety, improve developer experience, reduce runtime errors, and establish better code maintainability.

**Current State Analysis:**
- ✅ Good: Existing error type system (`errorTypes.ts`)
- ✅ Good: Some types separated (`types/sidepanel.ts`, `types/assets.d.ts`)
- ⚠️ Issues: Heavy use of `any` types (30+ occurrences)
- ⚠️ Issues: Extensive `@ts-ignore` comments (20+ occurrences)
- ⚠️ Issues: Inline type definitions scattered across components
- ⚠️ Issues: Missing type definitions for Chrome AI APIs
- ⚠️ Issues: Inconsistent type organization

**Estimated Timeline:** 4-6 weeks (can be done incrementally)

---

## Phase 1: Foundation & Type Infrastructure (Week 1)

### 1.1 Create Centralized Type Directory Structure

**Goal:** Establish a well-organized type system that scales with the project.

**Actions:**
```
src/types/
├── index.ts                    # Central export point
├── assets.d.ts                 # Already exists
├── sidepanel.ts               # Already exists
├── chrome/                    # Chrome API types
│   ├── index.ts
│   ├── ai.d.ts               # Chrome AI built-in types
│   ├── tabs.d.ts             # Enhanced tab types
│   └── storage.d.ts          # Storage types
├── ai/                        # AI-related types
│   ├── index.ts
│   ├── models.ts             # Model configurations
│   ├── messages.ts           # Chat message types
│   ├── tools.ts              # Tool system types
│   └── streaming.ts          # Streaming response types
├── components/                # Component prop types
│   ├── index.ts
│   ├── chat.ts
│   ├── voice.ts
│   └── ui.ts
├── database/                  # Database types
│   ├── index.ts
│   ├── schema.ts
│   └── queries.ts
├── mcp/                       # MCP types (keep existing)
│   └── index.ts
├── memory/                    # Memory system types
│   └── index.ts
├── workflows/                 # Workflow types
│   └── index.ts
├── utils/                     # Utility types
│   ├── index.ts
│   ├── helpers.ts            # Generic helper types
│   └── branded.ts            # Branded/nominal types
└── global.d.ts               # Global type augmentations
```

**Priority:** HIGH
**Estimated Time:** 2-3 days

### 1.2 Define Chrome AI Built-in Types

**Goal:** Replace all `@ts-ignore` for Chrome AI APIs with proper type definitions.

**Create:** `src/types/chrome/ai.d.ts`

```typescript
/**
 * Type definitions for Chrome's Built-in AI APIs
 * Based on: https://github.com/explainers-by-googlers/prompt-api
 */

declare global {
  interface Window {
    ai?: {
      languageModel?: {
        capabilities(): Promise<AILanguageModelCapabilities>;
        create(options?: AILanguageModelCreateOptions): Promise<AILanguageModel>;
      };
      summarizer?: {
        capabilities(): Promise<AISummarizerCapabilities>;
        create(options?: AISummarizerCreateOptions): Promise<AISummarizer>;
      };
      translator?: {
        capabilities(): Promise<AITranslatorCapabilities>;
        create(options?: AITranslatorCreateOptions): Promise<AITranslator>;
      };
      writer?: {
        capabilities(): Promise<AIWriterCapabilities>;
        create(options?: AIWriterCreateOptions): Promise<AIWriter>;
      };
      rewriter?: {
        capabilities(): Promise<AIRewriterCapabilities>;
        create(options?: AIRewriterCreateOptions): Promise<AIRewriter>;
      };
    };
  }

  interface AILanguageModelCapabilities {
    available: 'readily' | 'after-download' | 'no';
    defaultTemperature?: number;
    defaultTopK?: number;
    maxTopK?: number;
  }

  interface AILanguageModelCreateOptions {
    temperature?: number;
    topK?: number;
    systemPrompt?: string;
    initialPrompts?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    monitor?: (progress: AIModelDownloadProgress) => void;
  }

  interface AIModelDownloadProgress {
    loaded: number;
    total: number;
  }

  interface AILanguageModel {
    prompt(input: string, options?: AILanguageModelPromptOptions): Promise<string>;
    promptStreaming(input: string, options?: AILanguageModelPromptOptions): ReadableStream<string>;
    countPromptTokens(input: string): Promise<number>;
    maxTokens: number;
    tokensSoFar: number;
    tokensLeft: number;
    destroy(): void;
    clone(): Promise<AILanguageModel>;
  }

  interface AILanguageModelPromptOptions {
    signal?: AbortSignal;
  }

  // Summarizer types
  interface AISummarizerCapabilities {
    available: 'readily' | 'after-download' | 'no';
    languageAvailable(languageTag: string): Promise<'readily' | 'after-download' | 'no'>;
  }

  interface AISummarizerCreateOptions {
    type?: 'tl;dr' | 'key-points' | 'teaser' | 'headline';
    format?: 'plain-text' | 'markdown';
    length?: 'short' | 'medium' | 'long';
    sharedContext?: string;
    monitor?: (progress: AIModelDownloadProgress) => void;
    signal?: AbortSignal;
  }

  interface AISummarizer {
    summarize(text: string, options?: { context?: string; signal?: AbortSignal }): Promise<string>;
    summarizeStreaming(text: string, options?: { context?: string; signal?: AbortSignal }): ReadableStream<string>;
    destroy(): void;
  }

  // ... (other AI API types)
}

export {};
```

**Priority:** HIGH
**Estimated Time:** 1 day

### 1.3 Create Utility Type Library

**Create:** `src/types/utils/helpers.ts`

```typescript
/**
 * Utility types for common patterns
 */

// Make specific properties optional
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Make specific properties required
export type Required<T, K extends keyof T> = T & { [P in K]-?: T[P] };

// Deep partial
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Prettify complex types for better IntelliSense
export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

// Extract promise type
export type Awaited<T> = T extends Promise<infer U> ? U : T;

// Function type helpers
export type AsyncFunction<Args extends any[] = any[], Return = any> = (
  ...args: Args
) => Promise<Return>;

export type SyncFunction<Args extends any[] = any[], Return = any> = (
  ...args: Args
) => Return;

// Array element type
export type ArrayElement<T> = T extends (infer U)[] ? U : never;

// Object value types
export type ValueOf<T> = T[keyof T];

// Non-nullable
export type NonNullable<T> = Exclude<T, null | undefined>;

// JSON types
export type JSONValue = 
  | string 
  | number 
  | boolean 
  | null 
  | JSONValue[] 
  | { [key: string]: JSONValue };

export type JSONObject = { [key: string]: JSONValue };
export type JSONArray = JSONValue[];

// Branded/Nominal types helper
export type Brand<T, B> = T & { __brand: B };

// Mutable (remove readonly)
export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

// At least one property required
export type AtLeastOne<T, Keys extends keyof T = keyof T> = 
  Pick<T, Exclude<keyof T, Keys>> & 
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

// Exactly one property required
export type ExactlyOne<T, Keys extends keyof T = keyof T> = 
  Pick<T, Exclude<keyof T, Keys>> & 
  {
    [K in Keys]: Required<Pick<T, K>> & Partial<Record<Exclude<Keys, K>, never>>;
  }[Keys];
```

**Priority:** MEDIUM
**Estimated Time:** 0.5 day

---

## Phase 2: Database & Core Types (Week 2)

### 2.1 Improve Database Types

**Goal:** Remove `any` types from database layer and improve type safety.

**Create:** `src/types/database/schema.ts`

```typescript
/**
 * Strongly typed database schema
 */

import type { AppUsage } from '../ai/usage';
import type { UIMessage } from 'ai';

export interface SettingRecord<T = unknown> {
  key: string;
  value: T;
}

// Settings type map for type-safe get/set
export interface SettingsTypeMap {
  paused: boolean;
  lastActiveThreadId: string;
  browserSessionId: string;
  theme: 'light' | 'dark' | 'system';
  // Add more typed settings here
}

export type SettingKey = keyof SettingsTypeMap;

export interface ChatThread {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  initialPageContext?: string;
  lastUsage?: AppUsage;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  message: UIMessage; // Properly typed instead of 'any'
  timestamp: number;
  sequenceNumber?: number;
  usage?: AppUsage;
}

export interface DBStats {
  chatMessageCount: number;
  settingsCount: number;
  threadCount: number;
}
```

**Create:** `src/types/database/queries.ts`

```typescript
/**
 * Type-safe query builders and result types
 */

import type { ChatMessage, ChatThread, SettingsTypeMap } from './schema';

// Type-safe setting getter/setter
export type GetSetting = <K extends keyof SettingsTypeMap>(
  key: K
) => Promise<SettingsTypeMap[K] | undefined>;

export type SetSetting = <K extends keyof SettingsTypeMap>(
  key: K,
  value: SettingsTypeMap[K]
) => Promise<void>;

// Query result types
export interface ThreadWithMessageCount extends ChatThread {
  messageCount: number;
}

export interface ThreadQueryOptions {
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}
```

**Update:** `src/db/index.ts` to use new types

**Priority:** HIGH
**Estimated Time:** 2 days

### 2.2 AI Message & Tool Types

**Create:** `src/types/ai/messages.ts`

```typescript
/**
 * Enhanced message types for AI chat
 */

import type { UIMessage, ToolInvocation } from 'ai';
import type { AppUsage } from './usage';

// Message part types (extend AI SDK)
export type MessagePartType = 
  | 'text'
  | 'image'
  | 'file'
  | 'tool-call'
  | 'tool-result';

export interface TextPart {
  type: 'text';
  text: string;
}

export interface ImagePart {
  type: 'image';
  image: string | Blob | ArrayBuffer;
  mimeType?: string;
}

export interface FilePart {
  type: 'file';
  data: string;
  mimeType: string;
  filename?: string;
}

export interface ToolCallPart {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface ToolResultPart {
  type: 'tool-result';
  toolCallId: string;
  toolName: string;
  result: unknown;
  isError?: boolean;
}

export type MessagePart = 
  | TextPart 
  | ImagePart 
  | FilePart 
  | ToolCallPart 
  | ToolResultPart;

// Enhanced message type
export interface EnhancedUIMessage extends UIMessage {
  parts: MessagePart[];
  usage?: AppUsage;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  modelId?: string;
  temperature?: number;
  tokensUsed?: number;
  processingTime?: number;
  [key: string]: unknown;
}
```

**Create:** `src/types/ai/tools.ts`

```typescript
/**
 * Tool system types
 */

import type { z } from 'zod';

export interface ToolDefinition<
  TName extends string = string,
  TParams extends z.ZodType = z.ZodType,
  TResult = unknown
> {
  name: TName;
  description: string;
  parameters: TParams;
  execute: (args: z.infer<TParams>) => Promise<TResult> | TResult;
  category?: ToolCategory;
  requiresPermission?: string[];
  experimental?: boolean;
}

export type ToolCategory = 
  | 'browser'
  | 'tabs'
  | 'search'
  | 'memory'
  | 'interaction'
  | 'mcp'
  | 'agent'
  | 'utility';

export interface ToolExecutionContext {
  abortSignal?: AbortSignal;
  userId?: string;
  threadId?: string;
  messageId?: string;
}

export interface ToolExecutionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: ToolExecutionError;
  metadata?: {
    executionTime?: number;
    retryCount?: number;
    [key: string]: unknown;
  };
}

export interface ToolExecutionError {
  code: string;
  message: string;
  details?: unknown;
  retryable?: boolean;
}

// Tool registry types
export type ToolRegistry = Map<string, ToolDefinition>;

export interface ToolCapabilities {
  extensionTools: boolean;
  mcpTools: boolean;
  agentTools: boolean;
  interactionTools: boolean;
}
```

**Priority:** HIGH
**Estimated Time:** 2 days

### 2.3 Component Prop Types

**Create:** `src/types/components/chat.ts`

```typescript
/**
 * Chat component prop types
 */

import type { EnhancedUIMessage } from '../ai/messages';
import type { FileAttachmentData } from '../files';

export type ChatMode = 'text' | 'voice';

export interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  attachments: FileAttachmentData[];
  onAttachmentsChange: (attachments: FileAttachmentData[]) => void;
  maxLength?: number;
}

export interface ChatMessageProps {
  message: EnhancedUIMessage;
  isLast?: boolean;
  isStreaming?: boolean;
  onCopy?: (content: string) => void;
  onRetry?: (messageId: string) => void;
  onEdit?: (messageId: string, newContent: string) => void;
}

export interface ChatContainerProps {
  messages: EnhancedUIMessage[];
  isLoading: boolean;
  onSendMessage: (content: string) => void;
  onClearHistory?: () => void;
}

export interface TabContext {
  url?: string;
  title?: string;
  favicon?: string;
  tabId?: number;
}

export interface ContextWarningState {
  percent: number;
  isNearLimit: boolean;
  tokensUsed: number;
  tokensLimit: number;
}
```

**Create:** `src/types/components/voice.ts`

```typescript
/**
 * Voice component types
 */

export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

export interface VoiceInputProps {
  onTranscript: (transcript: string) => void;
  onStart?: () => void;
  onStop?: () => void;
  onError?: (error: Error) => void;
  isActive: boolean;
  disabled?: boolean;
}

export interface VoiceRecordingState {
  isRecording: boolean;
  duration: number;
  audioLevel: number;
}

export interface VoiceVisualizationProps {
  audioLevel: number;
  isActive: boolean;
  state: VoiceState;
}
```

**Priority:** MEDIUM
**Estimated Time:** 1.5 days

---

## Phase 3: Remove `any` Types (Week 3)

### 3.1 Audit and Replace `any` Types

**Goal:** Replace all `any` types with proper type definitions or `unknown` where appropriate.

**Strategy:**
1. Search for all `any` occurrences
2. Categorize by context (MCP, tools, utils, etc.)
3. Replace with proper types or `unknown`
4. Add type guards where needed

**Priority Areas:**

1. **MCP Types** (already mostly typed, just need refinement)
   - `params?: any` → `params?: Record<string, JSONValue>`
   - `result?: any` → Use generic types

2. **Database Types** (covered in Phase 2)

3. **Utility Functions**
   ```typescript
   // Before
   catch (error: any) { }
   
   // After
   catch (error: unknown) {
     if (error instanceof Error) {
       // Handle Error
     } else if (typeof error === 'string') {
       // Handle string
     }
   }
   ```

4. **Event Handlers**
   ```typescript
   // Before
   const progressListener = (msg: any) => { }
   
   // After
   interface ProgressMessage {
     type: string;
     payload: {
       requestId: string;
       progress: number;
     };
   }
   const progressListener = (msg: ProgressMessage) => { }
   ```

**Create:** `src/types/utils/typeGuards.ts`

```typescript
/**
 * Type guard utilities
 */

import type { JSONValue } from './helpers';

export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isArray<T = unknown>(value: unknown): value is T[] {
  return Array.isArray(value);
}

export function isJSONValue(value: unknown): value is JSONValue {
  if (value === null) return true;
  if (typeof value === 'string') return true;
  if (typeof value === 'number') return true;
  if (typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.every(isJSONValue);
  if (typeof value === 'object') {
    return Object.values(value).every(isJSONValue);
  }
  return false;
}

export function hasProperty<K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return isObject(obj) && key in obj;
}

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}
```

**Priority:** HIGH
**Estimated Time:** 3 days

### 3.2 Create Type-Safe Event System

**Create:** `src/types/events/index.ts`

```typescript
/**
 * Type-safe event system for extension messaging
 */

import type { ModelDownloadProgress } from '../ai/models';
import type { McpMessage } from '../mcp';

// Event type map
export interface EventMap {
  'MODEL_DOWNLOAD_PROGRESS': ModelDownloadProgress;
  'MODEL_DOWNLOAD_COMPLETE': { modelId: string };
  'MODEL_DOWNLOAD_ERROR': { modelId: string; error: string };
  'MCP_MESSAGE': McpMessage;
  'CONVERSATION_UPDATED': { threadId: string };
  'SETTINGS_CHANGED': { key: string; value: unknown };
  // Add more events here
}

export type EventType = keyof EventMap;
export type EventPayload<T extends EventType> = EventMap[T];

// Type-safe event listener
export interface TypedEventListener<T extends EventType> {
  (payload: EventPayload<T>): void;
}

// Chrome runtime message with type safety
export interface TypedRuntimeMessage<T extends EventType = EventType> {
  type: T;
  payload: EventPayload<T>;
}

// Type-safe message sender
export function sendTypedMessage<T extends EventType>(
  type: T,
  payload: EventPayload<T>
): Promise<void> {
  return chrome.runtime.sendMessage({ type, payload });
}

// Type-safe message listener
export function addTypedMessageListener<T extends EventType>(
  type: T,
  listener: TypedEventListener<T>
): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (isTypedMessage(message) && message.type === type) {
      listener(message.payload as EventPayload<T>);
    }
  });
}

function isTypedMessage(value: unknown): value is TypedRuntimeMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    'payload' in value
  );
}
```

**Priority:** MEDIUM
**Estimated Time:** 1 day

---

## Phase 4: Remove `@ts-ignore` Comments (Week 4)

### 4.1 Eliminate Chrome AI API Ignores

**Goal:** Replace all `@ts-ignore` for Chrome AI with proper type definitions.

**Files to update:**
- `src/ai/suggestions/local.ts`
- `src/ai/planning/localPlanner.ts`
- `src/ai/models/downloader.ts`

**Strategy:**
1. Use the `ai.d.ts` created in Phase 1.1
2. Import types properly
3. Add type assertions where necessary (prefer type guards)

**Example:**
```typescript
// Before
// @ts-ignore - Chrome LanguageModel API
const capabilities = await window.ai.languageModel.capabilities();


// After
import type { AILanguageModelCapabilities } from '~/types/chrome/ai';

const capabilities: AILanguageModelCapabilities = 
  await window.ai?.languageModel?.capabilities() ?? { available: 'no' };
```

**Priority:** HIGH
**Estimated Time:** 2 days

### 4.2 Eliminate OGL Library Ignores

**Goal:** Create type definitions for OGL library or find existing ones.

**Create:** `src/types/lib/ogl.d.ts`

```typescript
/**
 * Type definitions for OGL (Open GL library)
 */

declare module 'ogl' {
  export class Renderer {
    constructor(options?: RendererOptions);
    gl: WebGLRenderingContext;
    setSize(width: number, height: number): void;
    render(options: RenderOptions): void;
  }

  export interface RendererOptions {
    canvas?: HTMLCanvasElement;
    width?: number;
    height?: number;
    alpha?: boolean;
    antialias?: boolean;
    // Add more options as needed
  }

  export interface RenderOptions {
    scene: Transform;
    camera: Camera;
  }

  export class Camera {
    constructor(gl: WebGLRenderingContext, options?: CameraOptions);
    position: Vec3;
    lookAt(target: Vec3): void;
  }

  export interface CameraOptions {
    near?: number;
    far?: number;
    fov?: number;
    aspect?: number;
  }

  // Add more OGL types as needed
  export class Transform {}
  export class Vec3 {
    constructor(x?: number, y?: number, z?: number);
  }
  export class Mesh {}
  export class Geometry {}
  export class Program {}
}
```

**Priority:** MEDIUM
**Estimated Time:** 1 day

### 4.3 Create Proper Type Assertions

**Create:** `src/types/utils/assertions.ts`

```typescript
/**
 * Type assertion utilities
 */

export function assertExists<T>(
  value: T | null | undefined,
  message?: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message || 'Value does not exist');
  }
}

export function assertIsString(
  value: unknown,
  message?: string
): asserts value is string {
  if (typeof value !== 'string') {
    throw new TypeError(message || 'Value is not a string');
  }
}

export function assertIsNumber(
  value: unknown,
  message?: string
): asserts value is number {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new TypeError(message || 'Value is not a number');
  }
}

export function assertIsArray<T = unknown>(
  value: unknown,
  message?: string
): asserts value is T[] {
  if (!Array.isArray(value)) {
    throw new TypeError(message || 'Value is not an array');
  }
}
```

**Priority:** MEDIUM
**Estimated Time:** 0.5 day

---

## Phase 5: Advanced Type Patterns (Week 5)

### 5.1 Discriminated Unions for State Management

**Create:** `src/types/ai/state.ts`

```typescript
/**
 * Type-safe state management with discriminated unions
 */

// Model state with discriminated union
export type ModelState =
  | { status: 'idle' }
  | { status: 'downloading'; progress: number }
  | { status: 'ready'; modelId: string }
  | { status: 'error'; error: Error };

// Chat state
export type ChatState =
  | { type: 'idle' }
  | { type: 'waiting-input' }
  | { type: 'processing'; messageId: string }
  | { type: 'streaming'; content: string }
  | { type: 'complete'; messageId: string }
  | { type: 'error'; error: Error; retryable: boolean };

// Connection state
export type ConnectionState =
  | { status: 'disconnected' }
  | { status: 'connecting'; attempt: number }
  | { status: 'connected'; sessionId: string; connectedAt: number }
  | { status: 'reconnecting'; lastError: Error }
  | { status: 'failed'; error: Error; canRetry: boolean };

// Type guards
export function isModelReady(state: ModelState): state is { status: 'ready'; modelId: string } {
  return state.status === 'ready';
}

export function isChatProcessing(state: ChatState): state is { type: 'processing'; messageId: string } {
  return state.type === 'processing';
}
```

**Priority:** MEDIUM
**Estimated Time:** 1 day

### 5.2 Branded Types for Domain Values

**Create:** `src/types/utils/branded.ts`

```typescript
/**
 * Branded types for domain-specific values
 * Prevents mixing up similar primitive types
 */

import type { Brand } from './helpers';

// IDs
export type ThreadId = Brand<string, 'ThreadId'>;
export type MessageId = Brand<string, 'MessageId'>;
export type UserId = Brand<string, 'UserId'>;
export type TabId = Brand<number, 'TabId'>;

// Validated values
export type EmailAddress = Brand<string, 'EmailAddress'>;
export type URL = Brand<string, 'URL'>;
export type ApiKey = Brand<string, 'ApiKey'>;

// Numeric ranges
export type Temperature = Brand<number, 'Temperature'>; // 0-1
export type Percentage = Brand<number, 'Percentage'>; // 0-100
export type TokenCount = Brand<number, 'TokenCount'>; // >= 0

// Constructors with validation
export function createThreadId(id: string): ThreadId {
  if (!id || typeof id !== 'string') {
    throw new Error('Invalid thread ID');
  }
  return id as ThreadId;
}

export function createTemperature(value: number): Temperature {
  if (value < 0 || value > 1) {
    throw new Error('Temperature must be between 0 and 1');
  }
  return value as Temperature;
}

export function createPercentage(value: number): Percentage {
  if (value < 0 || value > 100) {
    throw new Error('Percentage must be between 0 and 100');
  }
  return value as Percentage;
}

export function createURL(url: string): URL {
  try {
    new globalThis.URL(url);
    return url as URL;
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
}

export function createEmailAddress(email: string): EmailAddress {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error(`Invalid email address: ${email}`);
  }
  return email as EmailAddress;
}
```

**Priority:** LOW
**Estimated Time:** 1 day

### 5.3 Generic Tool Type System

**Create:** `src/types/ai/toolSystem.ts`

```typescript
/**
 * Advanced generic tool type system
 */

import type { z } from 'zod';

// Generic tool builder
export interface ToolBuilder<
  TName extends string = string,
  TSchema extends z.ZodType = z.ZodType,
  TReturn = unknown
> {
  name: TName;
  description: string;
  schema: TSchema;
  handler: (args: z.infer<TSchema>, context: ToolContext) => Promise<TReturn>;
}

export interface ToolContext {
  threadId: string;
  messageId: string;
  userId?: string;
  abortSignal?: AbortSignal;
}

// Tool result wrapper
export type ToolResult<T> = 
  | { ok: true; data: T }
  | { ok: false; error: ToolError };

export interface ToolError {
  code: string;
  message: string;
  retryable: boolean;
}

// Tool execution wrapper with type safety
export async function executeTool<T extends ToolBuilder>(
  tool: T,
  args: z.infer<T['schema']>,
  context: ToolContext
): Promise<ToolResult<Awaited<ReturnType<T['handler']>>>> {
  try {
    // Validate args
    const validatedArgs = tool.schema.parse(args);
    
    // Execute
    const result = await tool.handler(validatedArgs, context);
    
    return { ok: true, data: result };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: 'TOOL_EXECUTION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
        retryable: false,
      },
    };
  }
}

// Example tool definition
export function createTool<
  TName extends string,
  TSchema extends z.ZodType,
  TReturn
>(
  name: TName,
  description: string,
  schema: TSchema,
  handler: (args: z.infer<TSchema>, context: ToolContext) => Promise<TReturn>
): ToolBuilder<TName, TSchema, TReturn> {
  return { name, description, schema, handler };
}
```

**Priority:** LOW
**Estimated Time:** 1.5 days

---

## Phase 6: Documentation & Tooling (Week 6)

### 6.1 Add TSDoc Comments

**Goal:** Document all public types and interfaces with TSDoc comments.

**Example:**
```typescript
/**
 * Represents a chat thread in the application.
 * 
 * @remarks
 * Threads are the top-level container for messages and maintain
 * their own context and usage statistics.
 * 
 * @example
 * ```typescript
 * const thread = await createThread("Hello!", pageContext);
 * console.log(thread.id); // UUID
 * ```
 */
export interface ChatThread {
  /** Unique identifier for the thread */
  id: ThreadId;
  
  /** Human-readable title, typically from first message */
  title: string;
  
  /** Unix timestamp of thread creation */
  createdAt: number;
  
  /** Unix timestamp of last update */
  updatedAt: number;
  
  /** Optional page context captured at thread start */
  initialPageContext?: string;
  
  /** Token usage statistics for this thread */
  lastUsage?: AppUsage;
}
```

**Priority:** MEDIUM
**Estimated Time:** 2 days

### 6.2 Setup Type Testing

**Create:** `src/types/__tests__/type-tests.ts`

```typescript
/**
 * Type tests - these don't run but are checked by TypeScript compiler
 */

import type { expectType, expectError } from 'tsd';
import type { ChatThread, ChatMessage } from '../database/schema';
import type { ModelState } from '../ai/state';

// Test discriminated unions work correctly
declare const modelState: ModelState;

if (modelState.status === 'ready') {
  expectType<string>(modelState.modelId); // Should have modelId
  // @ts-expect-error - Should not have progress
  modelState.progress;
}

if (modelState.status === 'downloading') {
  expectType<number>(modelState.progress); // Should have progress
  // @ts-expect-error - Should not have modelId
  modelState.modelId;
}

// Test branded types prevent mixing
import type { ThreadId, MessageId } from '../utils/branded';

declare const threadId: ThreadId;
declare const messageId: MessageId;

// @ts-expect-error - Cannot assign ThreadId to MessageId
const wrongAssignment: MessageId = threadId;

// Test type guards work
import { isModelReady } from '../ai/state';

if (isModelReady(modelState)) {
  expectType<string>(modelState.modelId); // Type narrowing works
}
```

**Install:** `pnpm add -D tsd`

**Priority:** LOW
**Estimated Time:** 1 day

### 6.3 Create Type Generation Script

**Create:** `scripts/generate-types.ts`

```typescript
/**
 * Generate type files from schemas or other sources
 */

// Could generate types from:
// - Database schema
// - API responses
// - Config files
// - Tool definitions

// Example: Generate tool types from registry
import { toolRegistry } from '../src/ai/tools/registry';

function generateToolTypes() {
  const tools = Array.from(toolRegistry.values());
  
  let output = '// Auto-generated tool types\n\n';
  
  for (const tool of tools) {
    output += `export interface ${tool.name}Args {\n`;
    // Generate from zod schema
    output += '}\n\n';
  }
  
  return output;
}
```

**Priority:** LOW
**Estimated Time:** 1 day

### 6.4 Update tsconfig.json

**Update:** `tsconfig.json` with stricter settings

```jsonc
{
  "extends": "plasmo/templates/tsconfig.base",
  "compilerOptions": {
    // Existing
    "jsx": "react-jsx",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "baseUrl": ".",
    "paths": {
      "~*": ["./src/*"]
    },
    
    // Add stricter type checking
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    
    // Additional checks
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    
    // Module resolution
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    
    // Emit
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    
    // Type roots
    "typeRoots": [
      "./node_modules/@types",
      "./src/types"
    ]
  },
  "include": [
    ".plasmo/index.d.ts",
    "./**/*.ts",
    "./**/*.tsx",
    "src/types/**/*.d.ts"
  ],
  "exclude": [
    "node_modules",
    "build"
  ]
}
```

**Priority:** HIGH
**Estimated Time:** 0.5 day

---

## Phase 7: Migration & Validation (Ongoing)

### 7.1 Gradual Migration Strategy

**Approach:**
1. Start with core types (Phase 1-2)
2. Update one module at a time
3. Run type checks frequently
4. Keep PRs small and focused

**Migration checklist per module:**
- [ ] Identify all `any` types
- [ ] Identify all `@ts-ignore` comments
- [ ] Create proper type definitions
- [ ] Replace `any` with specific types or `unknown`
- [ ] Remove `@ts-ignore` comments
- [ ] Add type guards where needed
- [ ] Add TSDoc comments
- [ ] Run `tsc --noEmit` to check
- [ ] Test functionality still works

### 7.2 Type Coverage Tracking

**Create:** `scripts/check-type-coverage.js`

```javascript
/**
 * Check TypeScript coverage
 * Reports files with 'any' types or @ts-ignore
 */

const fs = require('fs');
const path = require('path');

function scanForAny(dir) {
  const results = {
    anyCount: 0,
    ignoreCount: 0,
    files: []
  };
  
  function scan(currentPath) {
    const items = fs.readdirSync(currentPath);
    
    for (const item of items) {
      const fullPath = path.join(currentPath, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !item.includes('node_modules')) {
        scan(fullPath);
      } else if (item.endsWith('.ts') || item.endsWith('.tsx')) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const anyMatches = content.match(/:\s*any/g) || [];
        const ignoreMatches = content.match(/@ts-ignore|@ts-expect-error/g) || [];
        
        if (anyMatches.length > 0 || ignoreMatches.length > 0) {
          results.files.push({
            path: fullPath,
            anyCount: anyMatches.length,
            ignoreCount: ignoreMatches.length
          });
          results.anyCount += anyMatches.length;
          results.ignoreCount += ignoreMatches.length;
        }
      }
    }
  }
  
  scan(dir);
  return results;
}

const results = scanForAny('./src');

console.log('\n📊 TypeScript Coverage Report\n');
console.log(`Total 'any' types: ${results.anyCount}`);
console.log(`Total @ts-ignore comments: ${results.ignoreCount}\n`);

if (results.files.length > 0) {
  console.log('Files with issues:\n');
  results.files
    .sort((a, b) => (b.anyCount + b.ignoreCount) - (a.anyCount + a.ignoreCount))
    .forEach(file => {
      console.log(`  ${file.path}`);
      console.log(`    - ${file.anyCount} any types`);
      console.log(`    - ${file.ignoreCount} @ts-ignore comments\n`);
    });
}

process.exit(results.anyCount > 0 || results.ignoreCount > 0 ? 1 : 0);
```

Add to `package.json`:
```json
{
  "scripts": {
    "type:check": "tsc --noEmit",
    "type:coverage": "node scripts/check-type-coverage.js",
    "type:watch": "tsc --noEmit --watch"
  }
}
```

**Priority:** MEDIUM
**Estimated Time:** 0.5 day

---

## Success Metrics

### Quantitative Metrics
- [ ] Zero `any` types in production code (test files excluded)
- [ ] Zero `@ts-ignore` comments (or document why each is necessary)
- [ ] 100% of public APIs have TSDoc comments
- [ ] Zero type errors when running `tsc --noEmit --strict`
- [ ] All new code passes strict type checking

### Qualitative Metrics
- [ ] Better IntelliSense in VS Code
- [ ] Fewer runtime type errors
- [ ] Easier onboarding for new developers
- [ ] Faster development with better autocomplete
- [ ] Improved refactoring confidence

---

## Implementation Priority Order

### High Priority (Must Do)
1. **Phase 1.1** - Create centralized type directory structure
2. **Phase 1.2** - Define Chrome AI built-in types
3. **Phase 2.1** - Improve database types
4. **Phase 2.2** - AI message & tool types
5. **Phase 3.1** - Replace `any` types
6. **Phase 4.1** - Eliminate Chrome AI API ignores
7. **Phase 6.4** - Update tsconfig.json

### Medium Priority (Should Do)
8. **Phase 1.3** - Create utility type library
9. **Phase 2.3** - Component prop types
10. **Phase 3.2** - Type-safe event system
11. **Phase 4.2** - Eliminate OGL library ignores
12. **Phase 5.1** - Discriminated unions
13. **Phase 6.1** - Add TSDoc comments
14. **Phase 7.2** - Type coverage tracking

### Low Priority (Nice to Have)
15. **Phase 4.3** - Create proper type assertions
16. **Phase 5.2** - Branded types
17. **Phase 5.3** - Generic tool system
18. **Phase 6.2** - Setup type testing
19. **Phase 6.3** - Type generation script

---

## Quick Wins (Week 1 Sprints)

### Sprint 1: Foundation (Days 1-2)
- Create `src/types/` directory structure
- Create `chrome/ai.d.ts` with Chrome AI types
- Create `utils/helpers.ts` with utility types
- Update `tsconfig.json` paths

### Sprint 2: Core Types (Days 3-4)
- Create database schema types
- Create message types
- Create tool types
- Update `db/index.ts` to use new types

### Sprint 3: Cleanup (Day 5)
- Replace 10 most common `any` occurrences
- Remove 5 `@ts-ignore` comments
- Add type guards
- Run type check and fix errors

---

## Maintenance & Best Practices

### Ongoing Rules
1. **No new `any` types** - Use `unknown` instead
2. **Document all `@ts-ignore`** - Explain why needed
3. **Prefer interfaces for objects** - Use types for unions
4. **Export types from index files** - Central export points
5. **Write TSDoc for public APIs**
6. **Use discriminated unions for state**
7. **Create type guards for runtime checks**
8. **Keep types in separate files when possible**

### Code Review Checklist
- [ ] No `any` types added
- [ ] No `@ts-ignore` without explanation
- [ ] Types are exported from appropriate index file
- [ ] Public APIs have TSDoc comments
- [ ] Type tests updated if needed
- [ ] `tsc --noEmit` passes

---

## Resources & References

### TypeScript Resources
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)
- [Type Challenges](https://github.com/type-challenges/type-challenges)

### Type Pattern Libraries
- [type-fest](https://github.com/sindresorhus/type-fest)
- [ts-essentials](https://github.com/ts-essentials/ts-essentials)
- [utility-types](https://github.com/piotrwitek/utility-types)

### Tools
- [tsd](https://github.com/SamVerschueren/tsd) - Type testing
- [type-coverage](https://github.com/plantain-00/type-coverage) - Coverage tool
- [ts-morph](https://github.com/dsherret/ts-morph) - Code generation

---

## Conclusion

This multi-phase plan provides a comprehensive roadmap to transform the TypeScript type system from its current state to a robust, type-safe codebase. The phases are designed to be implemented incrementally, allowing for continuous integration and testing.

**Key Benefits:**
- 🎯 Better type safety and fewer runtime errors
- 🚀 Improved developer experience with better IntelliSense
- 📚 Self-documenting code with TSDoc
- 🔧 Easier maintenance and refactoring
- 👥 Faster onboarding for new developers
- 💪 More confidence when making changes

Start with the High Priority items and work through phases systematically. Each completed phase brings immediate benefits while building toward the complete solution.
