# MCP PAT/API Key Authentication Implementation Plan

## Goal
Enable users to authenticate with MCP servers using Personal Access Tokens (PAT) or API Keys, starting with GitHub. This should be a generic implementation that allows any server to be configured with a key/token input.

## Analysis

### Current Architecture
- **Configuration**: Defined in `apps/extension/src/constants/mcpServers.tsx` (`ServerConfig`). Currently assumes OAuth for authenticated servers.
- **Storage**: tokens are stored in `chrome.storage.local` via `storeTokens` in `oauth.ts`.
- **Connection**: `connectMcpServer` in `background/mcp/manager.ts` calls `ensureValidToken` which triggers OAuth if no token exists.
- **Transport**: `McpSSEClient` and `TransportDetector` inject the token into the `Authorization` header.

### Requirements
1.  **Extensible Configuration**: Add fields to `ServerConfig` to define PAT support (label, placeholder, validation).
2.  **UI Data Entry**: Allow users to input the PAT securely.
3.  **Validation**: Verify the PAT before saving.
4.  **Storage**: Securely store the PAT.
5.  **Integration**: Use the stored PAT for connections, bypassing OAuth.

## Implementation Steps

### Phase 1: Configuration Schema Update
Modify `apps/extension/src/constants/mcpServers.tsx`:
- Update `ServerConfig` interface to include optional `authConfig`:
  ```typescript
  interface AuthConfig {
    type: 'oauth' | 'pat' | 'hybrid'; // hybrid = try PAT, fall back to OAuth? Or user choice.
    patConfig?: {
      label: string; // e.g. "GitHub Personal Access Token"
      placeholder: string; // e.g. "ghp_..."
      helpUrl?: string; // Link to "How to create a token"
      validationUrl?: string; // URL to test the token against (e.g. https://api.github.com/user)
      validationMethod?: 'GET' | 'POST';
      validationHeaders?: Record<string, string>; // Extra headers if needed
    }
  }
  ```
- Update the **GitHub** server entry to include this configuration.

### Phase 2: Backend Logic (Storage & Connection)
Modify `apps/extension/src/mcp/oauth.ts`:
- Add `storePat(serverId: string, token: string)`: Store as a standard access token structure (mocking the OAuth token structure to reuse existing client logic).
  - Key: `oauth.${serverId}.tokens`
  - Value: `{ access_token: token, scope: 'pat', expires_at: 9999999999999 }` (long expiry)

Modify `apps/extension/src/background/mcp/manager.ts`:
- `connectMcpServer` currently calls `ensureValidToken`.
- If `authConfig.type === 'pat'`, logic should skip dynamic discovery if a valid token already exists.

### Phase 3: UI Implementation
Modify `apps/extension/src/components/features/mcp/McpServerCard.tsx`:
- Logic: When "Connect" is clicked for a server with `patConfig`, show a **Connect Dialog** instead of immediately triggering OAuth.
- **Connect Dialog**:
  - Input field for the token.
  - "Validate & Connect" button.
  - Validation logic:
    - Call the background to validate (or validate directly in frontend if CORS allows, but background `fetch` is safer).
    - If valid, save via `storePat` and trigger connection.

### Phase 4: Validation Logic
Create a validation helper in `apps/extension/src/mcp/validation.ts` (new file) or `authHelpers.ts`:
- `validatePat(url: string, token: string)`:
  - Perform a fetch to the `validationUrl` with `Authorization: Bearer <token>`.
  - Return `true` if 200 OK.

## Verification Plan

### Manual Verification
1.  **UI Check**: Verify GitHub card "Connect" button opens the dialog.
2.  **Input Check**: Verify label and placeholder match config.
3.  **Validation Failure**: Enter invalid token -> Expect error message.
4.  **Validation Success**: Enter valid token -> Expect success -> Card shows "Connected".
5.  **Persistence**: Reload extension -> Check if still connected.
6.  **Functionality**: Use Chat to talk to GitHub Agent (which uses the MCP connection).

### Automated Testing
-   Create a script `scripts/test-pat-auth.ts` (similar to the one created during research) to unit test the validation logic and storage logic in isolation if possible.

