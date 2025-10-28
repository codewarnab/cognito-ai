# Contributing to Chrome AI

Thank you for your interest in contributing to Chrome AI! This document provides guidelines and instructions for contributing to the project.

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
# Start development server
pnpm dev

# Build for production
pnpm build

# Run tests (if available)
pnpm test
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

- Use **TypeScript** for type safety
- Follow **ESLint** rules
- Use **Prettier** for code formatting
- Prefer `const` over `let`, avoid `var`
- Use meaningful variable and function names
- Add JSDoc comments for complex functions

### React Components

- Use **functional components** with hooks
- Keep components small and focused
- Use proper prop typing with TypeScript
- Follow React best practices

### File Naming

- Use **camelCase** for files: `myComponent.tsx`
- Use **PascalCase** for component files: `MyComponent.tsx`
- Use **kebab-case** for utility files: `my-util.ts`

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
feat(ai): add support for GPT-4 integration
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

By contributing to Chrome AI, you agree that your contributions will be licensed under the [MIT License](./LICENSE).

---

Thank you for contributing to Chrome AI! 🎉
