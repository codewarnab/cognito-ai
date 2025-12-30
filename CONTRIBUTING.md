# Contributing to Cognito AI

Thank you for your interest in contributing to Cognito AI! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## Getting Started

1. **Fork the Repository**
   ```bash
   # Click the 'Fork' button on GitHub
   ```

2. **Clone Your Fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/cognito-ai.git
   cd cognito-ai
   ```

3. **Add Upstream Remote**
   ```bash
   git remote add upstream https://github.com/codewarnab/cognito-ai.git
   ```

4. **Install Dependencies**
   ```bash
   pnpm install
   ```

5. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

For detailed setup instructions, see [SETUP.md](./SETUP.md).

## How to Contribute

### Types of Contributions

- 🐛 **Bug Fixes**: Fix issues and bugs
- ✨ **New Features**: Add new functionality
- 📝 **Documentation**: Improve or add documentation
- 🎨 **UI/UX**: Enhance user interface and experience
- ♻️ **Refactoring**: Improve code quality
- ✅ **Tests**: Add or improve tests
- 🔧 **Tooling**: Improve development tools

## Development Workflow

### 1. Keep Your Fork Updated

```bash
git fetch upstream
git checkout master
git merge upstream/master
```

### 2. Create a Feature Branch

```bash
git checkout -b feature/my-new-feature
# or
git checkout -b fix/bug-description
```

### 3. Make Your Changes

- Write clean, maintainable code
- Follow the coding standards (see below)
- Add tests if applicable
- Update documentation as needed

### 4. Test Your Changes

```bash
# Start development server (runs only the extension)
pnpm dev

# Start all packages in development mode
pnpm dev:all

# Build for production (all packages)
pnpm build

# Type check (all packages)
pnpm type:check
```

### 5. Commit Your Changes

```bash
git add .
git commit -m "feat: add new feature"
```

See [Commit Guidelines](#commit-guidelines) for commit message format.

### 6. Push to Your Fork

```bash
git push origin feature/my-new-feature
```

### 7. Create a Pull Request

- Go to your fork on GitHub
- Click "New Pull Request"
- Select your feature branch
- Fill out the PR template
- Submit the pull request

## Coding Standards

### TypeScript/JavaScript

- Use **TypeScript** with strict type checking
- Use **Prettier** for code formatting (sort imports plugin is included)
- Prefer `const` over `let`; avoid `var`
- Use meaningful variable and function names
- Add JSDoc comments for complex functions when helpful

### React 19 Guidelines

This extension uses **React 19** with important changes:

#### `ref` as a Prop

In React 19, `ref` is passed as a regular prop instead of using `forwardRef`:

```typescript
// ✅ React 19 - ref as prop
interface Props {
  ref?: React.RefObject<HTMLDivElement | null>;
}

function MyComponent({ ref, ...props }: Props) {
  return <div ref={ref} {...props} />;
}

// ❌ Old React 18 pattern (still works but not preferred)
const MyComponent = forwardRef<HTMLDivElement, Props>((props, ref) => {
  return <div ref={ref} {...props} />;
});
```

#### `useRef` Null Handling

`useRef<T>(null)` now returns `RefObject<T | null>` instead of `RefObject<T>`:

```typescript
// ✅ React 19 - explicit null in type
const inputRef = useRef<HTMLInputElement | null>(null);
```

### React Components

- Use **functional components** with hooks
- Keep components small and focused
- Use proper prop typing with TypeScript
- Follow React best practices

### Zustand State Management

**CRITICAL: Selective Subscriptions Required**

Never subscribe to the entire store with `useStore()`. Always use individual selectors:

```typescript
// ❌ BAD - Causes infinite re-render loops
const store = useToolsStore();

// ✅ GOOD - Selective subscriptions for each value
const showModal = useToolsStore((s) => s.showModal);
const setShowModal = useToolsStore((s) => s.setShowModal);
```

### Security Guidelines

When reading data from the DOM that will be sent to AI or backend:

- **NEVER capture sensitive input values** (passwords, credit cards, SSN, etc.)
- Always check if an input is sensitive before reading `input.value`
- Sensitive types: `password`
- Sensitive autocomplete: `cc-number`, `cc-exp`, `cc-csc`, `current-password`, `new-password`
- Sensitive name/id patterns: `/password|card|cvv|csc|ssn|secret|pin/i`

```typescript
// SECURITY: Stripping value from sensitive fields to prevent PII leakage to AI
const value = isSensitiveInput(input) ? undefined : input.value;
```

### CSS Scoping (Critical)

**NEVER write broad CSS selectors** that can match elements across unrelated components:

```css
/* ❌ BAD - Too broad, affects all spans inside any .group element */
.group:hover span {
    max-width: 50px;
}

/* ✅ GOOD - Scoped to specific component */
.my-feature-btn:hover span {
    max-width: 50px;
}
```

### Environment Variables

**CRITICAL**: Always use the centralized `ENV` module instead of directly accessing `import.meta.env`:

```typescript
// ✅ CORRECT - Use centralized ENV module
import { ENV } from '@/utils/env';
const workerUrl = ENV.ELEVENLABS_WORKER_URL;

