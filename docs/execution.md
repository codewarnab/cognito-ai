<!-- 

1) MV3 permissions/manifest
- File: `mv-ff90a897.plan.md`
- Why first: unlocks APIs (offscreen, storage, alarms, tabs) used by later steps.

2) Dexie IndexedDB layer
- File: `dex-0e7988b1.plan.md`
- Foundation for pages/chunks/images/settings/miniSearchIndex/queue used everywhere. -->

<!-- 3) Background service worker (queue, alarms, router)
- File: `mv-e488f233.plan.md`
- Needs DB ready; will orchestrate offscreen/worker and enforce gates. -->

<!-- 4) Offscreen document + bridge
- File: `off-65c3ad37.plan.md`
- Required for model/embedding and search work without UI. -->
<!-- 
5) Model download & caching
- File: `model-08a15642.plan.md`
- Gating readiness for embeddings; integrates with background/offscreen. -->

<!-- 6) Embedding worker
- File: `embed-65e80471.plan.md`
- Depends on model readiness and offscreen bridge; writes embeddings to DB. -->

<!-- 7) MiniSearch sparse index
- File: `min-a5218e06.plan.md`
- Uses DB, offscreen execution; provides sparse search. -->

<!-- 8) Hybrid search orchestration
- File: `hybrid-e01febc8.plan.md`
- Combines dense (worker) + sparse (MiniSearch); used by UI. -->

<!-- 9) Content script extraction
- File: `content-a2392710.plan.md`
- Uses privacy gates from `chrome.storage.local`; enqueues to background. -->

<!-- 10) History search page (UI)
- File: `history-0c59b28a.plan.md`
- Consumes hybrid search, settings, and clear actions. -->

<!-- 11) Privacy controls & data wipe
- File: `privacy-28f7dc51.plan.md`
- Builds on settings/DB/background; adds wipe/allow/deny and guards. -->

<!-- 12) Popup CTA + status
- File: `popup-0333d618.plan.md`
- Final polish; reads small flags and opens history page. -->

Notes:
- Steps 3–6 are tightly coupled; keep the sequence. 
- Steps 7–8 can start after 4, but complete after 6.
- Step 9 should land before 10 to have data flowing.
- Run a build after step 1 to verify `manifest.json` permissions match expectations.

Status: I read all the plan files and produced a dependency-ordered sequence; next I can turn this into a checklist with milestones if you want.