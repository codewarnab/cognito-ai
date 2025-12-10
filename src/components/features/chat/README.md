# Chat Components

This directory contains the modularized chat window components and features.

## Structure

```
chat/
├── components/          # UI Components
│   ├── attachments/    # File and tab attachment components
│   ├── badges/         # Status badges
│   ├── buttons/        # Action buttons (Voice, Copy, etc.)
│   ├── composer/       # Input area and associated logic
│   ├── display/        # Message rendering and headers
│   ├── feedback/       # Loading indicators, errors, progress
│   ├── modals/         # Dialogs and settings
│   ├── states/         # Empty states, banners
│   └── suggestions/    # Prompt suggestions
├── context/            # Context management (Indicator, Warning)
├── dropdowns/          # Selection menus (Mode, Model, Slash Commands)
├── icons/              # SVG icon components
├── types.ts            # Shared TypeScript types
├── utils.ts            # Helper functions
└── index.ts            # Barrel export
```

## Key Components

### Composer
The main input interface handling:
- Text input with auto-resize
- Voice recording integration
- File/Context attachments
- Slash commands
- Mode selection (Cloud/Local)

### ChatMessages
Displays the conversation history with support for:
- Markdown rendering (Streamdown)
- Tool call visualization
- Loading states
- Optimistic updates

### Voice Integration
- **VoiceButton**: Toggles voice mode and recording state
- **AnimatedCircularProgressBar**: Visual feedback for voice activity

### Attachments & Context
- **AttachmentDropdown**: Menu for adding files or tabs
- **ContextIndicator**: Shows current context token usage
- **WorkflowBadge**: Indicates active agentic workflows

## Usage

Components are designed to be composed together but are primarily orchestrated by the `CopilotChatWindow` (now refactored into smaller sub-views).

```typescript
import { ChatInput, ChatMessages } from './components';
```

## Benefits of Modularization

1. **Maintainability** - Each component has a single responsibility
2. **Reusability** - Components can be used independently
3. **Testability** - Easier to write unit tests for individual pieces
4. **Code Organization** - Clear structure with logical grouping
