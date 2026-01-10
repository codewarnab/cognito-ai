# TypeScript Standards

## Path Aliases
```typescript
// Available alias
import { Component } from '@/components/Component';
```

| Alias | Maps To |
|-------|---------|
| `@/*` | `./src/*` |

## Component Development
- Create diagram components in `src/components/diagrams/`
- Register in `src/mdx-components.tsx` for MDX availability
- Use TypeScript for all components

## Fumadocs Configuration
- `source.config.ts` - Collection definitions
- `next.config.mjs` - Next.js + MDX configuration
- `src/lib/source.ts` - Source loader and helpers

## Type Checking
```bash
pnpm types:check           # Run type check
```

## Imports
- Group imports at top of file
- Use path aliases instead of relative paths
- Prefer named exports
