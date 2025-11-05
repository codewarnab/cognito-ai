# Chat Components

This directory contains the modularized chat window components extracted from `CopilotChatWindow.tsx`.

## Structure

```
chat/
├── icons/                    # SVG icon components
│   ├── SendIcon.tsx         # Send message icon
│   ├── StopIcon.tsx         # Stop generation icon
│   └── RobotIcon.tsx        # Robot avatar for empty state
├── ChatHeader.tsx           # Header with navigation and menu
├── ChatMessages.tsx         # Message list display
├── ChatInput.tsx            # Input composer with actions
├── EmptyState.tsx           # Empty chat placeholder
├── LoadingIndicator.tsx     # Loading animation dots
├── ModeSelector.tsx         # Execution mode switcher (local/cloud)
├── types.ts                 # Shared TypeScript types
├── utils.ts                 # Helper functions
├── index.ts                 # Barrel export
└── README.md               # This file
```

## Components

### ChatHeader
Navigation header with buttons for:
- Opening chat history sidebar
- Creating new threads
- Opening MCP settings
- Kebab menu for memory, reminders, and API setup

**Props:**
- `onSettingsClick?: () => void`
- `onThreadsClick?: () => void`
- `onNewThreadClick?: () => void`
- `onMemoryClick?: () => void`

### ChatMessages
Displays the message list with:
- Empty state when no messages
- User and assistant messages
- Tool call rendering
- Loading indicator
- Message animations

**Props:**
- `messages: Message[]`
- `isLoading: boolean`
- `messagesEndRef: React.RefObject<HTMLDivElement | null>`
- `pendingMessageId?: string | null`

### ChatInput
Input composer with:
- Auto-resizing textarea
- Voice input button
- File upload button
- Send/Stop button
- Mode selector (local/cloud)
- Animated preview overlay

**Props:**
- `input: string`
- `setInput: (value: string) => void`
- `onSendMessage: (messageText?: string) => void`
- `isLoading: boolean`
- `isRecording?: boolean`
- `onMicClick?: () => void`
- `onStop?: () => void`
- `pendingMessageId?: string | null`
- `nextMessageId?: string`
- `executionMode: ExecutionMode`
- `onExecutionModeChange: (mode: ExecutionMode) => void`

### ModeSelector
Dropdown to switch between local and cloud execution modes.

**Props:**
- `executionMode: ExecutionMode`
- `showModeDropdown: boolean`
- `onExecutionModeChange: (mode: ExecutionMode) => void`
- `onToggleDropdown: (show: boolean) => void`

### EmptyState
Displays a friendly robot icon and welcome message when the chat is empty.

### LoadingIndicator
Animated three-dot loading indicator shown while the assistant is generating a response.

## Types

### Message
```typescript
interface Message {
    id?: string;
    role: 'user' | 'assistant';
    content: string;
    parts?: any[];
    generativeUI?: () => React.ReactElement | null;
}
```

### ExecutionMode
```typescript
type ExecutionMode = 'local' | 'cloud';
```

## Utility Functions

### `getMessageContent(message: Message): string`
Extracts text content from AI SDK v5 parts array.

### `hasToolCalls(message: Message): boolean`
Checks if a message contains tool calls (tool-call, tool-result, etc.).

## Icons

All SVG icons are extracted into separate components for reusability:
- **SendIcon** - Paper plane icon for sending messages
- **StopIcon** - Square icon for stopping generation
- **RobotIcon** - Animated robot illustration for empty state

## Usage

```typescript
import { CopilotChatWindow } from './components/core/CopilotChatWindow';

// The main component automatically uses all subcomponents
<CopilotChatWindow
    messages={messages}
    input={input}
    setInput={setInput}
    onSendMessage={handleSendMessage}
    isLoading={isLoading}
    // ... other props
/>
```

Or import individual components:

```typescript
import { ChatHeader, ChatMessages, ChatInput } from './components/chat';
```

## Benefits of Modularization

1. **Maintainability** - Each component has a single responsibility
2. **Reusability** - Components can be used independently
3. **Testability** - Easier to write unit tests for individual pieces
4. **Code Organization** - Clear structure with logical grouping
5. **Performance** - Easier to optimize individual components
6. **Collaboration** - Team members can work on different components without conflicts
