---
inclusion: fileMatch
fileMatchPattern: "**/scraping/**/*.{ts,tsx}"
---

# DOM Selector Robustness

## Third-Party Page Queries
- Implement fallback selector arrays for third-party page structure
- Try selectors in order: specific class names → generic containers → ARIA → broad fallbacks
- Log warnings when primary selectors fail: `console.warn('[Context] Selector X failed, trying fallback Y')`
- Log when extraction yields fewer results than expected
- Wrap selector queries in try-catch for malformed selectors

## Selector Patterns
- Use relative/child selectors (e.g., `element.querySelector('#child')`)
- Never use nested absolute selectors that redundantly repeat parent IDs
