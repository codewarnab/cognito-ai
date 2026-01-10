# MDX Content Standards

## File Structure
- All documentation lives in `content/docs/` as MDX files
- Navigation defined in `meta.json` files within each folder
- Frontmatter required: `title` and `description`

## Code Blocks
- **CRITICAL**: Use `bash` for shell commands; `env` is NOT supported by Shiki
- Add titles with `title="filename"` attribute
- Use proper language identifiers: `typescript`, `bash`, `json`, `mdx`

## Callouts
- Use `<Callout>` component from Fumadocs
- Types: `info` (default), `warn`, `error`
- Do NOT use GitHub-style alerts (`> [!NOTE]`, `> [!TIP]`)
- Do NOT put redundant titles when type already displays one

```mdx
<Callout>General information.</Callout>
<Callout type="warn">Important warning.</Callout>
<Callout type="error">Critical error.</Callout>
<Callout title="Custom">Custom titled callout.</Callout>
```

## Images
- Use `<ImageZoom>` for **all images** (diagrams, screenshots, architecture)
- Images go in `public/` directory
- Reference with leading `/` (e.g., `/diagram.png`)
- Include `alt`, `width`, and `height` attributes

```mdx
import { ImageZoom } from 'fumadocs-ui/components/image-zoom';

<ImageZoom src="/image.png" alt="Description" width={800} height={500} />
```

## File Trees
- Use `<Files>`, `<Folder>`, `<File>` for directory structures
- Add `defaultOpen` to folders that should be expanded

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

## Sequence Diagrams
- **CRITICAL**: Use React components from `src/components/diagrams/`
- Do NOT use Mermaid syntax
- Do NOT use images for diagrams that can be components

```mdx
import { ServerToolsSequence } from '@/components/diagrams/ServerToolsSequence';

<ServerToolsSequence />
```

## Component Registry
Available components in MDX (from `src/mdx-components.tsx`):
- `Callout` - Notes, tips, warnings
- `ImageZoom` - Zoomable images (use for ALL images)
- `Tab`, `Tabs` - Tabbed content
- `Accordion`, `Accordions` - Collapsible sections
- `File`, `Folder`, `Files` - File tree displays
- All diagram components from `@/components/diagrams/`
