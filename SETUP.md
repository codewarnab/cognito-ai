# Setup Guide

This guide will help you set up the Chrome AI extension development environment.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **pnpm** (v8 or higher)
- **Google Chrome** browser

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

This will install all the necessary dependencies for the project and its workspaces.

### 3. Development Setup

#### Start the Development Server

```bash
pnpm dev
```

This command will:
- Start the development server with hot reload
- Build the extension in development mode
- Watch for file changes

#### First-time Assets Setup

```bash
pnpm --filter @cognito/extension dev:setup
```

Run once to copy offscreen/audio assets required by the extension.
If you skip this, some assets may be missing on first run.

#### Load the Extension in Chrome

1. Open Google Chrome
2. Navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked**
5. Select the `apps/extension/build/chrome-mv3-dev` directory from the project root

The extension should now be loaded and ready for development!

#### Type Checking

```bash
pnpm type:check
```

Run before commits to ensure the project passes TypeScript checks.

### 4. Making Changes

- **Sidepanel**: Edit `apps/extension/src/sidepanel.tsx`
- **Options Page**: Edit `apps/extension/src/options.tsx`
- **Background Script**: Edit `apps/extension/src/background.ts`
- **Content Scripts**: Edit files in `apps/extension/src/content/` or `apps/extension/src/contents/`

The extension will auto-reload when you make changes to the source files.

## Building for Production

To create a production build:

```bash
pnpm build
```

The production-ready extension will be available in the `apps/extension/build/chrome-mv3-prod` directory.

## Deploy the YouTube Transcript API (Vercel)

This project includes a small API for fetching YouTube transcripts located in `packages/backend-vercel`. Deploying it to Vercel is the quickest way to get a stable endpoint.

### Steps (Windows PowerShell)

```powershell
# 1) Go to the API folder
cd packages/backend-vercel

# 2) (Optional) Install Vercel CLI if you don't have it
npm install -g vercel

# 3) Login to Vercel (opens a browser flow)
vercel login

# 4) Deploy (accept prompts, then deploy to Production)
vercel --prod
```

Notes:
- The folder already has a `vercel.json` routing config and an `index.js` Express handler. No extra config needed.
- The API exposes `POST /simple-transcript` and `GET /health`.
- After deploy, Vercel will print your URL, e.g. `https://your-app-name.vercel.app`.

### Point the extension to your deployment

Edit `apps/extension/src/constants.ts` and set `TRANSCRIPT_API_URL` to your deployed URL with the endpoint path:

```
https://YOUR-VERCEL-URL/simple-transcript
```

Example change in `apps/extension/src/constants.ts`:
- From: the default hosted URL
- To: `https://your-app-name.vercel.app/simple-transcript`

You can verify the API quickly:

```powershell
# Health check
curl https://your-app-name.vercel.app/health

# Example transcript request
curl -X POST ^
	-H "Content-Type: application/json" ^
	-d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}' ^
	https://your-app-name.vercel.app/simple-transcript
```

Once updated, rebuild the extension (dev or prod) and reload it in Chrome.

## Project Structure

```
cognito-ai/
├── apps/
│   ├── extension/          # Chrome Extension (Plasmo)
│   │   ├── src/            # Extension source code
│   │   ├── assets/         # Icons and images
│   │   └── build/          # Build output
│   └── docs/               # Documentation site
├── packages/
│   ├── backend-cloudflare/ # ElevenLabs proxy
│   └── backend-vercel/     # YouTube transcript API
└── package.json            # Root configuration
```

## Environment Variables

Create a `.env` file in the root or specific package directories if you need to configure environment-specific variables.

## Troubleshooting

### Extension Not Loading

- Make sure you've run `pnpm dev` first
- Check that the `apps/extension/build/chrome-mv3-dev` directory exists
- Try disabling and re-enabling the extension in Chrome

### Build Errors

- Clear the build cache: `rm -rf apps/extension/build/ apps/extension/.plasmo/`
- Reinstall dependencies: `pnpm install`
- Restart the development server: `pnpm dev`

### Hot Reload Not Working

- Reload the extension manually in `chrome://extensions/`
- Restart the development server

## Additional Resources

- [Plasmo Documentation](https://docs.plasmo.com/)
- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
- [Project README](./README.md)
- [Contributing Guidelines](./CONTRIBUTING.md)

## Support

If you encounter any issues during setup, please:
1. Check the [existing issues](https://github.com/codewarnab/cognito-ai/issues)
2. Create a new issue with details about your problem
3. Include your environment information (OS, Node version, etc.)

