# Cognito Docs - AI Agents Guide

This document helps AI coding assistants understand the documentation site codebase.

## Overview

**@cognito/docs** is the documentation site for Cognito AI, built with [Fumadocs](https://fumadocs.vercel.app) and **Next.js**. It serves as the primary resource for users and contributors.

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Next.js | React framework |
| Fumadocs | Documentation framework |
| MDX | Content format |
| Tailwind CSS | Styling |
| TypeScript | Type safety |

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
│   ├── app/               # Next.js App Router
│   │   ├── layout.tsx     # Root layout
│   │   ├── global.css     # Global styles
│   │   ├── (home)/        # Landing page
│   │   ├── docs/          # Docs layout
│   │   ├── api/           # API routes
│   │   ├── og/            # OG image generation
│   │   └── llms.mdx/      # LLM-friendly output
│   ├── components/
│   │   └── diagrams/      # Custom diagram components
│   ├── lib/
│   │   ├── source.ts      # Fumadocs source config
│   │   └── layout.shared.tsx
│   └── mdx-components.tsx # MDX component registry
├── public/                # Static assets
├── source.config.ts       # Fumadocs MDX config
├── next.config.mjs        # Next.js config
├── tsconfig.json          # TypeScript config
└── package.json
```

## Development Commands

```bash
# From monorepo root
pnpm dev:docs              # Start docs dev server (port 3003)
pnpm build                 # Build all packages

# From docs directory
cd apps/docs
pnpm dev                   # Start dev server
pnpm build                 # Build for production
pnpm types:check           # Type check
```

## Key Conventions

### MDX Content

All documentation lives in `content/docs/` as MDX files.

**Frontmatter:**
```mdx
---
title: Page Title
description: Brief description for SEO
---
```

**Navigation:** Defined in `meta.json` files within each folder.

### Code Blocks

Use `bash` for shell commands (not `env` - unsupported by Shiki). Add titles with metadata:

````md
```bash title="Terminal"
pnpm install
```
````

### Callouts

Use Fumadocs `<Callout>` component (NOT GitHub-style `> [!NOTE]`):

```mdx
<Callout>General tip or info.</Callout>
<Callout type="warn">Important note.</Callout>
<Callout type="error">Critical warning.</Callout>
<Callout title="Custom Title">With custom title.</Callout>
```

### Images

Use `<ImageZoom>` for all images (diagrams, screenshots, architecture):

```mdx
import { ImageZoom } from 'fumadocs-ui/components/image-zoom';

<ImageZoom src="/architecture-diagram.png" alt="Architecture" width={800} height={500} />
```

Images go in `public/` and are referenced with a leading `/`.

### File Trees

Use `<Files>`, `<Folder>`, `<File>` components for directory structures:

```mdx
import { File, Folder, Files } from 'fumadocs-ui/components/files';

<Files>
  <Folder name="src" defaultOpen>
    <Folder name="components">
      <File name="Button.tsx" />
    </Folder>
    <File name="index.ts" />
  </Folder>
</Files>
```

### Sequence Diagrams

Use React components from `src/components/diagrams/` (NOT Mermaid):

```mdx
import { ServerToolsSequence } from '@/components/diagrams/ServerToolsSequence';

<ServerToolsSequence />
```

Available diagram components:
- `ServerToolsSequence`
- `StdioMcpSequence`
- `OAuthFlowSequence`
- `McpOAuthSequence`
- `McpToolApprovalSequence`
- `McpToolExecutionSequence`
- `McpConnectionStatesDiagram`
- `BackendModeSequence`
- `ByokFlowSequence`
- `WebMcpDiscoverySequence`
- `WebMcpExecutionSequence`
- And more in `src/components/diagrams/`

## Path Aliases

```typescript
// Available alias
import { Component } from '@/components/Component';
```

| Alias | Maps To |
|-------|---------|
| `@/*` | `./src/*` |

## Style Guide

Follow the guidelines in `STYLE_GUIDE.md`:

- **Simple words**: Use "use" not "utilize", "help" not "facilitate"
- **No filler**: Remove "you can", "please", "you may"
- **Subject first**: Place subject at beginning of sentences
- **Short paragraphs**: Max 10-12 words per line, 9 lines per paragraph
- **Use tables**: For conditions and properties
- **Bold for skimming**: Emphasize important terms
- **More headings**: Provide anchors and structure

## MDX Components Registry

Components available in MDX files (see `src/mdx-components.tsx`):

- `Callout` - Notes, tips, warnings
- `ImageZoom` - Zoomable images (use for ALL images)
- `Tab`, `Tabs` - Tabbed content
- `Accordion`, `Accordions` - Collapsible sections
- `File`, `Folder`, `Files` - File tree displays
- All diagram components from `@/components/diagrams/`

## Adding New Pages

1. Create MDX file in appropriate `content/docs/` subfolder
2. Add frontmatter with `title` and `description`
3. Update `meta.json` in the folder to include the page
4. Run `pnpm dev` to preview

## Adding Diagram Components

1. Create React component in `src/components/diagrams/`
2. Export from the component file
3. Import and add to `src/mdx-components.tsx` registry
4. Use in MDX files with import

## Key Files

| File | Purpose |
|------|---------|
| `source.config.ts` | Fumadocs collection config |
| `next.config.mjs` | Next.js and MDX config |
| `src/mdx-components.tsx` | MDX component registry |
| `src/lib/source.ts` | Source loader and helpers |
| `content/docs/meta.json` | Root navigation structure |
| `STYLE_GUIDE.md` | Writing and formatting guidelines |

## Related Documentation

- [STYLE_GUIDE.md](./STYLE_GUIDE.md) - Writing guidelines
- [Fumadocs Docs](https://fumadocs.vercel.app) - Framework documentation
- Root [AGENTS.md](../../AGENTS.md) - Monorepo overview
