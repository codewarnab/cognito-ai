<!-- 145adfda-2f9d-4a2b-80e8-b280ef66fc8c a3cb283c-8bab-481a-8c62-8685567dd255 -->
# Prevent duplicate Copilot actions from re-executing

Based on the root cause noted in the GitHub issue, we’ll implement a robust, non-invasive fix that works with our current @copilotkit/react-core 1.10.6 and avoids modifying node_modules. We will also harden action registration to ensure it runs once and that each handler is idempotent. Reference: [GitHub issue #2310](https://github.com/CopilotKit/CopilotKit/issues/2310).

## Changes

### 1) Add `_isRenderAndWait: true` to all actions

- Files:
  - `src/actions/tabs.ts` (all `useCopilotAction` calls: `getActiveTab`, `searchTabs`, `openTab`)
  - `src/actions/selection.ts` (`getSelectedText`, `readPageContent`)
  - `src/actions/interactions.ts` (`clickElement`, `scrollPage`, `fillInput`, `focusElement`, `pressKey`, `extractText`)
  - `src/actions/primitives.ts` (`navigateTo`, `waitForPageLoad`, `waitForSelector`)
  - `src/components/ToolRenderer.tsx` catch-all (`name: "*"`)
- Edit example:
```diff
 useCopilotAction({
   name: "openTab",
   description: "Open a URL...",
+  _isRenderAndWait: true,
   parameters: [...],
   handler: async ({ url }) => { ... }
 })
```


### 2) Ensure actions register exactly once

- Verify only a single call site for `useRegisterAllActions()` inside a single mounted component tree (already `src/sidepanel.tsx`).
- Add a mount guard in `useRegisterAllActions` to prevent accidental double registration (e.g., hot reload edge cases):
```ts
// src/actions/registerAll.ts
const didRegister = { current: false } as { current: boolean };
export function useRegisterAllActions() {
  if (didRegister.current) return; // idempotent guard
  didRegister.current = true;
  registerTabActions();
  registerSelectionActions();
  registerInteractionActions();
  registerPrimitiveActions();
}
```


### 3) Add per-action idempotency guard keyed by execution

- Introduce a lightweight, in-memory set to ignore duplicate executions within a short window.
- Centralize in a tiny helper used by all action modules to avoid copy-paste:
```ts
// src/actions/useActionDeduper.ts
const seen = new Set<string>();
export function shouldProcess(actionName: string, args: unknown): boolean {
  const key = actionName + ":" + JSON.stringify(args);
  if (seen.has(key)) return false;
  seen.add(key);
  setTimeout(() => seen.delete(key), 3000);
  return true;
}
```

- Then call at top of each handler:
```diff
 handler: async (args) => {
+  if (!shouldProcess("openTab", args)) return { skipped: true, reason: "duplicate" };
   ...
 }
```


### 4) Keep existing debounce, but standardize

- `interactions.ts` and `primitives.ts` already debounce via a ref; keep it, but migrate to the shared helper (above) for uniform behavior across all actions.

## Validation

- Trigger a sequence of tool calls rapidly (e.g., openTab → navigateTo → waitForPageLoad → extractText) and confirm each corresponding handler logs exactly once per message.
- Specifically test multi-call sequences that previously caused 2x–3x invocations.
- Verify catch-all `ToolRenderer` no longer causes extra handler runs.

## Notes

- This plan avoids editing dependency code and is resilient to render cycles and streaming updates. It follows the workaround documented in the issue: setting `_isRenderAndWait: true` on actions.

### To-dos

- [ ] Add _isRenderAndWait: true to every useCopilotAction call in all action files
- [ ] Make useRegisterAllActions idempotent to prevent double registration
- [ ] Create shared shouldProcess helper and use in all handlers
- [ ] Replace per-file debounce logic with shared deduper
- [ ] Run multi-tool sequences and verify single execution per call