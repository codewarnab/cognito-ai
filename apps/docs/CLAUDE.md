# Cognito Docs - Claude Guide

This document helps Claude understand the documentation site codebase.

## Overview

**@cognito/docs** is the documentation site for Cognito AI, built with [Fumadocs](https://fumadocs.vercel.app) and **Next.js**. It provides user guides, architecture documentation, and contributor resources.

## Tech Stack

- **Framework**: Next.js with App Router
- **Documentation**: Fumadocs (MDX-based)
- **Styling**: Tailwind CSS
- **Language**: TypeScript

## Project Structure

```text
apps/docs/
├── content/
│   └── docs/              # MDX documentation files
│       ├── index.mdx      # Landing page
│       ├── meta.json      # Navigation structure
│       ├── getting-started/
│       ├── using-cognito/
│       ├── integrations/
│       ├── configuration/
│       ├── architecture/
│       ├── security/
│       ├── troubleshooting/
│       ├── faq/
│       ├── contributing/
│       └── reference/
├── src/
│   ├── app/               # Next.js App Router pages
│   │   ├── layout.tsx     # Root layout
│   │   ├── global.css     # Global styles
│   │   ├── (home)/        # Landing page route
│   │   ├── docs/          # Documentation pages
│   │   ├── api/           # API routes
│   │   ├── og/            # OG image generation
│   │   └── llms.mdx/      # LLM-friendly MDX output
│   ├── components/
│   │   └── diagrams/      # Custom React diagram components
│   ├── lib/
│   │   ├── source.ts      # Fumadocs source configuration
│   │   └── layout.shared.tsx
│   └── mdx-components.tsx # MDX component registry
├── public/                # Static assets (images, etc.)
├── source.config.ts       # Fumadocs MDX configuration
├── next.config.mjs        # Next.js configuration
├── tsconfig.json          # TypeScript configuration
└── package.json
```

## Development

```bash
# From monorepo root
pnpm dev:docs              # Start docs dev server (port 3003)

# From docs directory
cd apps/docs
pnpm dev                   # Start dev server
pnpm build                 # Build for production
pnpm types:check           # Type check
```

## Key Conventions

### Code Blocks

**CRITICAL**: Use `bash` for shell commands. `env` is NOT supported by Shiki.

Add titles with metadata attribute:

````md
```bash title="Terminal"
pnpm install
```
````

### Callouts

**CRITICAL**: Use Fumadocs `<Callout>` component. Do NOT use GitHub-style alerts (`> [!NOTE]`).

```mdx
<Callout>General information.</Callout>
<Callout type="warn">Important warning.</Callout>
<Callout type="error">Critical error.</Callout>
<Callout title="Custom Title">Custom titled callout.</Callout>
```

Do NOT put redundant titles like `title="Note"` when type already displays one.

### Images

Use `<ImageZoom>` for **all images** (diagrams, screenshots, architecture):

```mdx
import { ImageZoom } from 'fumadocs-ui/components/image-zoom';

<ImageZoom src="/diagram.png" alt="Description" width={800} height={500} />
```

Images go in `public/` directory, referenced with leading `/`.

### File Trees

Use `<Files>`, `<Folder>`, `<File>` for directory structures:

```mdx
import { File, Folder, Files } from 'fumadocs-ui/components/files';

<Files>
  <Folder name="src" defaultOpen>
    <File name="index.ts" />
  </Folder>
</Files>
```

### Sequence Diagrams

**CRITICAL**: Use custom React components from `src/components/diagrams/`. Do NOT use Mermaid syntax. Do NOT use images for diagrams that can be components.

```mdx
import { ServerToolsSequence } from '@/components/diagrams/ServerToolsSequence';

<ServerToolsSequence />
```

Available components:
- `ServerToolsSequence`, `StdioMcpSequence`, `OAuthFlowSequence`
- `McpOAuthSequence`, `McpToolApprovalSequence`, `McpToolExecutionSequence`
- `McpConnectionStatesDiagram`, `BackendModeSequence`, `ByokFlowSequence`
- `WebMcpDiscoverySequence`, `WebMcpExecutionSequence`, `WebMCPMessageSequence`
- `WebMcpApprovalSequence`, `WebMcpTransportSequence`, `WebMcpValidationFlow`
- `MemoryExtractionSequence`, `MessageFlowSequence`, `MindMap`, `QuadrantChart`

## Path Aliases

```typescript
import { Component } from '@/components/Component';
```

| Alias | Maps To |
|-------|---------|
| `@/*` | `./src/*` |

## MDX Components

All available in MDX (registered in `src/mdx-components.tsx`):

- `Callout` - Notes, tips, warnings
- `ImageZoom` - Zoomable images (use for ALL images)
- `Tab`, `Tabs` - Tabbed content
- `Accordion`, `Accordions` - Collapsible sections
- `File`, `Folder`, `Files` - File tree displays
- All diagram components

## Writing Style

Follow `STYLE_GUIDE.md`:

| Don't | Do |
|-------|-----|
| utilize, leverage | use |
| facilitate | help |
| "Please don't..." | "Don't..." |
| "You can configure..." | "Configure..." |
| Long paragraphs | Max 10-12 words/line |
| `> [!NOTE]` | `<Callout>` |

## Adding Content

### New Page

1. Create MDX file in `content/docs/[section]/`
2. Add frontmatter:
   ```mdx
   ---
   title: Page Title
   description: Brief description
   ---
   ```
3. Update `meta.json` in folder to include page
4. Preview with `pnpm dev`

### New Diagram Component

1. Create component in `src/components/diagrams/`
2. Add to `src/mdx-components.tsx` registry
3. Import and use in MDX files

## Key Files

| File | Purpose |
|------|---------|
| `source.config.ts` | Fumadocs collection definition |
| `next.config.mjs` | Next.js + MDX configuration |
| `src/mdx-components.tsx` | MDX component registry |
| `src/lib/source.ts` | Source loader and helpers |
| `content/docs/meta.json` | Root navigation |
| `STYLE_GUIDE.md` | Writing guidelines |
| `GEMINI.md` | Additional standards |
