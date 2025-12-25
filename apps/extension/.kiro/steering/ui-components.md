---
inclusion: fileMatch
fileMatchPattern: "**/components/**/*.{ts,tsx}"
---

# UI Components Standards

> **Note**: Settings, onboarding, reminders, features, troubleshooting, and changelog pages are in `apps/webapp/` (Next.js), not the extension. The extension only contains the side panel chat UI.

## Primitive Components
- **CRITICAL**: Never modify primitive UI components (`src/components/ui/primitives/`) directly
- Always add props for customization and pass them from consuming components
- Primitives should be configurable, not hardcoded

## Component Structure
- Extract duplicate configurations into reusable arrays with interfaces
- Define TypeScript interfaces for all component props
- Remove unused state variables
- Export names must follow consistent conventions (e.g., `Icon` suffix for icons)

## Buttons and Interactions
- Use `type="button"` on buttons that shouldn't submit forms
- Add keyboard support to clickable non-button elements
- All icon-only buttons must have `aria-label` attributes

## Styling (Tailwind CSS)
- Use Tailwind CSS utility classes for all component styling
- Follow spacing standards in `TAILWIND_MIGRATION_GUIDE.md`
- Always append units to numeric displays (%, px, ms)
- Maintain consistent trailing commas in object literals
- Use CSS variables from `styles/core/variables.css` for custom properties
- Keep complex animations in raw CSS files (see migration guide for exceptions)

## Comments
- Never use inline `//` comments inside JSX attributes; use `{/* */}`
- Keep comments in sync with code; update immediately when implementation changes

## CSS Scoping (CRITICAL)
- **NEVER write broad CSS selectors** like `.group:hover span` or `.container div` that can match elements across unrelated components
- Always use unique, specific class names for CSS targeting (e.g., `.my-feature-btn:hover span` instead of `.group:hover span`)
- Inline `<style>` blocks are especially dangerous—their selectors apply globally and can break other components
- If you need hover effects, scope them with unique class names that won't collide with Tailwind utilities or other components
