# Cognito AI Web App Migration Plan

## Overview

This document outlines the multi-phase plan to migrate onboarding, settings, and configuration features from the Chrome extension to a dedicated Next.js 16 web application.

> **Development Note**: The final domain (e.g., `app.cognito.ai`) is TBD. During development, the webapp runs on **`http://localhost:3002`**. The extension is currently under development and NOT yet published to the Chrome Web Store.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              Web App (localhost:3002 → production domain TBD)               │
├─────────────────────────────────────────────────────────────────────────────┤
│  Routes:                                                                     │
│  ├── /onboarding          - Multi-step onboarding flow                      │
│  ├── /providers           - AI provider setup (Google, Vertex, etc.)        │
│  ├── /settings            - Unified settings page (all toggles in one UI)  │
│  ├── /reminders           - Reminder management                             │
│  ├── /features            - Feature showcase & example prompts              │
│  ├── /troubleshooting     - Help & troubleshooting guide                    │
│  └── /changelog           - Version history & updates                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    chrome.runtime.sendMessage (External Messaging)
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Chrome Extension                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Keeps:                                                                      │
│  ├── Side panel UI (chat interface)                                         │
│  ├── MCP connection management                                              │
│  ├── Content scripts (Ask AI button, overlays)                              │
│  ├── chrome.storage.local (single source of truth)                          │
│  ├── Tool execution logic                                                   │
│  └── Voice mode runtime                                                      │
│                                                                              │
│  Removes:                                                                    │
│  ├── OnboardingScreen.tsx → Redirects to website                            │
│  ├── SettingsPage.tsx → Button opens website                                │
│  ├── ProviderSetup.tsx → Redirects to website                               │
│  ├── Troubleshooting.tsx → Redirects to website                             │
│  ├── Features.tsx → Redirects to website                                    │
│  └── ReminderPanel.tsx → Redirects to website                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Communication Pattern: External Messaging API (Option B)

### Why External Messaging?

- **Clean separation**: Website doesn't need its own storage
- **Single source of truth**: Extension's `chrome.storage.local` holds all data
- **Type-safe**: Can define strict message interfaces
- **No content script needed**: Direct `chrome.runtime.sendMessage`
- **Security**: Whitelist only your domains

### Manifest Configuration

```json
{
  "externally_connectable": {
    "matches": [
      "https://app.cognito.ai/*",
      "https://*.cognito.ai/*",
      "http://localhost:3002/*"
    ]
  }
}
```

> **Note**: Since the extension is not yet published to Chrome Web Store, we use the development extension ID. This will change once published.

---

## Phase 1: Foundation & Infrastructure

**Duration**: 1 week  
**Goal**: Set up Next.js 16 app, external messaging API, and basic extension integration

### 1.1 Create Next.js 16 Web App

```bash
# In packages/ directory
pnpm create next-app@latest webapp --typescript --tailwind --eslint --app --src-dir
```

**Package structure:**
```
packages/
  shared/                    # @cognito/shared - Shared types
    ├── src/
    │   ├── messaging.types.ts
    │   ├── settings.types.ts
    │   ├── reminders.types.ts
    │   ├── providers.types.ts
    │   └── index.ts
    └── package.json

  webapp/                    # @cognito/webapp - Next.js 16 App
    ├── src/
    │   ├── app/
    │   │   ├── layout.tsx
    │   │   ├── page.tsx           # Landing/redirect
    │   │   ├── onboarding/        # Multi-step onboarding
    │   │   ├── providers/         # AI provider setup
    │   │   ├── settings/          # Unified settings (single page)
    │   │   ├── reminders/         # Reminder management
    │   │   ├── features/          # Feature showcase
    │   │   ├── troubleshooting/   # Help & troubleshooting
    │   │   └── changelog/         # Version history
    │   ├── components/
    │   │   ├── ui/                # Shared UI components
    │   │   ├── settings/          # Settings section components
    │   │   └── extension/         # Extension communication
    │   ├── lib/
    │   │   └── extension-api.ts   # External messaging client
    │   └── hooks/
    │       └── useExtension.ts    # React hook for extension comm
    ├── package.json
    └── next.config.ts             # Port 3002 configured
```

### 1.1.1 Development Server Configuration

