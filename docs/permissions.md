# MV3 Permissions & Rationale

## Overview

This document records the Chrome Extension Manifest V3 permissions used by this extension and the least-privilege rationale for each.

## Declared Permissions

### Required Permissions

| Permission | Why it is needed | Where it is used | Least-privilege note |
|---|---|---|---|
| `storage` | Persist small flags/settings (e.g., `modelVersion`, pause flags) in `chrome.storage.local`. | `src/background.ts`, future `src/pages/history.tsx` UI, settings. | Only `chrome.storage.local` is used; no sync use. |
| `offscreen` | Create offscreen document to host a `Worker` for embeddings without visible UI. | `src/background/offscreen.ts`, `src/offscreen/index.html`. | Offscreen is created on-demand and closed when idle. |
| `unlimitedStorage` | Allow large IndexedDB/Cache Storage for models and embeddings. | Worker and background writing to IndexedDB/Cache Storage. | Required for large local data; no network usage. |
| `scripting` | Programmatic injection for future capture or script execution where needed. | Background scheduling minor extraction or one-off scripts. | Used narrowly; no blanket content script matches expanded here. |
| `alarms` | Schedule background batching (queue coalescing, idle processing). | `src/background.ts` queue/scheduler. | Alarms are low-privilege; namespaced and cleared on uninstall/update. |
| `tabs` | Read basic tab info, open internal pages (history UI), manage lifecycle. | `src/popup.tsx` → open history page; background tab coordination. | Limit usage to required fields (`url`, `title` when needed). |

### Host Permissions

| Permission | Why it is needed | Where it is used | Least-privilege note |
|---|---|---|---|
| `<all_urls>` | Allow content scripts/messages to operate on all sites for on-device capture. | `src/contents/extract.ts` (planned), messaging to background. | Can be tightened later (allowlist/denylist UI); surfaced to user with pause. |

## Security Considerations

- **No optional or additional permissions** beyond the list above.
- **All heavy work** (model load/embeddings) runs locally; no network calls except first-run model download (handled separately, not expanding permissions).
- **Prefer `IndexedDB`/Cache Storage** and `chrome.storage.local` for small flags; avoid `storage.sync`.
- **Offscreen document** is created just-in-time and destroyed when idle; background service worker remains MV3-compliant.
- **Future hardening**: narrow `host_permissions` with domain controls once UI allow/deny lists are available.

## Manifest Configuration

The permissions are configured in `package.json` via Plasmo's `manifest` field:

```json
{
  "manifest": {
    "permissions": [
      "storage",
      "offscreen",
      "unlimitedStorage",
      "scripting",
      "alarms",
      "tabs"
    ],
    "host_permissions": [
      "<all_urls>"
    ]
  }
}
```

## Validation

After building with `pnpm build`, the generated `build/chrome-mv3-dev/manifest.json` should contain:

- `manifest_version: 3`
- `permissions` array with exactly: `storage`, `offscreen`, `unlimitedStorage`, `scripting`, `alarms`, `tabs`
- `host_permissions` array with exactly: `<all_urls>`
- `background.service_worker` (not persistent background page)

### Chrome Console Permission Tests

To verify permissions are working correctly, load the extension in Chrome and test in the Service Worker console:

```javascript
// Storage
chrome.storage.local.get(); // Should return without error

// Alarms
chrome.alarms.create("test-perm", { delayInMinutes: 1 }); // Should succeed

// Offscreen
chrome.offscreen.hasDocument(); // Should run without permission error

// Scripting
chrome.scripting.getRegisteredContentScripts(); // Should return without permission error

// Tabs
chrome.tabs.query({ active: true, currentWindow: true }); // Should return without permission error
```

## Last Updated

October 6, 2025 - Initial MV3 permissions implementation
