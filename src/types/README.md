# TypeScript Type System

This directory contains the centralized type definitions for the Chrome AI extension project. The type system is organized into logical modules for better maintainability and discoverability.

## Directory Structure

```
src/types/
├── index.ts                    # Central export point - import from here
├── global.d.ts                 # Global type augmentations
├── assets.d.ts                 # Asset module declarations (images, etc.)
├── sidepanel.ts               # Sidepanel-specific types
├── chrome/                    # Chrome API types
│   ├── index.ts
│   ├── ai.d.ts               # Chrome Built-in AI API types
│   ├── tabs.ts               # Enhanced tab types
│   └── storage.ts            # Storage types
├── ai/                        # AI-related types
│   ├── index.ts
│   ├── models.ts             # Model configurations
│   ├── messages.ts           # Chat message types
│   ├── tools.ts              # Tool system types
│   ├── streaming.ts          # Streaming response types
│   └── usage.ts              # Token usage types
├── components/                # Component prop types
│   ├── index.ts
│   ├── chat.ts               # Chat component types
│   ├── voice.ts              # Voice component types
│   └── ui.ts                 # UI component types
├── database/                  # Database types
│   ├── index.ts
│   ├── schema.ts             # Database schema
│   └── queries.ts            # Query types
├── mcp/                       # MCP types
│   └── index.ts
├── memory/                    # Memory system types
│   └── index.ts
├── workflows/                 # Workflow types
│   └── index.ts
└── utils/                     # Utility types
    ├── index.ts
    ├── helpers.ts            # Generic helper types
    ├── typeGuards.ts         # Type guard functions
    ├── assertions.ts         # Type assertion functions
    └── branded.ts            # Branded/nominal types
```

## Usage

### Importing Types

Always import types from the centralized location:

```typescript
// ✅ Good - Import from central location
import type { ChatThread, ChatMessage } from '~/types/database';
import type { EnhancedMessage, ToolDefinition } from '~/types/ai';
import type { TabContext } from '~/types/chrome';

// ❌ Bad - Don't import from nested files directly
import type { ChatThread } from '~/types/database/schema';
```

### Chrome AI API Types

The `chrome/ai.d.ts` file provides complete type definitions for Chrome's Built-in AI APIs, eliminating the need for `@ts-ignore` comments:

```typescript
// Before
// @ts-ignore - Chrome AI API
const session = await window.ai.languageModel.create();

// After - Fully typed!
const session = await window.ai?.languageModel?.create({
  temperature: 0.7,
  topK: 3,
  systemPrompt: "You are a helpful assistant"
});

if (session) {
  const response = await session.prompt("Hello!");
  console.log(response);
}
```

### Using Utility Types

```typescript
import type { Optional, DeepPartial, Prettify } from '~/types/utils';

// Make some properties optional
type PartialUser = Optional<User, 'email' | 'phone'>;

// Deep partial for nested objects
type DeepPartialConfig = DeepPartial<Configuration>;

// Prettify complex types for better IntelliSense
type CleanType = Prettify<ComplexIntersectionType>;
```

### Using Type Guards

```typescript
import { isObject, hasProperty, assertExists } from '~/types/utils';

function processValue(value: unknown) {
  if (isObject(value) && hasProperty(value, 'name')) {
    // TypeScript knows value is { name: unknown }
    console.log(value.name);
  }
}

function requireValue<T>(value: T | undefined): T {
  assertExists(value, 'Value is required');
  // TypeScript knows value is T here
  return value;
}
```

### Using Branded Types

Branded types prevent mixing up similar primitive types:

```typescript
import { ThreadId, MessageId, createThreadId } from '~/types/utils';

// Won't compile - can't assign regular string to ThreadId
const threadId: ThreadId = "abc123"; // ❌ Error

// Correct way - use constructor
const threadId = createThreadId("abc123"); // ✅ Good

// This prevents bugs like:
function getMessage(messageId: MessageId) { /* ... */ }
const thread = createThreadId("123");
getMessage(thread); // ❌ Type error - can't pass ThreadId to MessageId
```

## Type System Philosophy

### 1. No `any` Types

Use `unknown` instead of `any` and narrow with type guards:

```typescript
// ❌ Bad
function process(data: any) {
  return data.value;
}

// ✅ Good
function process(data: unknown) {
  if (isObject(data) && hasProperty(data, 'value')) {
    return data.value;
  }
  throw new Error('Invalid data structure');
}
```

### 2. Avoid `@ts-ignore`

Use proper types or type assertions instead:

```typescript
// ❌ Bad
// @ts-ignore
const result = someComplexOperation();

// ✅ Good
const result = someComplexOperation() as ExpectedType;
// Or better, fix the types!
```

### 3. Type Everything

All public APIs should have explicit types:

```typescript
// ❌ Bad
export function createThread(title) {
  // ...
}

// ✅ Good
export function createThread(title: string): Promise<ChatThread> {
  // ...
}
```

### 4. Use Discriminated Unions

For state management and variants:

```typescript
type ModelState =
  | { status: 'idle' }
  | { status: 'downloading'; progress: number }
  | { status: 'ready'; modelId: string }
  | { status: 'error'; error: Error };

function handleState(state: ModelState) {
  switch (state.status) {
    case 'idle':
      // No extra properties
      break;
    case 'downloading':
      // TypeScript knows state.progress exists
      console.log(state.progress);
      break;
    case 'ready':
      // TypeScript knows state.modelId exists
      console.log(state.modelId);
      break;
    case 'error':
      // TypeScript knows state.error exists
      console.error(state.error);
      break;
  }
}
```

## Best Practices

### 1. Export Types from Index Files

Each directory has an `index.ts` that exports all types from that module. This provides a clean import path and makes it easy to reorganize files later.

### 2. Use TSDoc Comments

Document all public types with TSDoc:

```typescript
/**
 * Represents a chat thread in the application.
 * 
 * @remarks
 * Threads are the top-level container for messages.
 * 
 * @example
 * ```typescript
 * const thread = await createThread("Hello!");
 * ```
 */
export interface ChatThread {
  /** Unique identifier */
  id: string;
  /** Human-readable title */
  title: string;
  // ...
}
```

### 3. Keep Types Close to Usage

If a type is only used in one file, define it there. If it's used across multiple files, move it to the appropriate types directory.

### 4. Prefer Interfaces for Objects

Use `interface` for object shapes and `type` for unions, intersections, and computed types:

```typescript
// ✅ Good
interface User {
  id: string;
  name: string;
}

type UserId = string;
type UserOrGuest = User | Guest;
```

## Type Checking

### Run Type Check

```bash
pnpm type:check
```

### Watch Mode

```bash
pnpm type:watch
```

## Migration Guide

When updating existing code to use the new type system:

1. **Import the types**: Replace inline type definitions with imports from `~/types`
2. **Remove `@ts-ignore`**: Use the new Chrome AI types or proper type guards
3. **Replace `any`**: Use `unknown` and type guards instead
4. **Add type annotations**: Ensure functions have return types and parameters have types
5. **Fix errors**: Run `pnpm type:check` and fix any type errors

## Contributing

When adding new types:

1. Choose the appropriate directory (or create a new one if needed)
2. Add the type definition file
3. Export from the directory's `index.ts`
4. Add TSDoc comments for public types
5. Update this README if adding a new directory

## Related Documentation

- [TypeScript Improvement Plan](../../plans/TYPESCRIPT_IMPROVEMENT_PLAN.md) - Full plan for type system improvements
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html) - Official TypeScript docs
- [Type Challenges](https://github.com/type-challenges/type-challenges) - Practice TypeScript skills