**File**: `packages/webapp/package.json`
```json
{
  "scripts": {
    "dev": "next dev -p 3002",
    "build": "next build",
    "start": "next start -p 3002"
  }
}
```

### 1.2 External Messaging API (Extension Side)

Create a new message handler in the extension:

**File**: `apps/extension/src/services/external-messaging.ts`

```typescript
// Message types for external communication
export type ExternalMessageType =
  | 'GET_SETTINGS'
  | 'SET_SETTINGS'
  | 'GET_ONBOARDING_STATUS'
  | 'SET_ONBOARDING_COMPLETE'
  | 'GET_PROVIDER_CONFIG'
  | 'SET_PROVIDER_CONFIG'
  | 'GET_REMINDERS'
  | 'SET_REMINDERS'
  | 'OPEN_SIDEPANEL'
  | 'PING';

export interface ExternalMessage {
  type: ExternalMessageType;
  payload?: unknown;
}

export interface ExternalResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Allowed origins
const ALLOWED_ORIGINS = [
  'https://app.cognito.ai',
  'https://cognito.ai',
  'http://localhost:3002', // Dev - webapp dev server
];

export function setupExternalMessaging() {
  chrome.runtime.onMessageExternal.addListener(
    (message: ExternalMessage, sender, sendResponse) => {
      // Validate origin
      if (!sender.origin || !ALLOWED_ORIGINS.some(o => sender.origin?.startsWith(o))) {
        sendResponse({ success: false, error: 'Unauthorized origin' });
        return;
      }

      handleExternalMessage(message)
        .then(sendResponse)
        .catch(err => sendResponse({ success: false, error: err.message }));

      return true; // Async response
    }
  );
}

async function handleExternalMessage(message: ExternalMessage): Promise<ExternalResponse> {
  switch (message.type) {
    case 'PING':
      return { success: true, data: { installed: true, version: chrome.runtime.getManifest().version } };
    
    case 'GET_SETTINGS':
      return handleGetSettings();
    
    case 'SET_SETTINGS':
      return handleSetSettings(message.payload);
    
    // ... more handlers
    
    default:
      return { success: false, error: `Unknown message type: ${message.type}` };
  }
}
```

### 1.3 External Messaging Client (Website Side)

**File**: `packages/webapp/src/lib/extension-api.ts`

```typescript
const EXTENSION_ID = process.env.NEXT_PUBLIC_EXTENSION_ID!;

export class ExtensionAPI {
  private static instance: ExtensionAPI;
  
  static getInstance(): ExtensionAPI {
    if (!this.instance) {
      this.instance = new ExtensionAPI();
    }
    return this.instance;
  }

  async isInstalled(): Promise<boolean> {
    try {
      const response = await this.sendMessage({ type: 'PING' });
      return response.success;
    } catch {
      return false;
    }
  }

  async sendMessage<T>(message: ExternalMessage): Promise<ExternalResponse<T>> {
    return new Promise((resolve, reject) => {
      if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
        reject(new Error('Extension not available'));
        return;
      }

      chrome.runtime.sendMessage(EXTENSION_ID, message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  // Convenience methods
  async getSettings() {
    return this.sendMessage({ type: 'GET_SETTINGS' });
  }

  async setSettings(settings: Partial<Settings>) {
    return this.sendMessage({ type: 'SET_SETTINGS', payload: settings });
  }

  async openSidePanel() {
    return this.sendMessage({ type: 'OPEN_SIDEPANEL' });
  }
}
```

### 1.4 Update Extension Manifest (WXT Config)

**File**: `apps/extension/wxt.config.ts` - Add externally_connectable

### 1.5 Deliverables

- [ ] Next.js 16 app scaffolded in `packages/webapp/`
- [ ] External messaging service in extension
- [ ] TypeScript types shared between extension and webapp
- [ ] Basic "is extension installed?" detection on website
- [ ] Development setup with localhost allowed

---

## Phase 2: Onboarding Migration

**Duration**: 1 week  
**Goal**: Move full onboarding flow to website, auto-open on install

### 2.1 Current Onboarding Components to Migrate

| Extension Component | Website Route |
|---------------------|---------------|
| `WelcomePage.tsx` | `/onboarding` (step 1) |
| `FeaturesPage.tsx` | `/onboarding` (step 2) |
| `CapabilitiesPage.tsx` | `/onboarding` (step 3) |
| `GetStartedPage.tsx` | `/onboarding` (step 4) |

