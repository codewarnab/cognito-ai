# Setup Guide

This guide will help you set up the Cognito AI monorepo development environment.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **pnpm** (v8 or higher)
- **Google Chrome** browser

## Monorepo Structure

```
cognito-ai/
├── apps/
│   ├── extension/          # @cognito/extension - Chrome Extension (WXT + React 19)
│   ├── webapp/             # @cognito/webapp - Next.js UI pages
│   └── docs/               # @cognito/docs - Documentation site (Fumadocs)
├── packages/
│   ├── shared/             # @cognito/shared - Shared types and constants
│   ├── backend-cloudflare/ # @cognito/backend-cloudflare - ElevenLabs proxy
│   └── backend-vercel/     # @cognito/backend-vercel - AI Chat & YouTube transcript API
└── package.json            # Root configuration
```

## Installation Steps

### 1. Clone the Repository

```bash
git clone https://github.com/codewarnab/cognito-ai.git
cd cognito-ai
```

### 2. Install Dependencies

```bash
pnpm install
```

This will install all dependencies for all workspaces in the monorepo.

### 3. Environment Configuration

#### Extension Environment

Copy the example file and configure:

```bash
cp apps/extension/.env.example apps/extension/.env
```

Key variables:

| Variable | Description |
|----------|-------------|
| `WXT_BACKEND_API_URL` | Backend API endpoint (Vercel) |
| `WXT_WEBAPP_URL` | Webapp URL for settings pages |
| `WXT_ELEVENLABS_WORKER_URL` | ElevenLabs Worker URL (Cloudflare) |
| `WXT_TRANSCRIPT_API_URL` | YouTube transcript API |
| `WXT_LOG_PRESET` | Logging level (`DEVELOPMENT`, `PRODUCTION`, etc.) |
| `WXT_HIDE_LOCAL_MODE` | Hide Chrome AI/local mode UI (`true`/`false`) |

### 4. Development Setup

#### Start the Extension Development Server

```bash
pnpm dev
```

This command will:
- Start the WXT development server with hot reload
- Build the extension in development mode
- Watch for file changes

#### Start the Webapp Development Server

```bash
pnpm dev:webapp
```

#### Start All Development Servers

```bash
pnpm dev:all
```

#### First-time Assets Setup

```bash
pnpm --filter @cognito/extension dev:setup
```

Run once to copy offscreen/audio assets required by the extension. If you skip this, some assets may be missing on first run.

#### Load the Extension in Chrome

1. Open Google Chrome
2. Navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked**
5. Select the `apps/extension/dist/chrome-mv3` directory from the project root

The extension should now be loaded and ready for development!

#### Type Checking

```bash
pnpm type:check
```

Run before commits to ensure the project passes TypeScript checks.

### 5. Making Changes

- **Sidepanel UI**: Edit files in `apps/extension/src/entrypoints/sidepanel/`
- **Background Script**: Edit `apps/extension/src/entrypoints/background/`
- **Content Scripts**: Edit files in `apps/extension/src/entrypoints/contents/`
- **Webapp Pages**: Edit files in `apps/webapp/src/app/`
- **Shared Types**: Edit files in `packages/shared/src/`

The extension will auto-reload when you make changes to source files.

## Building for Production

### Build All Packages

```bash
pnpm build
```

### Build Extension Only

```bash
pnpm build:extension
```

The production-ready extension will be available in the `apps/extension/dist/chrome-mv3` directory.

## Deploy Backend Services

### Backend Vercel (AI Chat + YouTube Transcripts)

```bash
cd packages/backend-vercel

# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy to production
vercel --prod
```

**Required Environment Variables** (set in Vercel dashboard):

| Variable | Description |
|----------|-------------|
| `GOOGLE_AI_API_KEY` | Google AI API key for chat endpoints |
| `SUPADATA_API_KEY` | Supadata API key for YouTube transcripts |
| `JINA_API_KEY` | (Optional) Jina API key for URL retrieval |
| `TAVILY_API_KEY` | (Optional) Tavily API key for web search |
| `UPSTASH_REDIS_REST_URL` | (Optional) Redis for rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | (Optional) Redis token |

**Endpoints exposed:**

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/ai/chat-with-tools` | Main AI chat with tools |
| `POST` | `/api/ai/write` | AI writing |
| `POST` | `/api/ai/summarize` | Text summarization |
| `POST` | `/simple-transcript` | YouTube transcripts |
| `GET` | `/health` | Health check |

### Backend Cloudflare (ElevenLabs Proxy)

```bash
cd packages/backend-cloudflare

# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Set secrets
wrangler secret put ELEVENLABS_API_KEY

# Deploy
pnpm deploy
```

**Endpoints exposed:**

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/signed-url` | Signed URL for voice conversations |
| `GET` | `/api/voices` | List available voices |
| `POST` | `/api/text-to-speech` | Text-to-speech streaming |

### Update Extension to Use Your Deployments

After deploying backends, update your `apps/extension/.env`:

```env
WXT_BACKEND_API_URL=https://your-backend.vercel.app
WXT_ELEVENLABS_WORKER_URL=https://your-worker.workers.dev
```

Then rebuild the extension and reload it in Chrome.

## Package-Specific Commands

```bash
# Extension
pnpm --filter @cognito/extension dev
pnpm --filter @cognito/extension build

# Webapp
pnpm --filter @cognito/webapp dev
pnpm --filter @cognito/webapp build

# Shared package
pnpm --filter @cognito/shared build

# Backend Cloudflare
pnpm --filter @cognito/backend-cloudflare deploy

# Backend Vercel
pnpm --filter @cognito/backend-vercel build
```

## Troubleshooting

### Extension Not Loading

- Make sure you've run `pnpm dev` first
- Check that the `apps/extension/dist/chrome-mv3` directory exists
- Try disabling and re-enabling the extension in Chrome

### Build Errors

```bash
# Clear build caches
rm -rf apps/extension/dist/ apps/extension/.wxt/

# Reinstall dependencies
pnpm install

# Restart development server
pnpm dev
```

### Hot Reload Not Working

- Reload the extension manually in `chrome://extensions/`
- Restart the development server

### Shared Package Changes Not Reflected

```bash
# Rebuild shared package
pnpm --filter @cognito/shared build

# Restart dependent dev servers
pnpm dev
```

## Additional Resources

- [WXT Documentation](https://wxt.dev/)
- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
- [Project README](./README.md)
- [Monorepo Architecture](./MONOREPO.md)
- [Contributing Guidelines](./CONTRIBUTING.md)

## Support

If you encounter any issues during setup, please:
1. Check the [existing issues](https://github.com/codewarnab/cognito-ai/issues)
2. Create a new issue with details about your problem
3. Include your environment information (OS, Node version, pnpm version)
