# Cognito (Chrome AI)

**Cognito** is a privacy-first, AI-powered Chrome extension built with the [Plasmo](https://docs.plasmo.com/) framework. It integrates Google's Generative AI directly into the browser via a side panel, allowing users to chat with AI, automate tasks, and manage browser context efficiently. A key architectural feature is its implementation of the **Model Context Protocol (MCP)**, enabling extensible connections to various AI capabilities and tools.

## Key Features

- **AI Side Panel:** Interactive chat interface accessible via `Ctrl+Shift+H` (or `Cmd+Shift+H`), built with React and Tailwind CSS.
- **Model Context Protocol (MCP):** Implements an MCP client (`src/mcp/`) to dynamically discover and connect to "MCP servers," extending the agent's capabilities (e.g., tool use, resource access).
- **Privacy-First Memory:** Uses `Dexie` (IndexedDB wrapper) to store user data and context locally within the browser (`src/memory/`), ensuring data privacy.
- **Workflow Automation:** Supports "Smart Actions" and workflows (`src/workflows/`, `src/actions/`) to automate browser tasks.
- **YouTube Integration:** Includes a dedicated companion service (`youtube-transcript-generator`) for fetching video transcripts.

## Technology Stack

- **Framework:** [Plasmo](https://docs.plasmo.com/) (Browser Extension Framework)
- **Frontend:** React 18, Tailwind CSS, Radix UI, Framer Motion, Lucide React.
- **AI/LLM:** Google Generative AI SDK (`@google/genai`), Vercel AI SDK (`ai`, `@ai-sdk/*`).
- **State/Storage:** Dexie (IndexedDB), Plasmo Storage (`@plasmohq/storage`).
- **Backend Logic:** Service Worker (`src/background.ts`) handling MCP connections, message passing, and long-running tasks.
- **External Service:** `youtube-transcript-generator` (Node.js/Express) for transcript fetching.

## Project Structure

```text
chrome-ai/
├── src/
│   ├── sidepanel.tsx       # Main UI entry point (React)
│   ├── background.ts       # Background Service Worker (Core logic, MCP)
│   ├── options.tsx         # Extension Options page
│   ├── actions/            # Browser automation actions
│   ├── ai/                 # AI model integration & prompts
│   ├── components/         # Reusable React UI components
│   ├── mcp/                # Model Context Protocol client implementation
│   ├── memory/             # Local database & memory management (Dexie)
│   └── workflows/          # Defined automation workflows
├── youtube-transcript-generator/ # Standalone Node.js service for transcripts
├── assets/                 # Static assets (icons, images)
├── build/                  # Output directory (dev/prod builds)
└── package.json            # Project dependencies & scripts
```

## Development Workflow

1.  **Install Dependencies:**
    ```bash
    pnpm install
    ```

2.  **Start Development Server:**
    ```bash
    pnpm dev
    ```
    - This builds the extension into `build/chrome-mv3-dev`.
    - Load this directory as an "Unpacked extension" in `chrome://extensions`.
    - Changes to `src/` will trigger auto-reloads.

3.  **Build for Production:**
    ```bash
    pnpm build
    ```
    - Output: `build/chrome-mv3-prod`.

## Key Commands

- `pnpm dev`: Start dev server with hot reload.
- `pnpm build`: Build production artifact.
- `pnpm package`: Package for store submission.
- `pnpm type:check`: Run TypeScript type checking.

## Important Notes

- **MCP Implementation:** The extension relies heavily on MCP for extensibility. Check `src/background.ts` and `src/mcp/` to understand how it manages connections and tools.
- **Permissions:** The `manifest` in `package.json` lists extensive permissions (`tabs`, `storage`, `activeTab`, `scripting`, etc.) required for its deep browser integration.
- **External Service:** The `youtube-transcript-generator` is a separate Node.js app. Ensure it is deployed or running if working on YouTube-related features.