### 2.2 Extension Install Hook

**File**: `apps/extension/src/background.ts`

```typescript
// Webapp URL - use env variable for flexibility
const WEBAPP_URL = import.meta.env.DEV 
  ? 'http://localhost:3002' 
  : 'https://app.cognito.ai'; // Update when domain is finalized

// On extension install, open webapp onboarding
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({
      url: `${WEBAPP_URL}/onboarding?source=install`,
    });
  }
});
```

### 2.3 Website Onboarding Flow

```
/onboarding
├── Step 1: Welcome (extension detection)
├── Step 2: Features overview
├── Step 3: Capabilities demo
├── Step 4: Provider setup (optional, can skip)
└── Step 5: Complete → Opens extension side panel
```

### 2.4 Post-Onboarding Side Panel Open

When onboarding completes on website:

```typescript
// Website: onboarding complete
const handleComplete = async () => {
  await extensionAPI.setSettings({ onboardingComplete: true });
  await extensionAPI.openSidePanel();
  // Redirect to dashboard or close tab
};
```

Extension handles `OPEN_SIDEPANEL`:

```typescript
case 'OPEN_SIDEPANEL':
  // Get current tab and open side panel
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    await chrome.sidePanel.open({ tabId: tab.id });
  }
  return { success: true };
```

### 2.5 Deliverables

- [ ] `/onboarding` multi-step flow on website
- [ ] Extension detects first install → opens website
- [ ] Website can trigger side panel open after onboarding
- [ ] Remove `OnboardingScreen.tsx` from extension (keep minimal redirect)
- [ ] Onboarding state persisted in `chrome.storage.local`

---

## Phase 3: AI Provider Setup Migration

**Duration**: 1 week  
**Goal**: Move provider configuration (Google AI, Vertex AI) to website

### 3.1 Current Provider Setup Features

From `ProviderSetup.tsx`:
- Google AI API key input
- Vertex AI credentials (project ID, location, service account)
- Model selection (gemini-3-flash-preview, gemini-3-pro-preview, etc.)
- Provider switching
- Key validation

### 3.2 Website Route

**Single Route**: `/providers`

All provider configuration on one page with tabs/sections:
- Google AI Studio setup
- Vertex AI setup  
- Model preferences
- Provider switching

### 3.3 Security Considerations

⚠️ **API keys should be stored securely in extension storage, NOT in the website's localStorage or transmitted to any backend.**

Flow:
1. User enters API key on website
2. Website sends key directly to extension via external messaging
3. Extension validates and stores in `chrome.storage.local`
4. Website never persists the key

### 3.4 Deliverables

- [ ] `/settings/providers` page with provider selection
- [ ] API key input forms (keys sent directly to extension)
- [ ] Model preference selection
- [ ] Key validation feedback
- [ ] Remove `ProviderSetup.tsx` from extension

---

## Phase 4: Settings Pages Migration

**Duration**: 2 weeks  
**Goal**: Move all settings to website

### 4.1 Settings to Migrate

All settings will live on a **single `/settings` page** with smooth toggles and collapsible sections.

| Extension Component | Settings Section | Storage Key |
|---------------------|------------------|-------------|
| `AskAiButtonSettings.tsx` | Features → Ask AI Button | `askAiButtonConfig` |
| `TextSummarizerSettings.tsx` | Features → Text Summarizer | `summarizerConfig` |
| `TextRewriterSettings.tsx` | Features → Text Rewriter | `rewriterConfig` |
| `WriteCommandSettings.tsx` | Features → Write Command | `writeCommandConfig` |
| `TTSAndDataSettings.tsx` | Voice & Audio → TTS | `ttsConfig` |
| `MaxToolCallSettings.tsx` | Tools → Max Calls | `maxToolCalls` |
| `SupermemorySettings.tsx` | Integrations → Supermemory | `supermemoryConfig` |
| `SearchSettingsSection.tsx` | Search → Provider | `searchConfig` |
| `ResearchWorkflowSettings.tsx` | Workflows → Research | `researchConfig` |
| `VoiceSettings.tsx` | Voice & Audio → Voice Mode | `voiceConfig` |

### 4.2 Unified Settings Page Design

