---
inclusion: fileMatch
fileMatchPattern: "**/components/**/*.{ts,tsx}"
---

# UI Components Standards

## Component Structure
- Extract duplicate configurations into reusable arrays with interfaces
- Define TypeScript interfaces for all component props
- Remove unused state variables
- Export names must follow consistent conventions (e.g., `Icon` suffix for icons)

## Buttons and Interactions
- Use `type="button"` on buttons that shouldn't submit forms
- Add keyboard support to clickable non-button elements
- All icon-only buttons must have `aria-label` attributes

## Styling
- Always append units to numeric displays (%, px, ms)
- All CSS numeric values must include unit identifier
- Maintain consistent trailing commas in object literals
- Avoid double semicolons and syntax redundancies

## Comments
- Never use inline `//` comments inside JSX attributes; use `{/* */}`
- Keep comments in sync with code; update immediately when implementation changes
