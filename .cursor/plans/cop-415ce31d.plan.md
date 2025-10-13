<!-- 415ce31d-cc7e-4827-a79d-d2eeeda21945 ddecd007-4912-4ea9-a75c-f3c6a9a5489b -->
# CopilotKit + Gemini (External Runtime) in Side Panel

## Scope

- Frontend-only: integrate CopilotKit UI into `src/sidepanel.tsx`
- Config: Runtime URL set via a constant in `src/constants.ts` (manually edited by user)
- No Node server in this repo; you will point to your already-hosted Copilot Runtime (Gemini)
- Keys live only on your external runtime

## 1) Frontend: CopilotKit in side panel

- Install deps: `@copilotkit/react-core` and `@copilotkit/react-ui`.
- Define runtime URL constant the user will edit:
```ts
// src/constants.ts
export const COPILOT_RUNTIME_URL = "https://YOUR-RUNTIME.EXAMPLE/api/copilotkit"; // edit this
```

- Wrap side panel UI with CopilotKit provider and sidebar component:
```ts
// src/sidepanel.tsx
import { CopilotKit } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";
import { COPILOT_RUNTIME_URL } from "./constants";

export default function Sidepanel() {
  return (
    <CopilotKit runtimeUrl={COPILOT_RUNTIME_URL}>
      <CopilotSidebar />
    </CopilotKit>
  );
}
```


## 2) Optional: Actions (extension tools)

- Add CopilotKit actions (e.g., via hooks) to let AI call extension capabilities:
  - Summarize selected text from the active tab
  - Search/open tabs via `chrome.tabs`
  - Save outputs into your existing history model/UI

## 3) Manifest & CSP

- Ensure extension manifest includes:
  - `"permissions": ["sidePanel"]` and `"side_panel": {"default_path": "sidepanel.html"}` (Plasmo may generate this)
  - CSP/connect-src allows your runtime origin (e.g., `https://YOUR-RUNTIME.EXAMPLE`)

## 4) Testing

- Set `COPILOT_RUNTIME_URL` to your hosted Copilot Runtime endpoint.
- Load unpacked extension, open the side panel, send prompts, verify streamed responses.
- Exercise optional actions; confirm permissions and privacy prompts align with `docs/privacy-implementation-summary.md`.

## 5) Deployment

- Keep `COPILOT_RUNTIME_URL` pointed to the production runtime.
- Lock down your runtime CORS to your extension ID/domains; keys remain server-side only.

## To-dos

- [ ] Install `@copilotkit/react-core` and `@copilotkit/react-ui`
- [ ] Add `COPILOT_RUNTIME_URL` constant in `src/constants.ts` (manual edit by user)
- [ ] Wrap `src/sidepanel.tsx` with `CopilotKit` provider + `CopilotSidebar`
- [ ] (Optional) Register Copilot actions for tabs/selection/history
- [ ] Verify sidePanel permission and CSP/connect-src for runtime origin
- [ ] Test end-to-end with your hosted runtime