**Route**: `/settings` (single page with smooth toggles)

```
┌─────────────────────────────────────────────────────────────────┐
│  Settings                                        [Save Changes] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─ General ──────────────────────────────────────────────────┐ │
│  │  Theme                    [Dark ▼]                         │ │
│  │  Compact Mode             [────●]                          │ │
│  │  Notification Sounds      [●────]                          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─ Tools ────────────────────────────────────────────────────┐ │
│  │  Max Tool Calls           [10 ▼]                           │ │
│  │  Enabled Tools            [Configure...]                   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─ Features ─────────────────────────────────────────────────┐ │
│  │  Ask AI Button            [────●]  [⚙️]                     │ │
│  │  Text Summarizer          [────●]  [⚙️]                     │ │
│  │  Text Rewriter            [────●]  [⚙️]                     │ │
│  │  Write Command            [●────]  [⚙️]                     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─ Voice & Audio ────────────────────────────────────────────┐ │
│  │  Voice Mode               [────●]                          │ │
│  │  TTS Provider             [ElevenLabs ▼]                   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─ Search ───────────────────────────────────────────────────┐ │
│  │  Search Provider          [Tavily ▼]                       │ │
│  │  Show Search Toggle       [────●]                          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─ Workflows ────────────────────────────────────────────────┐ │
│  │  Research Workflow        [────●]  [⚙️]                     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─ Integrations ─────────────────────────────────────────────┐ │
│  │  Supermemory              [Connect...]                     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key UI Patterns:**
- Smooth toggle switches (animated)
- Collapsible sections with expand/collapse
- Inline settings where possible
- Settings gear icon (⚙️) opens modal for advanced options
- Real-time sync with extension via external messaging
- Optimistic UI updates with rollback on failure

### 4.3 Extension Settings Button

Replace full settings page with a simple redirect:

```tsx
// Extension side panel - Settings button
const WEBAPP_URL = import.meta.env.DEV 
  ? 'http://localhost:3002' 
  : 'https://app.cognito.ai';

const handleSettingsClick = () => {
  chrome.tabs.create({ url: `${WEBAPP_URL}/settings` });
};
```

### 4.4 Deliverables

- [ ] All settings pages implemented on website
- [ ] Real-time sync with extension storage
- [ ] Settings validation and feedback
- [ ] Extension settings button opens website
- [ ] Remove individual settings components from extension

---

## Phase 5: Reminders & Troubleshooting Migration

**Duration**: 1 week  
**Goal**: Move reminders management and help content to website

### 5.1 Reminders

**Website Route**: `/reminders`

Features:
- View all reminders
- Create new reminders
- Edit existing reminders
- Delete reminders
- Reminder time picker

Storage: `chrome.storage.local` → `reminders` key

### 5.2 Troubleshooting

**Website Route**: `/troubleshooting`

Migrate: `troubleshootingData.ts` → Website content

### 5.3 Features/Example Prompts

**Website Route**: `/features`

Migrate: `featuresData.ts` → Website content

### 5.4 Changelog

**Website Route**: `/changelog`

New page to track:
- Version history
- New features
- Bug fixes
- Breaking changes

### 5.5 Deliverables

- [ ] `/reminders` CRUD page
- [ ] `/troubleshooting` accordion page
- [ ] `/features` example prompts page
- [ ] `/changelog` version history page
- [ ] Remove `ReminderPanel.tsx`, `Troubleshooting.tsx`, `Features.tsx` from extension

---

## Phase 6: Polish & Cleanup

**Duration**: 1 week  
**Goal**: Remove migrated code, optimize, and prepare for production

### 6.1 Extension Cleanup

Remove from extension:
```
src/components/features/
├── onboarding/          # DELETE entire folder
├── settings/            # DELETE entire folder (keep minimal redirect)
├── help/
│   ├── ProviderSetup.tsx    # DELETE
│   ├── Troubleshooting.tsx  # DELETE
│   └── Features.tsx         # DELETE
└── reminders/           # DELETE entire folder
```

### 6.2 Extension Entry Points

Simplify side panel to have buttons that open website:

```tsx
// Simplified extension UI
<Button onClick={() => openWebsite('/settings')}>Settings</Button>
<Button onClick={() => openWebsite('/reminders')}>Reminders</Button>
<Button onClick={() => openWebsite('/troubleshooting')}>Help</Button>
```

### 6.3 Website Production Setup

- [ ] Deploy to production domain (TBD)
- [ ] Update extension ID in environment
- [ ] SSL/HTTPS required
- [ ] Error tracking (Sentry)
- [ ] Analytics (privacy-respecting)

### 6.4 Deliverables

- [ ] Extension code cleanup complete
- [ ] Website deployed to production
- [ ] End-to-end testing
- [ ] Documentation updated
- [ ] Migration complete announcement

---

## Shared Types Package (`@cognito/shared`)

**This package WILL be created** for type safety between extension and webapp.

```
packages/
  shared/
    ├── src/
    │   ├── messaging.types.ts    # External messaging API types
    │   ├── settings.types.ts     # All settings interfaces
    │   ├── providers.types.ts    # AI provider configuration
    │   ├── reminders.types.ts    # Reminder data structures
    │   ├── storage.types.ts      # Storage key schemas
    │   └── index.ts              # Barrel export
    ├── package.json
    └── tsconfig.json
