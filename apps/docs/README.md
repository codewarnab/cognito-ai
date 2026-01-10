# Cognito AI Docs (`@cognito/docs`)

This is the Cognito AI documentation site, built with **Next.js** + **Fumadocs**.

## Development

From the **repo root**:

```bash
pnpm dev:docs
```

Or run it directly via filter:

```bash
pnpm --filter @cognito/docs dev
```

Open `http://localhost:3003` in your browser.

## Explore

In the project, you can see:

- `src/lib/source.ts`: Content source adapter. [`loader()`](https://fumadocs.dev/docs/headless/source-api) provides the interface to access your content.
- `src/lib/layout.shared.tsx`: Shared layout options.

| Route                     | Description                                            |
| ------------------------- | ------------------------------------------------------ |
| `app/(home)`              | The route group for your landing page and other pages. |
| `app/docs`                | The documentation layout and pages.                    |
| `app/api/search/route.ts` | The Route Handler for search.                          |

### Fumadocs MDX

A `source.config.ts` config file has been included, you can customise different options like frontmatter schema.

Read the [Introduction](https://fumadocs.dev/docs/mdx) for further details.

## Typecheck

```bash
pnpm --filter @cognito/docs types:check
```

## Build

From the repo root:

```bash
pnpm build:docs
```

## Learn More

To learn more about Next.js and Fumadocs, take a look at the following
resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js
  features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [Fumadocs](https://fumadocs.dev) - learn about Fumadocs
