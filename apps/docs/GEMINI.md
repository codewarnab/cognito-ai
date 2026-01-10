# Cognito Docs

**@cognito/docs** is the documentation site for the Cognito AI project, built with [Fumadocs](https://fumadocs.vercel.app).

## Key Standards

### Code Blocks

- **Language Support**: Use `bash` for shell commands/env files. `env` is NOT supported by Shiki.
- **Titles**: Use `title="filename"` metadata to add a header bar to code blocks.

```bash title="Example"
# Correct
code block content
```

### Callouts

Use the `<Callout>` component for notes, tips, and warnings:

```mdx
<Callout>General tip or info.</Callout>
<Callout type="warn">Important note.</Callout>
<Callout type="error">Critical warning.</Callout>
<Callout title="Custom Title">With custom title.</Callout>
```

Do NOT use GitHub-style alerts (`> [!NOTE]`) or put redundant titles like `title="Note"` when the type already displays one.

### Style Guide

Refer to [STYLE_GUIDE.md](file:///c:/Users/User/code/hackathons/chrome-ai/apps/docs/STYLE_GUIDE.md) for full writing and formatting guidelines.