```

**File**: `packages/shared/package.json`
```json
{
  "name": "@cognito/shared",
  "version": "0.1.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

**Usage in extension:**
```typescript
import { ExternalMessage, SettingsState } from '@cognito/shared';
```

**Usage in webapp:**
```typescript
import { ExternalMessage, SettingsState } from '@cognito/shared';
```

pnpm will auto-link the workspace package - no manual linking needed.

---

## Timeline Summary

| Phase | Duration | Key Deliverable |
|-------|----------|-----------------|
| Phase 1: Foundation | 1 week | External messaging working |
| Phase 2: Onboarding | 1 week | Onboarding on website |
| Phase 3: Providers | 1 week | Provider setup on website |
| Phase 4: Settings | 2 weeks | All settings on website |
| Phase 5: Reminders & Help | 1 week | Reminders, help on website |
| Phase 6: Polish | 1 week | Production ready |

**Total: ~7 weeks**

---

## Risk Mitigation

### Risk 1: Extension Not Installed

**Solution**: Website detects if extension is installed. If not, show install prompt with link to Chrome Web Store.

```tsx
const { isInstalled } = useExtension();

if (!isInstalled) {
  return <InstallExtensionPrompt />;
}
```

### Risk 2: Extension Updates Break Messaging

**Solution**: Version the messaging API. Include version in PING response, handle graceful degradation.

### Risk 3: Extension ID Management (Pre-Publication)

**Current State**: Extension is under development, not yet on Chrome Web Store.

**Solution**: 
- Development: Use auto-generated extension ID (changes per build unless pinned)
- For testing webapp ↔ extension communication, pin the extension ID in development
- When published to Chrome Web Store, use the stable production ID

### Risk 4: CORS / Security Issues

**Solution**: 
- Always use HTTPS in production
- Whitelist only exact origins
- Validate all incoming messages

---

## Migration Checklist

### Pre-Migration
- [ ] Backup current extension state handling
- [ ] Document all storage keys and their schemas
- [ ] Set up development environment for webapp

### During Migration
- [ ] Feature flag for gradual rollout
- [ ] A/B test old vs new flows
- [ ] Monitor error rates

### Post-Migration
- [ ] Remove deprecated code
- [ ] Update user documentation
- [ ] Announce changes to users

---

## Resolved Decisions

| Question | Decision |
|----------|----------|
| Domain | TBD - using `localhost:3002` for development |
| Extension ID | Under development, not published yet |
| Shared types | ✅ Creating `@cognito/shared` package |
| Dev port | `3002` for webapp dev server |
| Settings UI | Single `/settings` page with smooth toggles |
| Routes | `/onboarding`, `/providers`, `/settings`, `/reminders`, `/features`, `/troubleshooting`, `/changelog` |

## Open Questions

1. **Authentication**: Any user accounts planned? (affects architecture)
2. **Hosting**: Vercel for webapp? (already have `backend-vercel`)
3. **Final domain**: `app.cognito.ai` or alternative?

---

## Next Steps

1. **Phase 1**: Start with foundation work
2. **Create `@cognito/shared` package** in monorepo
3. **Create webapp package** with Next.js 16 on port 3002
4. **Implement external messaging** in extension
5. **Test extension ↔ webapp communication** locally
