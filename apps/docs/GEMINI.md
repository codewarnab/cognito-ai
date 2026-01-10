# Cognito Docs

**@cognito/docs** is the documentation site for Cognito AI, built with [Fumadocs](https://fumadocs.vercel.app) and **Next.js**.

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Next.js | React framework (App Router) |
| Fumadocs | Documentation framework |
| MDX | Content format |
| Tailwind CSS | Styling |
| TypeScript | Type safety |

## Project Structure

```text
apps/docs/
├── content/docs/          # MDX documentation files
│   ├── index.mdx          # Landing page
│   ├── meta.json          # Navigation structure
│   └── [sections]/        # Topic folders
├── src/
│   ├── app/               # Next.js App Router
│   ├── components/diagrams/ # Custom diagram components
│   ├── lib/source.ts      # Fumadocs source config
│   └── mdx-components.tsx # MDX component registry
├── public/                # Static assets
├── source.config.ts       # Fumadocs MDX config
└── next.config.mjs        # Next.js config
```

## Development

```bash
pnpm dev:docs              # Start docs dev server (port 3003)
pnpm build                 # Build all packages
```

## Key Standards

### Code Blocks

- **CRITICAL**: Use `bash` for shell commands. `env` is NOT supported by Shiki.
- Add titles with `title="filename"` metadata.

````md
```bash title="Terminal"
pnpm install
```
````

### Callouts

Use `<Callout>` component (NOT GitHub `> [!NOTE]` alerts):

```mdx
<Callout>General tip or info.</Callout>
<Callout type="warn">Important note.</Callout>
<Callout type="error">Critical warning.</Callout>
<Callout title="Custom Title">With custom title.</Callout>
```

Do NOT put redundant titles like `title="Note"` when type already shows one.

### Sequence Diagrams

**CRITICAL**: Use React components from `src/components/diagrams/`. Do NOT use Mermaid.

```mdx
import { ServerToolsSequence } from '@/components/diagrams/ServerToolsSequence';

<ServerToolsSequence />
```

Available: `ServerToolsSequence`, `StdioMcpSequence`, `OAuthFlowSequence`, `McpOAuthSequence`, `McpToolApprovalSequence`, `McpToolExecutionSequence`, `McpConnectionStatesDiagram`, `BackendModeSequence`, `ByokFlowSequence`, `WebMcpDiscoverySequence`, `WebMcpExecutionSequence`, and more.

### Images

Use `<ImageZoom>` for all images (diagrams, screenshots, architecture):

```mdx
import { ImageZoom } from 'fumadocs-ui/components/image-zoom';

<ImageZoom src="/diagram.png" alt="Description" width={800} height={500} />
```

Images go in `public/`, referenced with leading `/`.

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

## Writing Style

Follow `STYLE_GUIDE.md`:

| Don't | Do |
|-------|-----|
| utilize, leverage | use |
| facilitate | help |
| "Please..." | Direct instruction |
| "You can..." | Direct instruction |
| Long paragraphs | Max 10-12 words/line |

## Path Aliases

```typescript
import { Component } from '@/components/Component';
```

## Adding Content

1. Create MDX in `content/docs/[section]/`
2. Add frontmatter: `title`, `description`
3. Update `meta.json` in folder
4. Preview with `pnpm dev`

## MDX Components

Available in MDX (see `src/mdx-components.tsx`):
- `Callout`, `ImageZoom`, `Tab`, `Tabs`, `Accordion`, `Accordions`
- `File`, `Folder`, `Files` - File tree displays
- All diagram components from `@/components/diagrams/`

## Related Files

- `STYLE_GUIDE.md` - Full writing guidelines
- `AGENTS.md` - AI agent guide
- `CLAUDE.md` - Claude-specific guide