# Automatic Token Refresh Implementation

## Overview

Your Notion MCP extension now has **automatic token refresh** that runs in the background before your OAuth token expires. This ensures seamless authentication without user intervention.

## How It Works

### Token Response Format
The Notion OAuth server returns tokens with an expiration time:

```json
{
    "access_token": "ec30d242-0bd4-4f85-9bf5-c8cb8618f177:...",
    "token_type": "bearer",
    "expires_in": 3600,
    "refresh_token": "ec30d242-0bd4-4f85-9bf5-c8cb8618f177:...",
    "scope": ""
}
```

- `expires_in`: **Time in seconds** before the token expires (e.g., 3600 = 1 hour)
- `refresh_token`: Used to get a new access token without re-authenticating

### Automatic Refresh Timeline

```
Initial Auth → Token stored with expires_at timestamp
                ↓
Extension calculates: refresh_time = expires_at - 5 minutes
                ↓
Chrome alarm scheduled for refresh_time
                ↓
5 minutes before expiry → Alarm fires
                ↓
Extension calls refreshNotionToken()
                ↓
New tokens received and stored
                ↓
Next refresh scheduled for new expiry time
```

### Key Components

#### 1. **scheduleTokenRefresh(tokens)**
```typescript
// Schedules an alarm to refresh 5 minutes before expiry
// Input: NotionOAuthTokens with expires_at timestamp
// Output: Chrome alarm created
```

**Timeline Example:**
- Token expires at: 2:00 PM
- Refresh scheduled for: 1:55 PM
- Alarm fires automatically at 1:55 PM

#### 2. **handleTokenRefreshAlarm()**
```typescript
// Called when the alarm fires
// - Checks if MCP is still enabled
// - Calls refreshNotionToken()
// - Schedules the next refresh
```

#### 3. **ensureTokenValidity()**
```typescript
// Called on extension startup/restart
// - Loads stored tokens
// - Checks if expired or about to expire
// - Refreshes if needed
// - Schedules next refresh
```

---

## Behavior by Scenario

### ✅ **Scenario 1: Normal Usage (Browser Open)**

```
1. User authenticates → Token stored
2. Extension schedules alarm for 55 minutes later
3. (55 minutes pass)
4. Alarm fires automatically
5. Token refreshed silently
6. New alarm scheduled for 1 hour later
7. Process repeats
```

**Result:** Token always stays fresh. User sees no interruption.

---

### ✅ **Scenario 2: Browser Closed and Reopened**

```
1. Browser closes (token in storage, refresh scheduled)
2. Time passes...
3. Browser reopens
4. Extension startup handler runs
5. ensureTokenValidity() called
6. - If token still valid: Schedule next refresh
7. - If token expired: Refresh token automatically
8. Connection restored seamlessly
```

**Result:** Token refreshed on startup if needed.

---

### ✅ **Scenario 3: Computer Sleep/Wake**

```
1. Token expires in 2 hours
2. Computer sleeps
3. Computer wakes up 3 hours later
4. Chrome fires missed alarm
5. handleTokenRefreshAlarm() executes
6. Token is refreshed
```

**Result:** Chrome catches up on missed alarms. Token refreshed when system wakes.

---

### ⚠️ **Scenario 4: Extension Disabled**

```
1. Alarm fires
2. handleTokenRefreshAlarm() checks if MCP is enabled
3. If disabled: Skip refresh silently
4. No automatic action taken
```

**Result:** No unnecessary token refreshes when not in use.

---

### ❌ **Scenario 5: Computer Completely Off**

```
1. Computer powers off
2. Cannot run alarms while off
3. Time passes...
4. Computer powers on
5. Extension startup runs
6. ensureTokenValidity() detects expired token
7. Automatically refreshes
```

**Result:** Token refreshed on next startup.

---

### ❌ **Scenario 6: Token Refresh Fails**

```
1. Alarm fires
2. handleTokenRefreshAlarm() attempts refresh
3. Refresh fails (network error, invalid credentials, etc.)
4. Status updated to 'needs-auth'
5. User sees error message in UI
6. User clicks "Connect" to re-authenticate
```

**Result:** Graceful fallback to manual authentication.

---

## Code Integration Points

### 1. **After Getting New Tokens (Authentication)**
```typescript
// In startNotionAuth()
await storeTokens(tokens);
await scheduleTokenRefresh(tokens);  // ← Schedule first refresh
```

