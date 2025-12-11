# Cognito AI Monorepo

This document describes the monorepo structure, development workflows, and migration guides for future architectural changes.

## Architecture Overview

```text
cognito-ai/
├── apps/
│   ├── extension/          # @cognito/extension - Chrome Extension (Plasmo)
│   └── docs/               # @cognito/docs - Documentation site (Next.js + Fumadocs)
├── packages/
│   ├── backend-cloudflare/ # @cognito/backend-cloudflare - ElevenLabs proxy (CF Workers)
│   └── backend-vercel/     # @cognito/backend-vercel - YouTube transcripts (Express)
├── pnpm-workspace.yaml     # Workspace package definitions
├── package.json            # Root scripts and monorepo config
└── MONOREPO.md            # This file
```

### Package Summary

| Package | Location | Deployment | Purpose |
|---------|----------|------------|---------|
| `@cognito/extension` | `apps/extension/` | Chrome Web Store | Main browser extension |
| `@cognito/docs` | `apps/docs/` | Vercel | Documentation website |
| `@cognito/backend-cloudflare` | `packages/backend-cloudflare/` | Cloudflare Workers | ElevenLabs TTS proxy |
| `@cognito/backend-vercel` | `packages/backend-vercel/` | Vercel | YouTube transcript API |

---

## Development Workflow

### Quick Start

```bash
# Install all dependencies
pnpm install

# Start extension development
pnpm dev

# Start docs development
pnpm dev:docs

# Start all packages in parallel
pnpm dev:all
```

### Package-Specific Commands

```bash
# Run command in specific package
pnpm --filter @cognito/extension dev
pnpm --filter @cognito/docs build
pnpm --filter @cognito/backend-cloudflare deploy

# Run command in all packages
pnpm -r build
pnpm -r type:check
```

### Adding Dependencies

```bash
# Add to specific package
pnpm --filter @cognito/extension add react-query

# Add dev dependency to root (for tooling)
pnpm add -D -w typescript-eslint
```

---

## Deployment

### Chrome Extension (`@cognito/extension`)

```bash
pnpm build:extension
pnpm package:extension
# Output: apps/extension/build/chrome-mv3-prod
```

### Documentation (`@cognito/docs`)

Deployed to Vercel. Configure in Vercel dashboard:
- **Root Directory**: `apps/docs`
- **Build Command**: `pnpm build`
- **Output Directory**: `.next`

### ElevenLabs Proxy (`@cognito/backend-cloudflare`)

```bash
cd packages/backend-cloudflare
wrangler deploy
# OR from root:
pnpm deploy:cloudflare
```

### YouTube Transcript API (`@cognito/backend-vercel`)

Deployed to Vercel. Configure in Vercel dashboard:
- **Root Directory**: `packages/backend-vercel`
- **Build Command**: `pnpm build` (or leave empty)
- **Output Directory**: (default)

---

## Migration Guides

> [!NOTE]
> These guides document how to perform common architectural changes in the future.

### 1. Merge Backends into One Service

**Scenario**: Combine `backend-cloudflare` and `backend-vercel` into a unified backend.

#### Option A: Merge into Cloudflare Workers

1. **Create unified backend package**:
   ```bash
   mkdir packages/backend
   cp -r packages/backend-cloudflare/* packages/backend/
   ```

2. **Add YouTube transcript logic to Cloudflare Worker**:
   ```typescript
   // packages/backend/src/index.ts
   // Add routes from backend-vercel's index.js
   if (url.pathname === '/api/transcript') {
     // Port Express logic to fetch Worker handler
   }
   ```

3. **Update extension to use new endpoint**:
   - Search for `youtube-transcript-generator-five.vercel.app` in extension
   - Replace with new Cloudflare Worker URL

4. **Update `host_permissions` in extension manifest**:
   ```json
   "host_permissions": [
     "https://your-worker.workers.dev/*",
     "<all_urls>"
   ]
   ```

5. **Remove old packages**:
   ```bash
   rm -rf packages/backend-vercel packages/backend-cloudflare
   ```

6. **Update pnpm-workspace.yaml**: No change needed (wildcard picks up new package)

#### Option B: Merge into Vercel (Express → Next.js API Routes)

See "Merge All Backends into Docs" below.

---

### 2. Merge All Backends into Docs (Next.js API Routes)

**Scenario**: Since `@cognito/docs` is Next.js, use its API routes to host all backend logic.

#### Steps

1. **Create API routes in docs**:
   ```bash
   mkdir -p apps/docs/src/app/api
   ```

