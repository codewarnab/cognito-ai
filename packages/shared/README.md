# @cognito/shared

Shared types and constants for the Cognito AI monorepo.

## Installation

This package is part of the pnpm monorepo and is available to other packages automatically:

```bash
# In apps/extension or packages/backend-vercel
pnpm add @cognito/shared@workspace:*
```

## Usage

### Types

```typescript
// Import specific types
import type { WriteTone, WritePageContext } from '@cognito/shared';
import type { RewritePreset } from '@cognito/shared';
import type { SummaryType, SummaryLength } from '@cognito/shared';

// Or import from subpath
import type { WriteTone } from '@cognito/shared/types';
```

### Constants

```typescript
// Import specific constants
import { 
    TONE_INSTRUCTIONS, 
    PLATFORM_INSTRUCTIONS,
    PRESET_PROMPTS,
    SUMMARY_TYPE_INSTRUCTIONS,
    SUMMARY_LENGTH_TOKENS 
} from '@cognito/shared';

// Or import from subpath
import { TONE_INSTRUCTIONS } from '@cognito/shared/constants';
```

## Contents

### Types

| Type | Description |
|------|-------------|
| `WriteTone` | Tone options: professional, casual, formal, friendly |
| `WritePageContext` | Page context for writing features |
| `WritePlatform` | Platform options: Gmail, LinkedIn, Twitter, etc. |
| `RewritePreset` | Preset options: shorter, longer, professional, etc. |
| `RewritePageContext` | Page context for rewrite operations |
| `SummaryType` | Summary types: key-points, tl-dr, headline, teaser |
| `SummaryLength` | Summary lengths: short, medium, long |
| `SummaryPageContext` | Page context for summarization |
| `TranscriptSegment` | YouTube transcript segment with timing |
| `TranscriptResponse` | Full YouTube transcript response |
| `AIChatMessage` | Chat message structure |
| `AIChatErrorResponse` | Error response structure |
| `ChatMode` | Chat modes: chat, agent, adaptive |
| `LogEntry` | Structure for application logs |
| `LogSeverity` | Log levels: debug, info, warn, error |
| `UserSettings` | User configuration interface |
| `Reminder` | Structure for user reminders |

### Constants

| Constant | Description |
|----------|-------------|
| `TONE_INSTRUCTIONS` | Instructions for each writing tone |
| `PLATFORM_INSTRUCTIONS` | Platform-specific writing guidance |
| `PRESET_PROMPTS` | Preset prompts for rewriting |
| `SUMMARY_TYPE_INSTRUCTIONS` | Instructions for each summary type |
| `SUMMARY_LENGTH_TOKENS` | Token limits for summary lengths |
| `SUGGESTION_CAPABILITIES` | AI suggestion capabilities list |
| `LOG_CATEGORIES` | Available logging categories |
| `DEFAULT_SETTINGS` | Default user settings |
| `FEATURE_FLAGS` | System feature flags |

## Development

```bash
# Build the package
pnpm build

# Watch for changes
pnpm dev
```
