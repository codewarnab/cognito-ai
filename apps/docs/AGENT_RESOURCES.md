# Fumadocs Agent Resources

## Overview
Fumadocs is a documentation framework for Next.js App Router. It prioritizes **code over configuration**, offering a "headless" approach similar to Shadcn UI where you can customize components directly.

## Core Architecture
- **Server-First**: Built on React Server Components (RSC).
- **Packages**:
  - `fumadocs-core`: Headless UI logic and utilities.
  - `fumadocs-ui`: Default theme and pre-built components.
  - `fumadocs-mdx`: MDX content handling and processing.

## Key Documentation Links
Use these resources when implementing features:

### Essentials
- **Quick Start**: [https://fumadocs.dev/docs/ui](https://fumadocs.dev/docs/ui)
- **Page Conventions**: [https://fumadocs.dev/docs/ui/page-conventions](https://fumadocs.dev/docs/ui/page-conventions) (Slugs, Page Tree)
- **Markdown/MDX**: [https://fumadocs.dev/docs/ui/markdown](https://fumadocs.dev/docs/ui/markdown)

### UI & Customization
- **Components**: [https://fumadocs.dev/docs/ui/components](https://fumadocs.dev/docs/ui/components) (Callouts, Cards, etc.)
- **Theming**: [https://fumadocs.dev/docs/ui/theme](https://fumadocs.dev/docs/ui/theme)
- **Layouts**: [https://fumadocs.dev/docs/ui/layouts](https://fumadocs.dev/docs/ui/layouts)

### Advanced Features
- **Search**: [https://fumadocs.dev/docs/ui/search](https://fumadocs.dev/docs/ui/search)
- **Internationalization**: [https://fumadocs.dev/docs/ui/internationalization](https://fumadocs.dev/docs/ui/internationalization)
- **Static Build**: [https://fumadocs.dev/docs/ui/static-export](https://fumadocs.dev/docs/ui/static-export)

### Automation & Integrations
- **OpenAPI**: [https://fumadocs.dev/docs/ui/openapi](https://fumadocs.dev/docs/ui/openapi)
- **TypeScript**: [https://fumadocs.dev/docs/ui/typescript](https://fumadocs.dev/docs/ui/typescript)

## Implementation Notes for Agents
1. **Customization**: Prefer using the CLI to "fork" components if deep customization is needed, rather than fighting default styles.
2. **Routing**: Leverages Next.js App Router. Check `app/docs/[[...slug]]/page.tsx` for main doc rendering.
3. **Content**: Content is typically in `content/docs`.
4. **Configuration**: Look for `source.config.ts` for content source configuration.

## Page Conventions

### File Structure
- **Slugs**: Generated from file paths.
  - `content/docs/dir/page.mdx` -> `/docs/dir/page`
  - `content/docs/dir/index.mdx` -> `/docs/dir`
- **Grouping**: Use parentheses to group folders without affecting URL slugs.
  - `content/docs/(group)/page.mdx` -> `/docs/page`

### Frontmatter
Customize page metadata in MDX files:
```yaml
---
title: My Page
description: Page description
icon: HomeIcon
---
```

### Meta Files (`meta.json`)
Control folder structure and sidebar navigation. Place `meta.json` in the directory it configures.

```json
{
  "title": "Folder Name",
  "icon": "FolderIcon",
  "root": true, // Marks as root folder (Sidebar Tab)
  "pages": [
    "index",
    "getting-started",
    "---Separator---",
    "...folder", // Extract items from folder
    "..." // Rest of the items
  ]
}
```

### Internationalization (i18n)
- Append locale code to filenames: `page.cn.mdx`, `meta.cn.json`.
- Default locale does not require a suffix.

## Mermaid Integration
https://fumadocs.dev/docs/ui/markdown/mermaid
### Setup
1. **Install**: `pnpm add mermaid next-themes`
2. **Component**: Create `components/mdx/mermaid.tsx` (Client Component) to handle rendering and theme switching.
   - Use `mermaid.initialize` with `startOnLoad: false`.
   - Use `mermaid.render` to generate SVG.
3. **Register**: Add `Mermaid` to `mdx-components.tsx`.

### Usage
- **Direct Component**: `<Mermaid chart="graph TD; A-->B;" />`
- **Code Block**: Enable `remarkMdxMermaid` plugin in `source.config.ts` to support:
  ```mermaid
  graph TD;
    A-->B;
  ```

### Configuration (`source.config.ts`)
```ts
import { remarkMdxMermaid } from 'fumadocs-core/mdx-plugins';
import { defineConfig } from 'fumadocs-mdx/config';

export default defineConfig({
  mdxOptions: {
    remarkPlugins: [remarkMdxMermaid],
  },
});
```

## Feedback Integration
[Source](https://fumadocs.dev/docs/ui/feedback)

### Installation
`npx @fumadocs/cli@latest add feedback`

### Usage
Add `<Feedback />` to your docs page (e.g., `app/docs/[[...slug]]/page.tsx`).

```tsx
import { Feedback } from '@/components/feedback'; // Component created by CLI

<Feedback
  onRateAction={async (url, feedback) => {
    'use server';
    // Handle feedback (e.g., send to PostHog, GitHub Discussions)
  }}
/>
```

### Integrations
- **GitHub Discussions**: Requires GitHub App ID/Private Key. Creates discussions/comments based on feedback.
- **PostHog**: Capture events like `on_rate_docs`.

## Theming
[Source](https://fumadocs.dev/docs/ui/theme)

### Setup
Fumadocs UI uses Tailwind CSS (v4 supported). Import presets in your CSS file:

```css
@import 'tailwindcss';
@import 'fumadocs-ui/css/neutral.css'; /* or black, vitepress, dusk, catppuccin, ocean, purple, solar */
@import 'fumadocs-ui/css/preset.css';
```

### Shadcn UI Integration
Use the `shadcn` preset to inherit colors from your Shadcn theme:
```css
@import 'tailwindcss';
@import 'fumadocs-ui/css/shadcn.css';
@import 'fumadocs-ui/css/preset.css';
```

### Customization
Customize colors using CSS variables in `@theme` or `:root`.
- **Prefix**: `--color-fd-*` (e.g., `--color-fd-background`, `--color-fd-primary`).
- **Dark Mode**: Handled via `next-themes` and `.dark` class.

### Typography
Includes a built-in typography plugin (forked from Tailwind Typography). Adds `prose` class.
If using `@tailwindcss/typography`, configure it with a different class name to avoid conflicts.

## Components
[Source](https://fumadocs.dev/docs/ui/components)

To learn about a specific component, fetch the corresponding link below:

- **Accordion**: [https://fumadocs.dev/docs/ui/components/accordion](https://fumadocs.dev/docs/ui/components/accordion)
- **Auto Type Table**: [https://fumadocs.dev/docs/ui/components/auto-type-table](https://fumadocs.dev/docs/ui/components/auto-type-table)
- **Banner**: [https://fumadocs.dev/docs/ui/components/banner](https://fumadocs.dev/docs/ui/components/banner)
- **Code Block**: [https://fumadocs.dev/docs/ui/components/codeblock](https://fumadocs.dev/docs/ui/components/codeblock)
- **Code Block (Dynamic)**: [https://fumadocs.dev/docs/ui/components/dynamic-codeblock](https://fumadocs.dev/docs/ui/components/dynamic-codeblock)
- **Files**: [https://fumadocs.dev/docs/ui/components/files](https://fumadocs.dev/docs/ui/components/files)
- **GitHub Info**: [https://fumadocs.dev/docs/ui/components/github-info](https://fumadocs.dev/docs/ui/components/github-info)
- **Graph View**: [https://fumadocs.dev/docs/ui/components/graph-view](https://fumadocs.dev/docs/ui/components/graph-view)
- **Zoomable Image**: [https://fumadocs.dev/docs/ui/components/image-zoom](https://fumadocs.dev/docs/ui/components/image-zoom)
- **Inline TOC**: [https://fumadocs.dev/docs/ui/components/inline-toc](https://fumadocs.dev/docs/ui/components/inline-toc)
- **Steps**: [https://fumadocs.dev/docs/ui/components/steps](https://fumadocs.dev/docs/ui/components/steps)
- **Tabs**: [https://fumadocs.dev/docs/ui/components/tabs](https://fumadocs.dev/docs/ui/components/tabs)
- **Type Table**: [https://fumadocs.dev/docs/ui/components/type-table](https://fumadocs.dev/docs/ui/components/type-table)