// ❌ WRONG - Never access directly
const workerUrl = import.meta.env.WXT_ELEVENLABS_WORKER_URL;
```

### Logger Categories

All `createLogger` calls MUST include a category as the second argument:

```typescript
import { createLogger } from '~logger';
const log = createLogger('FeatureName', 'CATEGORY');
```

### File Naming

- Use **PascalCase** for React component files: `MyComponent.tsx`
- Use **camelCase** for hooks and utilities: `useTabContext.ts`, `modelSettings.ts`
- Keep directory names consistent and descriptive; avoid mixing styles within a module

### Imports & Path Aliases

- Avoid deep relative paths like `../../..` in imports
- Use path aliases defined in `tsconfig.json` (specifically for `apps/extension`):
  - `~*` → `./src/*` (e.g., `import { something } from '~/utils/helper'`)
  - `@/*` → `./src/*` (e.g., `import { handleAPIError } from '@/utils/apiErrorHandler'`, `@/components/...`, `@/ai/...`)
  - `@assets/*` → `./assets/*` (e.g., `import icon from '@assets/icon.png'`)
  - `~logger` → `./src/logger` (e.g., `import { createLogger } from '~logger'`)

### Shared Package

Use `@cognito/shared` for shared types and constants between packages:

```typescript
// Import types
import type { WriteTone, RewritePreset, SummaryType } from '@cognito/shared';

// Import constants
import { TONE_INSTRUCTIONS, PRESET_PROMPTS } from '@cognito/shared';
```

### Code Organization

```typescript
// 1. Imports
import React from 'react'
import { useState } from 'react'

// 2. Types/Interfaces
interface MyComponentProps {
  title: string
}

// 3. Component
export const MyComponent: React.FC<MyComponentProps> = ({ title }) => {
  // 4. Hooks
  const [state, setState] = useState()
  
  // 5. Event handlers
  const handleClick = () => {
    // ...
  }
  
  // 6. Render
  return <div>{title}</div>
}
```

## Commit Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Scopes

Since this is a monorepo, please specify the scope of the change:
- `extension`
- `webapp`
- `docs`
- `shared`
- `backend-cloudflare`
- `backend-vercel`
- `repo` (for root level changes)

### Types

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `ci`: CI/CD changes

### Examples

```bash
feat(ai): add support for new Gemini model
fix(sidepanel): resolve memory leak in chat component
docs: update setup instructions
style: format code with prettier
refactor(utils): simplify token counting logic
```

## Pull Request Process

1. **Update Documentation**: Ensure all relevant documentation is updated
2. **Add Tests**: Include tests for new features or bug fixes
3. **Run Tests**: Ensure all tests pass
4. **Update CHANGELOG**: Add your changes to the unreleased section (if applicable)
5. **Describe Your Changes**: Provide a clear description in the PR
6. **Link Issues**: Reference related issues (e.g., "Fixes #123")
7. **Wait for Review**: A maintainer will review your PR
8. **Address Feedback**: Make requested changes if needed
9. **Merge**: Once approved, your PR will be merged

### PR Title Format

Use the same format as commit messages:

```
feat: add new AI model support
fix: resolve sidepanel crash on startup
```

## Reporting Bugs

### Before Submitting a Bug Report

- Check the [existing issues](https://github.com/codewarnab/cognito-ai/issues)
- Try to reproduce the bug in the latest version
- Collect relevant information (error messages, screenshots, etc.)

### How to Submit a Bug Report

1. Go to [Issues](https://github.com/codewarnab/cognito-ai/issues/new)
2. Choose "Bug Report" template
3. Fill in all required information:
   - **Description**: Clear description of the bug
   - **Steps to Reproduce**: Detailed steps to reproduce
   - **Expected Behavior**: What should happen
   - **Actual Behavior**: What actually happens
   - **Environment**: OS, browser version, extension version
   - **Screenshots**: If applicable
   - **Error Logs**: Console errors or stack traces

## Suggesting Features

### How to Suggest a Feature

1. Check if the feature has already been suggested
2. Go to [Issues](https://github.com/codewarnab/cognito-ai/issues/new)
3. Choose "Feature Request" template
4. Provide:
   - **Use Case**: Why this feature is needed
   - **Proposed Solution**: How it should work
   - **Alternatives**: Other approaches considered
   - **Additional Context**: Any other relevant information

## Questions?

If you have questions about contributing:

- Open a [Discussion](https://github.com/codewarnab/cognito-ai/discussions)
- Check the [Documentation](./README.md)
- Review the [Setup Guide](./SETUP.md)

## License

By contributing to Cognito AI, you agree that your contributions will be licensed under the [BUSL-1.1 License](./LICENSE).

---

Thank you for contributing to Cognito AI! 🎉
