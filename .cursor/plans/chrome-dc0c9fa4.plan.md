<!-- dc0c9fa4-3381-4270-848b-5123d869ea7b 210c22ab-e146-4729-a797-ea94f0f039a7 -->
# Implement Natural-Language Reminders in Chrome Side Panel

## Scope

- Parse reminder intent in chat (e.g., “remind me to apply tomorrow”).
- Confirm/adjust time with a small time picker rendered via `useHumanInTheLoop` before scheduling.
- Schedule with `chrome.alarms` and persist in `chrome.storage.local`.
- On alarm, show a Chrome notification (no auto-open UI).
- Update side panel system prompt to proactively suggest reminders.

References:

- CopilotKit `useHumanInTheLoop`: https://docs.copilotkit.ai/reference/hooks/useHumanInTheLoop

### Hook API notes for `useHumanInTheLoop`

- Pass `name`, `description`, and `parameters` as usual, plus a `render` function that returns a promise with the user's response. Do NOT pass `renderAndWaitForResponse`; the hook maps `render` to `renderAndWaitForResponse` internally per the installed implementation.
- `available` accepts `"disabled" | "enabled"`, but the hook converts any non-`"disabled"` value to `"remote"`. Omit `available` or set to `"enabled"` for normal use; use `"disabled"` to prevent availability.
- Type parameter is `Parameter[] | []` (from `@copilotkit/shared`).
- Internally the hook registers via `useCopilotAction` with `available: "remote"` when not disabled, so plan UI flows accordingly.

Minimal usage example (aligns with both docs and installed hook):

```ts
useHumanInTheLoop({
  name: "confirm-reminder-time",
  description: "Confirm or adjust reminder date/time before scheduling",
  parameters: [
    { name: "title", type: "string" },
    { name: "when", type: "number" }, // epoch ms
  ],
  render: async ({ args, resolve, reject }) => {
    // Render `ReminderTimePicker` with args and call resolve(updatedArgs) on confirm
  },
});
```

Doc reference: `https://docs.copilotkit.ai/reference/hooks/useHumanInTheLoop`.

## Files to Add

- `src/actions/reminders.tsx`: Register Copilot action(s) to create/manage reminders. Use CopilotKit + `useHumanInTheLoop` to render a compact time picker/clock.
- `src/components/ReminderTimePicker.tsx`: Minimal, accessible time/date UI (respects existing CSS variables per `styles/variables.css` and branding) [[memory:7430718]].

## Files to Update

- `src/actions/registerAll.ts`: Import and call `registerReminderActions()`.
- `src/sidepanel.tsx`:
  - Expand `useCopilotReadable` system prompt with new capabilities: “I can set reminders… default to 9:00 AM local when the user says ‘tomorrow’… suggest setting a reminder when deadlines are detected.”
  - Ensure suggestion surface (e.g., quick-suggest messages) includes: “Do you want me to set a reminder for this?”
- `src/background.ts`:
  - Add `chrome.alarms.onAlarm` handler for reminder alarms: read reminder payload, show `chrome.notifications.create`, and clean up.
  - Ensure unique alarm names `reminder:<id>`.

## Permissions/Manifest

- Ensure MV3 permissions include: `alarms`, `notifications`, `storage`. If missing, add to the extension manifest source (where it’s defined in this repo) so Plasmo/packaging includes them.

## Data Model

- `Reminder` shape in `chrome.storage.local` under key `reminders` (map by `id`):
  - `id`: string
  - `title`: string (what to remind about)
  - `when`: number (epoch ms)
  - `url?`: string (current tab URL, optional)
  - `createdAt`: number (epoch ms)

## UX Behavior

- Parsing: The action extracts structured fields (title, date/time) from the user message; when time is missing but date exists, default to 9:00 AM local.
- HITL confirmation: `useHumanInTheLoop` renders `ReminderTimePicker` with prefilled values. User can adjust time/date then press Confirm.
- Scheduling: On confirm, create `chrome.alarms.create('reminder:'+id, { when })` and persist to storage.
- Firing: `chrome.notifications.create` with title and message. No side panel opening. Dismissal removes reminder entry.
- Accessibility/Branding: Use existing CSS variables and ensure keyboard navigation + visible focus [[memory:7430718]].

## Essential Snippets (illustrative)

- Scheduling in action (conceptual):
```ts
const id = crypto.randomUUID();
await chrome.storage.local.set({ reminders: { ...(existing||{}), [id]: reminder } });
chrome.alarms.create(`reminder:${id}`, { when: reminder.when });
```

- Alarm handler in `background.ts` (conceptual):
```ts
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith('reminder:')) return;
  const id = alarm.name.split(':')[1];
  const { reminders = {} } = await chrome.storage.local.get('reminders');
  const reminder = reminders[id];
  if (reminder) {
    chrome.notifications.create(id, { title: 'Reminder', message: reminder.title, type: 'basic', iconUrl: 'icons/icon48.png' });
    delete reminders[id];
    await chrome.storage.local.set({ reminders });
  }
});
```


## Acceptance Criteria

- Saying “Remind me to apply for this job tomorrow” prompts a time UI with default 9:00 AM local for tomorrow.
- After confirm, a scheduled alarm exists; reminder persists across extension reload.
- At the time, a notification appears; no new tabs/panels open.
- The side panel prompt visibly suggests reminder setting when relevant.
- All UI matches existing style tokens and is keyboard-accessible [[memory:7430718]].

### To-dos

- [ ] Create Copilot actions in src/actions/reminders.tsx using useHumanInTheLoop
- [ ] Wire registerReminderActions in src/actions/registerAll.ts
- [ ] Add ReminderTimePicker component with brand-compliant styling
- [ ] Handle reminder alarms and notifications in src/background.ts
- [ ] Expand sidepanel prompt and suggestions to include reminders
- [ ] Verify/add alarms, notifications, storage permissions in manifest source