---
inclusion: fileMatch
fileMatchPattern: "**/scripts/**/*.{js,ts,mjs}"
---

# Build Scripts and Node.js Utilities

## File Operations
- Wrap file I/O in try-catch blocks
- Log errors with full context
- Exit with non-zero status code on failure
- Validate array bounds before accessing elements

## String Operations
- Use `String.replaceAll()` or global regex for all occurrences
- `String.replace()` only replaces first match

## Progress Tracking
- Calculate percentages correctly: `(loaded / total) * 100`
- Provide fallbacks when totals unavailable

## Code Hygiene
- Remove commented-out code; rely on git history
