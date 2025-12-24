<div align="center">

<img src="https://r4zpqlqnbh83sjwi.public.blob.vercel-storage.com/logo.png" alt="Cognito Logo" width="200"/>

# Cognito: Your AI Browser Agent

**Super powerful and private AI assistant directly in your browser**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Version](https://img.shields.io/badge/version-0.0.1-blue.svg)](./package.json)
[![Built with WXT](https://img.shields.io/badge/built%20with-WXT-blueviolet)](https://wxt.dev/)

[Features](#features) • [Installation](#installation) • [Usage](#usage) • [Development](#development) • [Contributing](#contributing) • [License](#license)

</div>

---

## Features

Cognito is an intelligent browser agent that brings the power of AI directly into your Chrome browser:

- **AI-Powered Assistance**: Integrated with Google's Generative AI (Gemini 2.5) and Vercel AI SDK
- **Privacy-First**: Your data stays in your browser with local memory (Dexie.js)
- **Voice Mode**: Real-time voice interaction powered by ElevenLabs
- **Research Workflow**: Agentic workflow for deep web research and report generation
- **Smart Actions**: Automate browser tasks with AI-driven workflows
- **Side Panel Chat**: Quick access to AI chat with `Ctrl+Shift+H` (or `Cmd+Shift+H` on Mac)
- **Model Context Protocol**: Extensible AI capabilities connecting to local and remote tools
- **Beautiful UI**: Modern interface with enhanced visuals, glassmorphism, and animations
- **Fast & Efficient**: Optimized performance with local caching and split-execution strategies

## Installation

### For Developers

See [SETUP.md](./SETUP.md) for detailed development setup instructions.

## Usage

### Opening Cognito

- **Keyboard Shortcut**: Press `Ctrl+Shift+H` (Windows/Linux) or `Cmd+Shift+H` (Mac)
- **Extension Icon**: Click the Cognito icon in your Chrome toolbar
- **Side Panel**: Open from Chrome's side panel menu

### Basic Features

1. **AI Chat**: Ask questions and get intelligent responses via text or voice
2. **Web Automation**: Automate repetitive browser tasks
3. **Research Agent**: Perform deep research on topics with automated browsing and citation
4. **Content Analysis**: Analyze web pages and extract information
5. **Memory Management**: Save and retrieve important information
6. **Tab Management**: Organize and manage your browser tabs efficiently

## Development

This is a **pnpm monorepo** containing the Chrome extension, documentation site, and backend services.

### Prerequisites

- Node.js v18 or higher
- pnpm v8 or higher
- Google Chrome

### Quick Start

```bash
# Install all dependencies
pnpm install

# Start extension development server
pnpm dev

# Start docs development server
pnpm dev:docs

# Start all packages in parallel
pnpm dev:all

# Build all packages
pnpm build

# Build extension only
pnpm build:extension
```

### Development Build

1. Run `pnpm dev`
2. Load the extension from `apps/extension/build/chrome-mv3-dev` in Chrome
3. Make changes - the extension will auto-reload

### Production Build

```bash
pnpm build
```

The production bundle will be in `apps/extension/build/chrome-mv3-prod/`.

### Package-Specific Commands

```bash
# Work with specific packages
pnpm --filter @cognito/extension dev
pnpm --filter @cognito/docs dev
pnpm --filter @cognito/backend-cloudflare deploy

# Add dependencies to specific package
pnpm --filter @cognito/extension add react-query

# Add dev dependencies to root
pnpm add -D -w typescript-eslint
```

### Submit to the Webstores

To submit your extension to the web stores, build your extension and upload it to the store. For automated submission, you can set up GitHub Actions to publish your extension automatically.

### Project Structure

```
cognito-ai/
├── apps/
│   ├── extension/              # @cognito/extension - Chrome Extension (WXT)
│   │   ├── src/
│   │   │   ├── entrypoints/    # WXT entrypoints
│   │   │   │   ├── sidepanel/  # Main side panel React app
│   │   │   │   ├── background/ # Background Service Worker
│   │   │   │   └── contents/   # Content scripts
│   │   │   ├── stores/         # Zustand state management
│   │   │   ├── ai/             # AI integration (Vercel AI SDK v6)
│   │   │   ├── actions/        # Browser automation actions
│   │   │   ├── components/     # React components
│   │   │   ├── mcp/            # Model Context Protocol client
│   │   │   ├── db/             # Local database (Dexie/IndexedDB)
│   │   │   └── workflows/      # Automation workflows
│   │   ├── assets/             # Icons and graphics
│   │   └── build/              # Build output
│   └── docs/                   # @cognito/docs - Documentation site (Next.js + Fumadocs)
├── packages/
│   ├── backend-cloudflare/     # @cognito/backend-cloudflare - ElevenLabs proxy (CF Workers)
│   └── backend-vercel/         # @cognito/backend-vercel - AI Chat Backend + YouTube transcripts (Express)
└── [root config files]         # pnpm-workspace.yaml, turbo.json, etc.
```

## Configuration

### Permissions

Cognito requires the following permissions:

- `storage`, `unlimitedStorage` - Store data locally
- `tabs`, `tabGroups` - Manage browser tabs
- `sidePanel` - Display AI chat in side panel
- `scripting`, `activeTab` - Interact with web pages
- `webNavigation` - Track navigation
- `history`, `bookmarks` - Access browsing data
- `notifications` - Show notifications

### API Keys

For AI features, you may need to configure API keys in the extension options.

## Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

### Quick Contribution Steps

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Documentation

- [Setup Guide](./SETUP.md) - Detailed setup instructions
- [Monorepo Guide](./MONOREPO.md) - Architecture, deployment, and migration guides
- [Contributing Guide](./CONTRIBUTING.md) - How to contribute
- [AI Agents Guide](./AGENTS.md) - Navigation guide for AI coding assistants
- [WXT Documentation](https://wxt.dev/) - Framework documentation
- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/) - Chrome API reference

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## Acknowledgments

- Built with [WXT](https://wxt.dev/)
- Powered by [Google Generative AI](https://ai.google.dev/) & [Vercel AI SDK](https://sdk.vercel.ai/docs)
- Voice by [ElevenLabs](https://elevenlabs.io/)
- UI components from [Radix UI](https://www.radix-ui.com/)
- Icons from [Lucide](https://lucide.dev/)

## Support

- [Report a Bug](https://github.com/codewarnab/cognito-ai/issues/new?template=bug_report.md)
- [Request a Feature](https://github.com/codewarnab/cognito-ai/issues/new?template=feature_request.md)
- [Discussions](https://github.com/codewarnab/cognito-ai/discussions)

---

<div align="center">


Star this repo if you find it useful!

</div>
