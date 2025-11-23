# TypeScript Standards

## Type Safety
- Use strict type checking; prefer `unknown` over `any` for unvalidated data
- Never use `& any` in type definitions—it defeats all type checking
- All destructured variables must be declared in the function's type signature
- Maintain type consistency across related interfaces
- Define proper interfaces for component props, even simple ones
- Define specific interfaces for complex data structures instead of `any[]`
- Create typed interfaces for third-party library objects when accessing undocumented properties

## Configuration
- Path aliases (use these for imports):
  - `~*` → `./src/*`
  - `@/*` → `./src/*`
  - `@assets/*` → `./assets/*`
  - `~logger` → `./src/logger`

## Imports
- Always use path aliases instead of deep relative paths
- Group imports at the top; never define functions/constants between import blocks
- Remove duplicate imports; consolidate into single statements
- Prefer named exports over default exports for shared utilities

## Variables
- Prefer `const` over `let`; avoid `var`
- Use refs for values that need to stay current across closure boundaries
