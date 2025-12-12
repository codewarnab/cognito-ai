# Tailwind Migration Guide

## ⚠️ Critical: Spacing & Padding Standards

When migrating components from CSS to Tailwind, **ALWAYS** maintain the original spacing values. This document defines the standard spacing scale to prevent layout regressions.

## Standard Spacing Scale

### Container Padding (Messages, Panels, etc.)
- **Horizontal Padding**: `px-6` (24px) - Never use `px-4` for main containers
- **Vertical Padding**: `py-6` (24px) or `pt-6 pb-6` - Never use `py-4` or `pt-4 pb-2.5`
- **Message Container**: `px-6 pb-6 pt-6` (24px all around)

### Message Bubbles
- **User Messages**: `px-4 py-3` (16px horizontal, 12px vertical)
- **Assistant Messages**: No padding (transparent background)
- **Gap between messages**: `gap-6` (24px)

### Message Components
- **Gap between message parts**: `gap-2` (8px)
- **Gap between message and copy button**: `gap-3` (12px)
- **Tool call margin-top**: `mt-4` (16px)

### Loading Indicator
- **Container padding**: `py-1` (4px vertical)
- **Gap**: `gap-3` (12px)
- **Font size**: `text-base` (16px)

## Migration Checklist

When converting a component to Tailwind:

1. ✅ **Measure First**: Take screenshots of the original component
2. ✅ **Map CSS Values**: Document all padding, margin, gap values
3. ✅ **Use Correct Scale**: 
   - `gap-2` = 8px
   - `gap-3` = 12px
   - `gap-4` = 16px
   - `gap-6` = 24px
   - `px-4` = 16px
   - `px-6` = 24px
   - `py-3` = 12px
   - `py-6` = 24px
4. ✅ **Compare After**: Take screenshots and compare side-by-side
5. ✅ **Test Responsive**: Check at different viewport sizes

## Common Mistakes to Avoid

### ❌ DON'T
```tsx
// Too cramped - main containers need more space
<div className="px-4 pb-2.5 pt-4 gap-4">

// Inconsistent gaps
<div className="gap-2"> // in one place
<div className="gap-[3px]"> // in another place

// Wrong font sizes
<span className="text-sm"> // for main content
```

### ✅ DO
```tsx
// Proper spacing for main containers
<div className="px-6 pb-6 pt-6 gap-6">

// Consistent gaps using standard scale
<div className="gap-2"> // for tight spacing
<div className="gap-3"> // for medium spacing
<div className="gap-6"> // for loose spacing

// Correct font sizes
<span className="text-base"> // for main content (16px)
```

## ⛔ Do NOT Migrate to Tailwind

The following CSS files contain complex animations, 3D transforms, and visual effects that should **NOT** be converted to Tailwind. Keep them as separate CSS files:

### Voice Orb Components
- `VoicePoweredOrb.css` - Complex 3D orb animations and gradients
- `AudioOrb3D.css` - WebGL/3D-related styling
- `VoiceModeUI.css` - Voice mode visual effects

### Core Essential Files
- `styles/core/variables.css` - CSS custom properties
- `styles/core/animations.css` - @keyframes definitions
- `styles/fonts.css` - @font-face declarations

---

## Component-Specific Standards

### ChatMessages Container
```tsx
<div className="flex-1 overflow-y-auto overflow-x-hidden px-6 pb-6 pt-6 flex flex-col gap-6 bg-[#0a0e1a] min-h-0">
```

### Message Wrapper
```tsx
<div className="flex gap-3 max-w-full group">
```

### User Message Bubble
```tsx
<div className="rounded-xl px-4 py-3 max-w-[90%] text-base leading-relaxed break-words bg-blue-500 text-white">
```

### LoadingIndicator
```tsx
<motion.div className="flex gap-3 justify-start items-start py-1">
  <span className="text-base font-medium">
```

## CSS Variables to Preserve

Always use these CSS variables for consistency:
- `--text-primary`: Main text color
- `--text-secondary`: Secondary text (60% opacity)
- `--bg-primary`: #0a0e1a
- `--spacing-xs`: 4px
- `--spacing-sm`: 8px
- `--spacing-md`: 16px
- `--spacing-lg`: 24px
- `--spacing-xl`: 32px

## Testing Protocol

Before committing Tailwind migrations:

1. **Visual Comparison**: Screenshot before/after
2. **Spacing Audit**: Use browser DevTools to measure padding/margins
3. **Responsive Check**: Test at 320px, 375px, 768px widths
4. **Dark Mode**: Verify colors and contrast
5. **Animation**: Ensure smooth transitions remain

## Rollback Strategy

If spacing issues are discovered:
1. Check this guide for correct values
2. Compare with pre-migration screenshots
3. Use `git diff` to see what changed
4. Restore original spacing values using Tailwind equivalents

## Future Prevention

- **Code Review**: Always compare screenshots in PRs
- **Automated Tests**: Consider visual regression tests
- **Documentation**: Update this guide when new patterns emerge
- **Consistency**: Use the same spacing values across similar components

---

**Last Updated**: 2025-12-12
**Maintained By**: Development Team
