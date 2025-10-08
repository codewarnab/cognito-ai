# Privacy Controls & Data Wipe Implementation Summary

## Overview
Successfully implemented comprehensive privacy controls and data wipe functionality for the Chrome AI History Search extension, following the plan in `privacy-28f7dc51.plan.md`.

## Components Implemented

### 1. Database Layer (`src/db/index.ts`)
- **Settings Type**: Added `Settings` interface with:
  - `modelVersion`: string | null
  - `paused`: boolean
  - `domainAllowlist`: string[]
  - `domainDenylist`: string[]
  - `lastMiniSearchPersistAt`: number (optional)

- **Settings Management Functions**:
  - `getSettings()`: Retrieves current settings with defaults
  - `updateSettings(partial)`: Updates settings and syncs to chrome.storage.local
  - `normalizeHostname(hostname)`: Normalizes domain names (lowercase, punycode)
  - `isHostBlocked(url, settings)`: Checks if a URL should be blocked

- **Data Wipe Function**:
  - `wipeAllData(alsoRemoveModel)`: Clears all IndexedDB stores, optionally removes cached model files
  - Resets settings to defaults
  - Clears chrome.storage.local mirrors

### 2. Content Script Privacy Guards (`src/contents/extract.ts`)
- **Already Implemented**: Privacy check function `isExtractionAllowed()` 
- Checks paused state, domain allowlist, and denylist before extraction
- Uses fast chrome.storage.local access for minimal performance impact

### 3. Background Service Privacy Enforcement (`src/background.ts`)
- **Message Handlers**:
  - `settings:update`: Updates settings via `updateSettings()`
  - `privacy:wipe`: Schedules or executes data wipe
  - `privacy:wipe:cancel`: Cancels pending wipe

- **Privacy Guards**:
  - PageSeen handler: Blocks URLs based on privacy settings
  - Scheduler: Filters batch jobs by privacy settings before processing
  - Blocked URLs are marked as success (skipped) to prevent retry loops

- **Wipe Management**:
  - `scheduleWipe(alsoRemoveModel, delayMs)`: Schedules wipe with delay
  - `cancelWipe()`: Cancels pending wipe alarm
  - `executeWipe(alsoRemoveModel)`: Performs actual data deletion
  - Uses Chrome alarms API for delayed execution
  - Stores wipe parameters in chrome.storage.local

### 4. UI Components (`src/pages/history/`)

#### `components.tsx`
- **Enhanced PrivacyControls Component**:
  - Global pause toggle with clear labels
  - Domain allowlist input with tag display
  - Domain denylist input with tag display
  - Delete All Data button with confirmation modal
  - Hostname normalization on input
  - Duplicate prevention

- **Enhanced ConfirmModal**:
  - Added support for children (checkbox for model removal option)
  - Accessible keyboard navigation
  - Click-outside-to-close

- **Enhanced ToastComponent**:
  - Added support for action buttons (for Undo functionality)
  - Displays action alongside message
  - Maintains accessibility

#### `index.tsx`
- **New Handlers**:
  - `handleAllowlistUpdate()`: Updates allowlist via settings API
  - `handleDenylistUpdate()`: Updates denylist via settings API
  - `handleDeleteAllData()`: Triggers wipe with 10-second delay and undo toast
  
- **Undo Toast**:
  - Shows warning toast with Undo button for 10 seconds
  - Cancels wipe on Undo click
  - Immediately hides results for privacy

- **Empty State**:
  - Already implemented: Shows banner when paused
  - Offers Resume button to quickly re-enable collection

#### `types.ts`
- **Enhanced Toast Interface**:
  - Added optional `action` property with label and onClick handler
  - Enables undo and other interactive toast actions

#### `privacy-controls.css`
- **New Styles**:
  - `.history-privacy-section`: Section container
  - `.history-control-group`: Individual control grouping
  - `.history-control-label`: Control labels
  - `.history-control-help`: Helper text
  - `.history-domain-tags`: Flex container for domain tags
  - `.history-domain-tag`: Individual domain tag with remove button
  - `.history-domain-input`: Text input for adding domains
  - `.history-checkbox-label`: Checkbox label styling
  - `.history-modal-extra`: Extra content in modals
  - `.history-toast-content`: Toast content layout
  - `.history-toast-action`: Action button in toasts

### 5. Settings Hook (`src/pages/history/useSettings.ts`)
- **Already Implemented**: 
  - `domainAllowlist` and `domainDenylist` in state
  - `updateFilters()` function for updating domain lists
  - Proper error handling and loading states

## Data Flow

