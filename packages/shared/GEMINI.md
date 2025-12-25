# @cognito/shared - Gemini Context

## Package: `@cognito/shared`

### Purpose
Central package containing shared types and constants used by both the Chrome extension frontend (`@cognito/extension`) and the Vercel backend (`@cognito/backend-vercel`).

This package ensures:
- **Single source of truth** for all shared type definitions
- **Consistency** in prompt instructions across frontend and backend
- **Type safety** for API contracts

### Structure

packages/shared/
├── src/
│   ├── types/
│   │   ├── index.ts           # Re-exports all types
│   │   ├── writer.ts          # WriteTone, WritePageContext, WritePlatform
│   │   ├── rewriter.ts        # RewritePreset, RewritePageContext
│   │   ├── summarizer.ts      # SummaryType, SummaryLength, SummaryPageContext
│   │   ├── transcript.ts      # TranscriptSegment, TranscriptResponse, VideoInfo
│   │   ├── chat.ts            # AIChatMessage, AIChatRequestBody, ChatMode
│   │   ├── logger.ts          # LogEntry, LogSeverity, LogCategory
│   │   ├── settings.ts        # UserSettings, AIProvider settings
│   │   ├── messaging.ts       # Message passing types
│   │   ├── provider.ts        # AI Provider interfaces
│   │   └── reminder.ts        # Reminder types
│   ├── constants/
│   │   ├── index.ts           # Re-exports all constants
│   │   ├── prompts.ts         # TONE_INSTRUCTIONS, PLATFORM_INSTRUCTIONS
│   │   ├── logger.ts          # Log categories and defaults
│   │   └── featureFlags.ts    # Feature flags configuration
│   ├── storage/
│   │   ├── index.ts           # Re-exports storage utilities
│   │   └── loggerStorage.ts   # IndexedDB storage for logs
│   └── index.ts               # Main entry point
├── package.json
├── tsconfig.json
└── README.md

### Usage in Other Packages

```typescript
// Import types
import type { WriteTone, RewritePreset, SummaryType } from '@cognito/shared';

// Import constants
import { TONE_INSTRUCTIONS, PRESET_PROMPTS } from '@cognito/shared';

// Or use subpath exports
import type { WriteTone } from '@cognito/shared/types';
import { TONE_INSTRUCTIONS } from '@cognito/shared/constants';
```

### Development

```bash
# Build the package
pnpm build

# Watch for changes during development
pnpm dev
```

### Important Notes

1. **Always build before testing** - Other packages import from `dist/`, not `src/`
2. **Use `.js` extensions** in internal imports (ESM requirement)
3. **Update both frontend and backend** when modifying shared types
