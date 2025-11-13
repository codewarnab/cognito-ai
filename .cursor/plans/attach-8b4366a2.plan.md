<!-- 8b4366a2-9f3c-4c79-b8bb-67dd70a13192 2cf593c1-baba-4718-ab0a-5d0bec927285 -->
# Attach-first File Delivery for PDF/Markdown Tools

## Goal

Deliver generated PDFs/Markdown as chat attachments first; users can either open in a new tab or download on click. Keep optional auto-download for legacy behavior.

## A. Tool Changes (attach-first default)

1. Update [src/actions/reports/generatePDF.tsx](src/actions/reports/generatePDF.tsx)

- Add parameter `deliveryMode: 'attach' | 'autoDownload'` (default `'attach'`).
- In `execute`, when `deliveryMode === 'attach'`:
- Generate Blob and Blob URL; DO NOT trigger `downloadPDF`.
- DO NOT call `URL.revokeObjectURL` here; let the chat UI manage lifecycle.
- Return existing `fileData` with `url`, `mediaType: 'application/pdf'`, `name`, `size`.
- When `deliveryMode === 'autoDownload'`:
- Preserve current behavior (trigger download) and also return `fileData`.
- Update tool `description` to reflect the new behavior/parameter.

2. Update [src/actions/reports/generateMarkdown.tsx](src/actions/reports/generateMarkdown.tsx)

- Mirror the same `deliveryMode` parameter and behavior as PDF.
- For `mediaType`, keep `text/markdown`.

## B. Chat UI: Attachment rendering and actions

1. Locate the chat message renderer that consumes tool results and `fileData` (e.g., a message bubble/attachment component). If not present, add a minimal attachment UI component.
2. Render an attachment chip/card showing `name`, `size`, and two actions:

- Open: `window.open(blobUrl, '_blank', 'noopener,noreferrer')`. Chrome will inline-render PDFs; Markdown shows as raw text.
- Download: create a temporary anchor with `href=blobUrl` and `download=filename`, click it programmatically; remove afterward.

3. Lifecycle management:

- Maintain a registry of active Blob URLs tied to chat message IDs.
- Call `URL.revokeObjectURL` when the message/attachment unmounts or is deleted to prevent memory leaks.

## C. Config/flags

1. Add optional feature flag support to force behavior without changing caller code:

- Example: `VITE_FILE_DELIVERY_MODE=attach|autoDownload` (front-end build env).
- Tools default to `'attach'` unless an explicit param is passed; param overrides flag.

## D. Telemetry and UX polish (optional)

1. Log events for attachment created, opened, and downloaded to measure usage.
2. Show file size and a small subtitle with media type for clarity.
3. Graceful error UI if URL creation/opening fails.

## E. Testing

1. Manual flows:

- PDF attach: Open in new tab (viewer), Download with correct filename, message removal revokes URL.
- Markdown attach: Open shows raw text; Download preserves `.md` filename.
- Large files: pagination in PDF still works; URL lifetime ok across navigation.

2. Regression: `autoDownload` still works when opted-in.
3. Memory: Repeated generations don’t leak Blob URLs after message deletion.

## F. Rollout

1. Ship with default `'attach'` delivery.
2. Keep `autoDownload` for legacy scripts; document the new param and flag.
3. Update any call sites relying on immediate downloads if needed.

### To-dos

- [ ] Add deliveryMode param and default attach in generatePDF.tsx
- [ ] Add deliveryMode param and default attach in generateMarkdown.tsx
- [ ] By default, skip auto download and return fileData only
- [ ] Render file attachments with name/size and actions in chat UI
- [ ] Implement Open (new tab) and Download (anchor) attachment actions
- [ ] Track and revoke Blob URLs on message unmount/delete
- [ ] Add VITE_FILE_DELIVERY_MODE flag, param overrides flag
- [ ] Emit logs/analytics for attachment created/opened/downloaded
- [ ] Perform manual tests and regression checks for both modes