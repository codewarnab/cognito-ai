# CSS to Tailwind Migration Guide

This document provides a structured approach for migrating vanilla CSS to Tailwind CSS in the Cognito AI extension.

> **Note**: This is a gradual migration. Existing vanilla CSS continues to work alongside Tailwind.

---

## Migration Status

### Completed Setup
- [x] Tailwind CSS 4 installed
- [x] `@tailwindcss/vite` plugin configured in `wxt.config.ts`
- [x] ShadCN theme variables in `assets/tailwind.css`
- [x] `components.json` for ShadCN CLI
- [x] `cn()` utility in `src/lib/utils.ts`

---

## Directory Structure

| Path | Files | Priority | Notes |
|------|-------|----------|-------|
| `src/styles/components/` | 10 files | High | Reusable UI components |
| `src/styles/features/` | 54 files | Medium | Feature-specific styles |
| `src/styles/layout/` | 6 files | Low | Layout utilities |
| `src/styles/core/` | 4 files | Low | Core/reset styles |
| `src/sidepanel.css` | 1 file | Medium | Main sidepanel styles |

---

## Migration Workflow

### For Each Component

1. **Identify the component** and its CSS file
2. **Review current CSS** classes and their usage
3. **Map to Tailwind utilities** using the table below
4. **Update React component** to use Tailwind classes
5. **Test visually** in extension
6. **Remove old CSS** after verification

---

## Common CSS to Tailwind Mappings

### Layout

| CSS Property | Tailwind Class |
|--------------|----------------|
| `display: flex` | `flex` |
| `display: grid` | `grid` |
| `flex-direction: column` | `flex-col` |
| `justify-content: center` | `justify-center` |
| `align-items: center` | `items-center` |
| `gap: 8px` | `gap-2` |
| `gap: 16px` | `gap-4` |

### Spacing

| CSS Property | Tailwind Class |
|--------------|----------------|
| `padding: 4px` | `p-1` |
| `padding: 8px` | `p-2` |
| `padding: 16px` | `p-4` |
| `margin: 8px` | `m-2` |
| `margin-top: 16px` | `mt-4` |
| `padding-left: 12px` | `pl-3` |

### Typography

| CSS Property | Tailwind Class |
|--------------|----------------|
| `font-size: 12px` | `text-xs` |
| `font-size: 14px` | `text-sm` |
| `font-size: 16px` | `text-base` |
| `font-weight: 500` | `font-medium` |
| `font-weight: 600` | `font-semibold` |
| `color: white` | `text-white` |
| `text-align: center` | `text-center` |

### Colors (ShadCN Theme)

| CSS Value | Tailwind Class |
|-----------|----------------|
| Background color | `bg-background` |
| Foreground/text | `text-foreground` |
| Primary button | `bg-primary text-primary-foreground` |
| Secondary | `bg-secondary text-secondary-foreground` |
| Muted | `bg-muted text-muted-foreground` |
| Destructive | `bg-destructive` |
| Card | `bg-card` |
| Border | `border-border` |

### Borders & Radius

| CSS Property | Tailwind Class |
|--------------|----------------|
| `border: 1px solid` | `border` |
| `border-radius: 4px` | `rounded` |
| `border-radius: 8px` | `rounded-lg` |
| `border-radius: 50%` | `rounded-full` |

### Shadows

| CSS Value | Tailwind Class |
|-----------|----------------|
| Small shadow | `shadow-sm` |
| Default shadow | `shadow` |
| Medium shadow | `shadow-md` |
| Large shadow | `shadow-lg` |

### Transitions

| CSS Property | Tailwind Class |
|--------------|----------------|
| `transition: all 0.2s` | `transition-all duration-200` |
| `transition: opacity 0.15s` | `transition-opacity duration-150` |

---

## Priority Components for Migration

### Phase 1: Buttons & Inputs (High Impact)

Files to migrate:
- `src/styles/components/continue-button.css`
- `src/styles/components/context-indicator.css`
- `src/styles/components/voice-recording-pill.css`

Consider using: `npx shadcn@latest add button input`

---

### Phase 2: Notifications & Toasts

Files to migrate:
- `src/styles/components/error-toast.css`
- `src/styles/components/streaming-warning.css`
- `src/styles/components/context-warning.css`

Consider using: `npx shadcn@latest add toast alert`

---

### Phase 3: Feature-Specific Styles

Migrate one feature at a time:
1. `src/styles/features/onboarding/`
2. `src/styles/features/threads/`
3. `src/styles/features/mcp/`
4. `src/styles/features/copilot/`

---

## Using the `cn()` Helper

The `cn()` function merges Tailwind classes and handles conditional logic:

```tsx
import { cn } from '@/lib/utils';

// Basic usage
<div className={cn("flex items-center gap-2", className)} />

// Conditional classes
<button 
  className={cn(
    "px-4 py-2 rounded-lg transition-colors",
    isActive && "bg-primary text-primary-foreground",
    isDisabled && "opacity-50 cursor-not-allowed"
  )}
/>
```

---

## Adding ShadCN Components

Use the CLI to add pre-built components:

```bash
# Navigate to extension directory
cd apps/extension

# Add individual components
npx shadcn@latest add button
npx shadcn@latest add input
npx shadcn@latest add dialog
npx shadcn@latest add toast

# Components are added to src/components/ui/
```

---

## Content Scripts (Special Handling)

Content scripts use Shadow DOM for style isolation. Tailwind requires special handling:

1. **Option A**: Copy compiled CSS into content script's `style.css`
2. **Option B**: Use inline styles for critical CSS
3. **Option C**: Keep vanilla CSS for content scripts

**Recommendation**: Start with sidepanel migration, handle content scripts later.

---

## Quick Reference Links

- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [ShadCN UI Components](https://ui.shadcn.com/docs/components)
- [Tailwind CSS IntelliSense (VS Code)](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)