2. **Port ElevenLabs proxy**:
   ```typescript
   // apps/docs/src/app/api/signed-url/route.ts
   export async function GET(request: Request) {
     const response = await fetch(
       `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${process.env.ELEVENLABS_AGENT_ID}`,
       { headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY! } }
     );
     const data = await response.json();
     return Response.json({ signedUrl: data.signed_url });
   }
   ```

3. **Port YouTube transcript API**:
   ```typescript
   // apps/docs/src/app/api/transcript/route.ts
   // Port logic from packages/backend-vercel/index.js
   ```

4. **Update extension endpoints**:
   - Replace worker URLs with `https://your-docs-site.vercel.app/api/...`

5. **Set environment variables in Vercel**:
   - `ELEVENLABS_API_KEY`
   - `ELEVENLABS_AGENT_ID`
   - `SUPADATA_API_KEY` (for YouTube transcripts)
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

6. **Remove backend packages**:
   ```bash
   rm -rf packages/backend-cloudflare packages/backend-vercel
   ```

7. **Update root package.json scripts**: Remove deploy commands.

> [!WARNING]
> **Considerations when merging backends to docs**:
> - Vercel has different cold start characteristics than CF Workers
> - Streaming responses work differently (CF Workers are better for WebSocket/streaming)
> - ElevenLabs signed URL endpoint may have CORS differences

---

### 3. Move Away from Cloudflare Workers

**Scenario**: Migrate `@cognito/backend-cloudflare` to another platform.

#### To Vercel Edge Functions

1. **Create new package or add to existing**:
   ```bash
   mkdir packages/backend-edge
   ```

2. **Convert Worker to Edge Function**:
   ```typescript
   // packages/backend-edge/api/signed-url.ts
   import { NextRequest } from 'next/server';

   export const config = { runtime: 'edge' };

   export default async function handler(req: NextRequest) {
     // Port logic from CF Worker
   }
   ```

3. **Deploy to Vercel**: Configure as serverless functions project.

#### To AWS Lambda@Edge / CloudFront Functions

1. **Convert to Lambda handler format**:
   ```typescript
   export const handler = async (event) => {
     // Port logic
     return {
       statusCode: 200,
       body: JSON.stringify({ signedUrl: '...' })
     };
   };
   ```

2. **Use AWS CDK or SAM for deployment**

#### To Deno Deploy

1. **Convert to Deno/Hono**:
   ```typescript
   import { Hono } from 'hono';
   const app = new Hono();
   app.get('/api/signed-url', async (c) => {
     // Port logic
   });
   Deno.serve(app.fetch);
   ```

---

### 4. Add Shared Package for Common Types

**Scenario**: Share TypeScript types/utilities between packages.

1. **Create shared package**:
   ```bash
   mkdir packages/shared
   cd packages/shared
   pnpm init
   ```

2. **Configure package.json**:
   ```json
   {
     "name": "@cognito/shared",
     "main": "./dist/index.js",
     "types": "./dist/index.d.ts",
     "scripts": {
       "build": "tsc",
       "dev": "tsc --watch"
     }
   }
   ```

3. **Add as dependency to other packages**:
   ```bash
   pnpm --filter @cognito/extension add @cognito/shared
   ```

4. **pnpm will automatically link workspace packages**.

---

### 5. Move Extension Out of Monorepo

**Scenario**: Extract extension to its own repository.

1. **Copy extension directory**:
   ```bash
   cp -r apps/extension /path/to/new-repo
   ```

2. **Update references**:
   - Remove workspace protocol from dependencies
   - Update import paths if using `@cognito/shared`

3. **Create new git history** (optional):
   ```bash
   git filter-repo --subdirectory-filter apps/extension
   ```

4. **Update monorepo**: Remove from `apps/` and update docs.

---

## Common Issues & Solutions

### "Cannot find module" after restructuring

```bash
# Clear node_modules and reinstall
pnpm clean
pnpm install
```

### Plasmo not finding files after move

Update paths in `apps/extension/tsconfig.json` if needed. Plasmo resolves relative to package root.

### Vercel build failing after restructure

Ensure **Root Directory** is set correctly in Vercel project settings:
- Docs: `apps/docs`
- Backend Vercel: `packages/backend-vercel`

### pnpm workspace linking issues

```bash
# Force workspace protocol resolution
pnpm install --force
```

---

## Future Considerations

- [ ] Add Turborepo for build caching (`turbo.json`)
- [ ] Add `packages/shared` for common types
- [ ] Add `packages/ui` for shared React components
- [ ] Consider Changesets for versioning
- [ ] Add GitHub Actions for CI/CD per package
