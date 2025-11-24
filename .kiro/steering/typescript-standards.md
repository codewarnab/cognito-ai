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
- **CRITICAL**: Reference the canonical import guide at `.cursor/rules/coding-standards.mdc` for complete import patterns.
- Path aliases (configured in `tsconfig.json:18-48`; always use these instead of relative paths):
  - `~*` → `./src/*` (e.g., `import { something } from '~/utils/helper';`)
  - `@/*` → `./src/*` (e.g., `import { handleAPIError } from '@/utils/apiErrorHandler';`)
  - `@assets/*` → `./assets/*` (e.g., `import icon from '@assets/icon.png';`)
  - `~logger` → `./src/logger` (e.g., `import { createLogger } from '~logger';`)
  - `@components` → `./src/components` (e.g., `import { Button } from '@components';`)
  - `@components/*` → `./src/components/*` (e.g., `import { Button } from '@components/ui/Button';`)
  - `@ai` → `./src/ai` (e.g., `import { ModelSetup } from '@ai';`)
  - `@ai/*` → `./src/ai/*` (e.g., `import { ModelSetup } from '@ai/core/modelSetup';`)

## Imports
- **CRITICAL**: Always use path aliases instead of deep relative paths; never use `../../` or `../../../` patterns.
- Group imports at the top; never define functions/constants between import blocks
- Remove duplicate imports; consolidate into single statements
- Prefer named exports over default exports for shared utilities
- Examples:
  - ✅ `import { createLogger } from '~logger';`
  - ✅ `import { handleAPIError } from '@/utils/apiErrorHandler';`
  - ✅ `import { Button } from '@components/ui/Button';`
  - ✅ `import { ModelSetup } from '@ai/core/modelSetup';`
  - ❌ `import { createLogger } from '../../logger';`
  - ❌ `import { handleAPIError } from '../utils/apiErrorHandler';`
  - ❌ `import { Button } from '../../../components/ui/Button';`
  - ❌ `import { ModelSetup } from '../../ai/core/modelSetup';`

## Variables
- Prefer `const` over `let`; avoid `var`
- Use refs for values that need to stay current across closure boundaries
