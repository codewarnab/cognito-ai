---
inclusion: fileMatch
fileMatchPattern: "**/*.tsx"
---

# React and Hooks Standards

## React 19 Patterns
This extension uses **React 19**. Key patterns:

### `ref` as a Prop
```typescript
// ✅ React 19 - ref as prop
interface Props {
  ref?: React.RefObject<HTMLDivElement | null>;
}

function MyComponent({ ref, ...props }: Props) {
  return <div ref={ref} {...props} />;
}
```

### `useRef` Null Handling
`useRef<T>(null)` returns `RefObject<T | null>`:

```typescript
// ✅ React 19 - explicit null in type
const inputRef = useRef<HTMLInputElement | null>(null);

// Props accepting refs
interface Props {
  inputRef?: React.RefObject<HTMLInputElement | null>;
}
```

## Component Patterns
- Use functional components with hooks
- Use Zustand stores from `@/stores` for global state (see `zustand-stores.md`)
- Keep side effects inside `useEffect` with correct dependencies
- Always include dependency arrays in `useImperativeHandle`
- Never call state setters during render phase; use `useEffect` instead
- Exclude callback props from useEffect dependencies when only used in cleanup

## Event Handlers
- Always call prop event handlers unconditionally to maintain React's prop contract
- Only conditionally trigger internal animations
- Use stable unique identifiers (e.g., `item.id`) as React keys, never array indices

## Accessibility
- Add `aria-label` to all icon-only buttons and close buttons
- Use `type="button"` on buttons that shouldn't submit forms
- Add keyboard support to interactive elements: `role="button"`, `tabIndex={0}`, `onKeyDown`

## UI State
- Always provide loading states during async operations
- Display error states with retry functionality; never fail silently
- Polling intervals should be 5+ seconds minimum

## Tool Renderers
- Handle both success and error responses
- Check for `error` property before accessing success-only fields

## Animation
- AnimatePresence must remain mounted for exit animations
- Move conditional rendering inside AnimatePresence
- Add stable `key` props to motion elements
