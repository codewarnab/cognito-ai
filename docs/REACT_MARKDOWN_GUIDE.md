# React Markdown Setup - Quick Reference

## Installation

```bash
pnpm add react-markdown remark-gfm remark-breaks
```

## Usage in Components

```tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

export function MyComponent({ content }) {
  return (
    <div className="markdown-content">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
```

## Supported Markdown Features

- **Headers**: `# H1` through `###### H6`
- **Bold**: `**bold**` or `__bold__`
- **Italic**: `*italic*` or `_italic_`
- **Strikethrough**: `~~strikethrough~~` (via remark-gfm)
- **Links**: `[text](url)`
- **Lists**: 
  - Unordered: `- item` or `* item`
  - Ordered: `1. item`
  - Task lists: `- [ ] task` or `- [x] completed` (via remark-gfm)
- **Code**:
  - Inline: `` `code` ``
  - Block: ` ```language\ncode\n``` `
- **Blockquotes**: `> quote`
- **Tables** (via remark-gfm):
  ```markdown
  | Header 1 | Header 2 |
  |----------|----------|
  | Cell 1   | Cell 2   |
  ```
- **Horizontal Rule**: `---` or `***`
- **Line Breaks**: Automatic (via remark-breaks)

## Styling

Add CSS for markdown elements in your stylesheet:

```css
.markdown-content {
  /* Base styles */
}

.markdown-content h1,
.markdown-content h2,
.markdown-content h3 {
  /* Heading styles */
}

.markdown-content code {
  /* Inline code styles */
}

.markdown-content pre {
  /* Code block styles */
}

.markdown-content table {
  /* Table styles */
}
```

## Important: vfile Patch for Plasmo

react-markdown depends on `vfile` which uses Node.js subpath imports that don't work with Plasmo's bundler. We automatically patch this in the postinstall script.

The patch converts:
```js
import {minpath} from '#minpath'
```
to:
```js
import {minpath} from './minpath.browser.js'
```

This happens automatically when you run `pnpm install`.

## Advanced: Custom Components

You can override how markdown elements are rendered:

```tsx
<ReactMarkdown
  remarkPlugins={[remarkGfm, remarkBreaks]}
  components={{
    // Custom link component
    a: ({node, ...props}) => (
      <a {...props} target="_blank" rel="noopener noreferrer" />
    ),
    // Custom code block
    code: ({node, inline, className, children, ...props}) => {
      const match = /language-(\w+)/.exec(className || '');
      return !inline ? (
        <pre className={className}>
          <code {...props}>{children}</code>
        </pre>
      ) : (
        <code className={className} {...props}>{children}</code>
      );
    }
  }}
>
  {content}
</ReactMarkdown>
```

## Troubleshooting

### Build fails with "Cannot resolve #minpath"

Run the patch manually:
```bash
node scripts/patch-vfile.js
```

### Markdown not rendering

Check that:
1. Content is passed as children to `<ReactMarkdown>`
2. CSS is loaded (check `.markdown-content` styles)
3. `white-space: normal` is set (not `pre-wrap`)

### Adding more plugins

Popular plugins:
- `remark-math` + `rehype-katex` - Math equations
- `rehype-highlight` - Syntax highlighting
- `rehype-sanitize` - Security (remove dangerous HTML)
- `remark-emoji` - Emoji support 😊

Install and add to `remarkPlugins` or `rehypePlugins` array.