### 2. **After Refreshing Tokens**
```typescript
// In refreshNotionToken()
await storeTokens(newTokens);
await scheduleTokenRefresh(newTokens);  // ← Schedule next refresh
```

### 3. **On Extension Startup**
```typescript
// In chrome.runtime.onInstalled and chrome.runtime.onStartup
await ensureTokenValidity();  // ← Check and schedule if needed
```

### 4. **Alarm Handler**
```typescript
// In chrome.alarms.onAlarm.addListener()
if (alarm.name === 'notion-token-refresh') {
    await handleTokenRefreshAlarm();  // ← Handle automatic refresh
}
```

---

## Token Expiration Buffer

The extension uses a **5-minute buffer**:

```typescript
const refreshTime = tokens.expires_at - (5 * 60 * 1000);
```

**Why 5 minutes?**
- Ensures refresh completes before actual expiry
- Handles minor network delays
- Prevents "token expired" errors in API calls

**Example Timeline:**
- Token issued at 1:00 PM
- expires_in = 3600 seconds (1 hour)
- Actual expiry: 2:00 PM
- **Refresh scheduled for: 1:55 PM** (5 min buffer)
- Refresh completes: 1:56 PM
- New token valid until 2:56 PM

---

## Monitoring and Debugging

### Check Token Refresh in Browser Console

Open Chrome DevTools and check the background service worker logs:

```javascript
// Shows all token refresh activity
// Look for messages like:
// "[Background] Token refresh scheduled: ..."
// "[Background] Token refreshed successfully, next refresh scheduled"
```

### View Scheduled Alarms

```javascript
// In DevTools console:
chrome.alarms.getAll((alarms) => console.log(alarms));

// Output shows:
// [{ name: 'notion-token-refresh', scheduledTime: 1698324000000 }]
```

### Check Stored Tokens

```javascript
// View current tokens in storage:
chrome.storage.local.get('mcp.notion.tokens', (result) => {
    console.log('Stored tokens:', result);
});
```

---

## Edge Cases Handled

| Case | Behavior |
|------|----------|
| Token already expired on startup | Refresh immediately on startup |
| Refresh alarm fires while disabled | Skip silently, don't refresh |
| Multiple alarms scheduled | Previous alarm cleared automatically |
| Network error during refresh | Show error in UI, user can retry |
| Refresh token also expired | Clear all tokens, require re-auth |
| Computer off when alarm should fire | Fire alarm when browser restarts |
| Very short token lifetime (<5 min) | Warning logged, refresh attempted ASAP |

---

## Performance Impact

- **Memory:** Minimal (single alarm scheduled at a time)
- **Network:** One refresh request per hour (configurable)
- **CPU:** Negligible (executes once per token lifetime)
- **Battery:** No impact when computer is off

---

## Security Features

✅ **CSRF Protection:** State parameter validated in OAuth flow  
✅ **Token Encryption:** Tokens stored in Chrome's encrypted storage  
✅ **Automatic Refresh:** No user action needed (reduces token exposure time)  
✅ **Graceful Degradation:** Falls back to re-auth if refresh fails  
✅ **Scope Limiting:** Tokens only used with authorized endpoints  

---

## Configuration

Current settings in `background.ts`:

```typescript
// Refresh this many minutes before expiry
const bufferTime = 5 * 60 * 1000;  // 5 minutes

// Token considered expired if within this buffer
// (from oauth.ts)
const bufferTime = 5 * 60 * 1000;  // 5 minutes
```

To adjust, modify these values in the respective files.

---

## Troubleshooting

### Tokens Not Refreshing

1. Check DevTools logs for error messages
2. Verify MCP is enabled: `chrome.storage.local.get('mcp.notion.enabled')`
3. Check stored credentials: `chrome.storage.local.get('mcp.notion.client')`
4. Restart extension: Unload and reload from chrome://extensions

### Refresh Alarms Not Firing

1. Verify alarm was created: `chrome.alarms.getAll()`
2. Check browser DevTools console for errors
3. Ensure extension has "Alarms" permission (check manifest.json)
4. Try manual refresh from UI button

### Token Expiry on First Use

1. Check token lifetime from OAuth response
2. May need longer buffer if network is slow
3. Adjust bufferTime in scheduleTokenRefresh()

---

## Future Enhancements

- [ ] Configurable refresh buffer time
- [ ] Manual refresh via UI button (already implemented ✓)
- [ ] Token refresh metrics and analytics
- [ ] Exponential backoff for failed refreshes
- [ ] Support for multiple MCP servers
- [ ] Webhook notifications for token refresh events