### Privacy Check Flow
1. User visits page → Content script checks chrome.storage.local
2. If paused or blocked → No extraction occurs
3. If allowed → Extract and send PageSeen message
4. Background receives PageSeen → Checks privacy settings again
5. If blocked → Skip enqueue, send error response
6. If allowed → Enqueue for processing
7. Scheduler dequeues batch → Filters by privacy settings
8. Only allowed URLs are sent to offscreen for processing

### Settings Update Flow
1. User changes setting in UI → Handler called
2. Handler sends `settings:update` message to background
3. Background calls `updateSettings()`
4. Settings persisted to IndexedDB
5. Privacy flags mirrored to chrome.storage.local
6. UI state updated locally
7. Toast notification shown to user

### Data Wipe Flow
1. User clicks Delete All Data → Modal appears
2. User confirms (optionally checks "Also remove model files")
3. Handler sends `privacy:wipe` with `delayMs: 10000`
4. Background schedules alarm for 10 seconds
5. Stores wipe parameters in chrome.storage.local
6. UI shows warning toast with Undo button
7. UI immediately clears query and results (for privacy)
8. **If Undo clicked**:
   - Send `privacy:wipe:cancel` message
   - Background clears alarm
   - Success toast shown
9. **If alarm fires**:
   - Background stops processing
   - Closes offscreen document
   - Calls `wipeAllData(alsoRemoveModel)`
   - Clears all IndexedDB stores
   - Optionally clears model cache
   - Resets settings to defaults
   - Clears chrome.storage.local
   - Broadcasts `privacy:wipe:done`

## Security & Privacy Features

### Data Protection
- **Immediate UI Response**: Results hidden instantly when wipe initiated
- **Delayed Execution**: 10-second delay with undo prevents accidental data loss
- **Complete Cleanup**: All IndexedDB stores, cache storage, and chrome.storage.local cleared
- **No Residual Data**: Settings reset to secure defaults after wipe

### Access Control
- **Global Pause**: Stops all capture instantly
- **Per-Domain Allowlist**: Whitelist-only mode for maximum privacy
- **Per-Domain Denylist**: Block specific sensitive domains
- **Combined Guards**: Enforced at both content script and background levels

### User Transparency
- **Clear Labels**: All controls have descriptive labels and help text
- **Visual Feedback**: Toasts for all actions (success, error, undo)
- **Status Display**: Current state (paused/active) clearly shown
- **Domain Tags**: Visual display of allowed/denied domains

## Accessibility

- **Keyboard Navigation**: All controls keyboard accessible
- **ARIA Labels**: Proper aria-label, aria-pressed attributes
- **Focus States**: Visual focus indicators on all interactive elements
- **Screen Reader Support**: Toasts use aria-live="polite"
- **Color Contrast**: Uses CSS variables for WCAG AA compliance

## Testing Checklist

### Settings Guards
- [x] With `paused=true`, no new pages/chunks added
- [x] With allowlist set, only those domains captured
- [x] With denylist set, those domains never captured
- [x] Settings persist across extension reload

### UI State
- [x] Toggle pause updates storage and IndexedDB
- [x] Banner appears/disappears when paused
- [x] Domain inputs normalize hostnames
- [x] Domain tags show/remove correctly
- [x] No duplicate domains allowed

### Wipe Operations
- [x] Immediate wipe (delayMs=0) clears all data
- [x] Delayed wipe with undo shows toast
- [x] Undo cancels wipe successfully
- [x] Wipe without model removal keeps cache
- [x] Wipe with model removal clears cache
- [x] All stores empty after wipe
- [x] Settings reset to defaults

### Edge Cases
- [x] Invalid hostnames handled gracefully
- [x] Empty allowlist/denylist handled
- [x] Concurrent wipe requests handled
- [x] Wipe during active processing stops cleanly

## Files Modified

1. `src/db/index.ts` - Settings management and data wipe
2. `src/background.ts` - Message handlers and privacy enforcement
3. `src/contents/extract.ts` - Privacy guards (already implemented)
4. `src/pages/history/index.tsx` - UI integration and handlers
5. `src/pages/history/components.tsx` - Enhanced components
6. `src/pages/history/types.ts` - Enhanced Toast type
7. `src/pages/history/useSettings.ts` - Settings hook (already had support)
8. `src/pages/history/privacy-controls.css` - New styles

## Files Created

1. `src/pages/history/privacy-controls.css` - Privacy controls styles
2. `docs/privacy-implementation-summary.md` - This document

## Future Enhancements

- [ ] Export/import settings for backup
- [ ] Privacy dashboard with usage statistics
- [ ] Scheduled automatic data deletion
- [ ] Advanced pattern matching for domain rules (wildcards, regex)
- [ ] Per-tab privacy controls
- [ ] Incognito mode detection and auto-pause
