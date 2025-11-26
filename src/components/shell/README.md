# Shell Components

This folder contains **application shell** components - top-level container components that orchestrate the overall application structure and layout.

## Purpose

Shell components are the outermost UI containers that:
- Compose multiple feature components together
- Manage application-wide state (model config, error notifications)
- Handle cross-cutting concerns (API key changes, storage listeners)
- Provide the main application frame/window

## Components

### `CopilotChatWindow.tsx`

The main chat window component that serves as the primary UI container for the sidepanel. It:

- **Composes** the chat header, messages, and input components
- **Manages** model state (local/remote mode, API key status)
- **Handles** error notifications and dismissals
- **Listens** for storage changes to sync API key state
- **Orchestrates** the model download toast container

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `messages` | `Message[]` | Chat message history |
| `input` | `string` | Current input value |
| `setInput` | `function` | Input value setter |
| `onSendMessage` | `function` | Send message handler |
| `isLoading` | `boolean` | Loading state |
| `messagesEndRef` | `RefObject` | Scroll anchor ref |
| `on*Click` | `function` | Various navigation callbacks |
| `usage` | `AppUsage` | Token usage tracking |
| `localPdfInfo` | `LocalPdfInfo` | Local PDF detection |

## Conventions

- Shell components should be minimal orchestrators
- Business logic belongs in hooks or feature components
- Keep styling in external CSS files
- Use composition over inheritance
- Document all props with TypeScript interfaces

## Related Folders

- `features/chat/components/` - Chat-specific UI components
- `shared/` - Reusable components used across features
- `ui/` - Primitive/base UI components (shadcn)

## When to Add Components Here

Add a component to `shell/` if it:
1. Is a top-level application container
2. Composes multiple major feature areas
3. Manages application-wide state
4. Would be mounted directly in the entry point (sidepanel.tsx, options.tsx)

**Do NOT add:**
- Feature-specific components (use `features/`)
- Reusable UI primitives (use `shared/` or `ui/`)
- Single-purpose components (use appropriate feature folder)
