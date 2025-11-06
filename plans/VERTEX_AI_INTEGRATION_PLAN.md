# Vertex AI Integration Plan

## Overview
Add support for Google Vertex AI alongside existing Google Generative AI, allowing users to choose between providers with appropriate configuration options.

## Requirements Summary
- ✅ Support both Google Generative AI and Vertex AI providers
- ✅ Radio button selection in settings dialog
- ✅ Store credentials in same storage location
- ✅ Default to Vertex AI if both are configured
- ✅ Same model options (gemini-2.5-flash, gemini-2.5-pro)
- ✅ Vertex AI as part of remote mode (no separate mode)
- ✅ No backward compatibility concerns

---

## Technical Requirements

### Google Generative AI (Current)
- **Package**: `@ai-sdk/google` (already installed)
- **Authentication**: API key only
- **Storage**: `gemini_api_key`
- **Usage**: `google('gemini-2.5-flash')`

### Vertex AI (New)
- **Package**: `@ai-sdk/google-vertex` (needs installation)
- **Authentication** (Edge Runtime for Chrome Extension):
  - Project ID (required)
  - Location (required, default: `us-central1`)
  - Client Email (required)
  - Private Key (required)
  - Private Key ID (optional)
- **Usage**: 
  ```typescript
  import { createVertex } from '@ai-sdk/google-vertex';
  const vertex = createVertex({
    project: 'my-project',
    location: 'us-central1',
    googleCredentials: {
      clientEmail: 'email@project.iam.gserviceaccount.com',
      privateKey: '-----BEGIN PRIVATE KEY-----...',
      privateKeyId: 'optional-key-id'
    }
  });
  const model = vertex('gemini-2.5-flash');
  ```

---

## Implementation Phases

### Phase 1: Dependencies & Type Definitions

**Goal**: Install required packages and define TypeScript types

#### Tasks:
1. **Install Vertex AI package**
   ```bash
   pnpm add @ai-sdk/google-vertex
   ```

2. **Update type definitions** (`src/ai/types/types.ts`)
   - Add provider type: `'google' | 'vertex'`
   - Keep existing `AIMode` as is (local/remote)
   - Update storage schema types

3. **Create new types file** (`src/utils/providerTypes.ts`)
   ```typescript
   export type AIProvider = 'google' | 'vertex';
   
   export interface VertexCredentials {
     projectId: string;
     location: string;
     clientEmail: string;
     privateKey: string;
     privateKeyId?: string;
   }
   
   export interface ProviderConfig {
     provider: AIProvider;
     googleApiKey?: string;
     vertexCredentials?: VertexCredentials;
   }
   ```

#### Files to Create/Modify:
- `src/utils/providerTypes.ts` (new)
- `src/ai/types/types.ts` (modify)
- `package.json` (dependency)

---

### Phase 2: Storage & Configuration

**Goal**: Extend storage schema to support both providers

#### Tasks:
1. **Create provider credentials utility** (`src/utils/providerCredentials.ts`)
   - `getProviderConfig()`: Get current provider and credentials
   - `setProviderConfig()`: Set provider configuration
   - `getVertexCredentials()`: Get Vertex credentials
   - `setVertexCredentials()`: Set Vertex credentials
   - `hasVertexCredentials()`: Check if Vertex is configured
   - `clearVertexCredentials()`: Remove Vertex credentials
   - `getActiveProvider()`: Determine which provider to use (Vertex if both configured)

2. **Storage schema**:
   ```typescript
   {
     // Existing
     gemini_api_key: string,
     ai_model_config: {
       mode: 'local' | 'remote',
       remoteModel: 'gemini-2.5-flash' | 'gemini-2.5-pro',
       conversationStartMode?: 'local' | 'remote'
     },
     
     // New
     ai_provider_config: {
       provider: 'google' | 'vertex',
       googleApiKey?: string,  // Migrate from gemini_api_key
       vertexCredentials?: {
         projectId: string,
         location: string,
         clientEmail: string,
         privateKey: string,
         privateKeyId?: string
       }
     }
   }
   ```

3. **Update `geminiApiKey.ts`**
   - Keep existing functions for backward compatibility
   - Add migration logic to move API key to new schema
   - Mark functions as deprecated (but still functional)

#### Files to Create/Modify:
- `src/utils/providerCredentials.ts` (new)
- `src/utils/geminiApiKey.ts` (modify - add migration)
- `src/utils/modelSettings.ts` (modify - add provider preference)

---

### Phase 3: Model Initialization

**Goal**: Create centralized model initialization logic

#### Tasks:
1. **Create model factory** (`src/ai/core/modelFactory.ts`)
   ```typescript
   export interface ModelInitResult {
     model: any;
     provider: AIProvider;
     modelName: string;
   }
   
   export async function initializeModel(
     modelName: string,
     mode: AIMode
   ): Promise<ModelInitResult> {
     if (mode === 'local') {
       return initializeLocalModel();
     }
     
     // Determine provider (Vertex if both configured)
     const activeProvider = await getActiveProvider();
     
     if (activeProvider === 'vertex') {
       return initializeVertexModel(modelName);
     } else {
       return initializeGoogleModel(modelName);
     }
   }
   
   async function initializeVertexModel(modelName: string) {
     const credentials = await getVertexCredentials();
     if (!credentials) {
       throw new APIError('Vertex credentials not configured');
     }
     
     const vertex = createVertex({
       project: credentials.projectId,
       location: credentials.location,
       googleCredentials: {
         clientEmail: credentials.clientEmail,
         privateKey: credentials.privateKey,
         privateKeyId: credentials.privateKeyId
       }
     });
     
     return {
       model: vertex(modelName),
       provider: 'vertex',
       modelName
     };
   }
   
   async function initializeGoogleModel(modelName: string) {
     const apiKey = await validateAndGetApiKey();
     const google = createGoogleGenerativeAI({ 
       apiKey, 
       fetch: customFetch 
     });
     
     return {
       model: google(modelName),
       provider: 'google',
       modelName
     };
   }
   ```

2. **Extract custom fetch logic** (`src/ai/utils/fetchHelpers.ts`)
   - Move custom fetch from remoteMode.ts
   - Reusable for both providers

#### Files to Create/Modify:
- `src/ai/core/modelFactory.ts` (new)
- `src/ai/utils/fetchHelpers.ts` (new)
- `src/ai/setup/remoteMode.ts` (modify - use modelFactory)

---

### Phase 4: UI Components

**Goal**: Update settings dialog to support provider selection

#### Tasks:
1. **Rename and update dialog** (`src/components/shared/dialogs/ProviderSetupDialog.tsx`)
   - Rename from `GeminiApiKeyDialog` to `ProviderSetupDialog`
   - Add provider selection with radio buttons
   - Conditional field display based on provider
   - Form validation for Vertex fields

2. **Provider selection UI**:
   ```tsx
   <div className="provider-selector">
     <label>AI Provider</label>
     <div className="radio-group">
       <label>
         <input 
           type="radio" 
           value="google" 
           checked={provider === 'google'}
           onChange={() => setProvider('google')}
         />
         <span>Google Generative AI</span>
         <small>Use AI Studio API key</small>
       </label>
       <label>
         <input 
           type="radio" 
           value="vertex" 
           checked={provider === 'vertex'}
           onChange={() => setProvider('vertex')}
         />
         <span>Google Vertex AI</span>
         <small>Use service account credentials</small>
       </label>
     </div>
   </div>
   ```

3. **Conditional fields**:
   - **Google provider**: Show API key input (current)
   - **Vertex provider**: Show 5 fields:
     - Project ID (text input)
     - Location (text input with default: us-central1)
     - Client Email (text input)
     - Private Key (textarea)
     - Private Key ID (text input, optional)

4. **Help text updates**:
   - Google: Link to AI Studio
   - Vertex: Link to Google Cloud Console with instructions
     ```
     Get credentials from Google Cloud Console:
     1. Go to IAM & Admin → Service Accounts
     2. Create or select a service account
     3. Create a JSON key
     4. Copy the values from the JSON file to the fields above
     ```

5. **Validation**:
   - Validate all required Vertex fields
   - Show helpful error messages
   - Test credentials button (optional enhancement)

#### Files to Create/Modify:
- `src/components/shared/dialogs/ProviderSetupDialog.tsx` (rename/modify)
- `src/components/shared/dialogs/index.ts` (update exports)
- All files importing `GeminiApiKeyDialog` (update imports)

---

### Phase 5: Integration & Updates

**Goal**: Update aiLogic.ts and related files to use new model factory

#### Tasks:
1. **Update `aiLogic.ts`**
   - Import `initializeModel` from modelFactory
   - Remove direct model initialization
   - Use factory for both local and remote modes
   - Pass provider info to error handlers

2. **Update remote mode setup** (`src/ai/setup/remoteMode.ts`)
   - Use `initializeModel` instead of direct initialization
   - Keep tool configuration logic
   - Update function signature to accept provider

3. **Enhance error handlers** (`src/ai/errors/handlers.ts`) - **IMPORTANT**
   - Parse Vertex AI specific error codes (see details below)
   - Handle provider-specific error messages
   - Mark appropriate credentials as invalid based on provider
   - Add Vertex error code mapping

4. **Update validation logic**
   - Check for Vertex credentials availability
   - Validate Vertex credentials format
   - Update `hasGeminiApiKey` to check both providers

#### Files to Modify:
- `src/ai/core/aiLogic.ts`
- `src/ai/setup/remoteMode.ts`
- `src/ai/errors/handlers.ts` (major updates needed)
- `src/utils/geminiApiKey.ts` (validation updates)

---

### Phase 6: Provider Preference Logic

**Goal**: Implement "default to Vertex if both configured" logic

#### Tasks:
1. **Update `getActiveProvider()` in providerCredentials.ts**
   ```typescript
   export async function getActiveProvider(): Promise<AIProvider> {
     const config = await getProviderConfig();
     
     // If user explicitly selected a provider, use it
     if (config.provider) {
       return config.provider;
     }
     
     // Otherwise, default to Vertex if both are configured
     const hasVertex = await hasVertexCredentials();
     const hasGoogle = await hasGoogleApiKey();
     
     if (hasVertex && hasGoogle) {
       return 'vertex'; // Default to Vertex
     } else if (hasVertex) {
       return 'vertex';
     } else if (hasGoogle) {
       return 'google';
     }
     
     // No credentials configured
     throw new Error('No AI provider configured');
   }
   ```

2. **Update model initialization**
   - Always check active provider before initialization
   - Log which provider is being used
   - Handle fallback scenarios

3. **Add provider indicator in UI**
   - Show current provider in chat header
   - Allow manual provider override in settings

#### Files to Modify:
- `src/utils/providerCredentials.ts`
- `src/ai/core/modelFactory.ts`
- `src/components/features/chat/components/ChatHeader.tsx` (optional)

---

## Migration Strategy

### For Existing Users (If Needed)
1. **Auto-migrate API keys**
   - Check for `gemini_api_key` in storage
   - If exists and new schema doesn't, migrate automatically
   - Keep old key for compatibility

2. **Migration function** (`src/utils/migration.ts`)
   ```typescript
   export async function migrateToNewProviderSchema() {
     // Check if already migrated
     const newConfig = await chrome.storage.local.get('ai_provider_config');
     if (newConfig.ai_provider_config) {
       return; // Already migrated
     }
     
     // Get old API key
     const oldKey = await chrome.storage.local.get('gemini_api_key');
     
     if (oldKey.gemini_api_key) {
       // Migrate to new schema
       await setProviderConfig({
         provider: 'google',
         googleApiKey: oldKey.gemini_api_key
       });
       
       console.log('Migrated API key to new provider schema');
     }
   }
   ```

3. **Run migration on extension startup**
   - Call migration function in background script
   - Or on first settings dialog open

---

## Testing Checklist

### Unit Tests
- [ ] Provider credential storage/retrieval
- [ ] Model factory initialization
- [ ] Provider selection logic
- [ ] Migration script

### Integration Tests
- [ ] Google provider with API key
- [ ] Vertex provider with service account
- [ ] Switching between providers
- [ ] Default to Vertex when both configured
- [ ] Error handling for missing credentials

### UI Tests
- [ ] Provider selection radio buttons
- [ ] Conditional field display
- [ ] Form validation
- [ ] Save/remove functionality
- [ ] Help text and links

### End-to-End Tests
- [ ] Complete flow with Google provider
- [ ] Complete flow with Vertex provider
- [ ] Tool execution with both providers
- [ ] Error messages display correctly
- [ ] Migration from old to new schema

---

## Documentation Updates

### User Documentation
1. **Setup Guide**
   - How to get Google AI Studio API key
   - How to get Vertex AI service account credentials
   - Which provider to choose

2. **Configuration Guide**
   - Provider selection
   - Credential management
   - Troubleshooting common issues

### Developer Documentation
1. **Architecture**
   - Provider abstraction layer
   - Model factory pattern
   - Storage schema

2. **Adding New Providers**
   - Template for future providers
   - Integration points

---

## File Structure Summary

```
src/
├── ai/
│   ├── core/
│   │   ├── aiLogic.ts (modify)
│   │   └── modelFactory.ts (new)
│   ├── setup/
│   │   └── remoteMode.ts (modify)
│   ├── utils/
│   │   └── fetchHelpers.ts (new)
│   └── errors/
│       ├── handlers.ts (modify - make provider-aware)
│       └── vertexErrorParser.ts (new)
├── components/
│   └── shared/
│       └── dialogs/
│           ├── ProviderSetupDialog.tsx (rename from GeminiApiKeyDialog)
│           └── index.ts (update exports)
├── errors/
│   └── errorTypes.ts (modify - add Vertex error types)
├── utils/
│   ├── providerTypes.ts (new)
│   ├── providerCredentials.ts (new)
│   ├── geminiApiKey.ts (modify)
│   ├── modelSettings.ts (modify)
│   └── migration.ts (new)
└── types/
    └── ... (type updates as needed)
```

---

## Implementation Order

1. ✅ **Phase 1**: Dependencies & Types (1-2 hours)
   - Install package
   - Define types
   - No breaking changes

2. ✅ **Phase 2**: Storage & Configuration (2-3 hours)
   - Create credential utilities
   - Extend storage schema
   - Migration logic

3. ✅ **Phase 3**: Model Initialization (3-4 hours)
   - Create model factory
   - Extract common logic
   - Test both providers

4. ✅ **Phase 4**: UI Components (3-4 hours)
   - Update dialog
   - Add provider selection
   - Form validation

5. ✅ **Phase 5**: Integration & Error Handling (4-5 hours) - **Extended**
   - 5a: Add Vertex error types (30 min)
   - 5b: Create Vertex error parser (1 hour)
   - 5c: Update handlers to be provider-aware (1 hour)
   - 5d: Update retry logic (1 hour)
   - 5e: Update error messages in UI (30 min)
   - Update aiLogic.ts (1 hour)

6. ✅ **Phase 6**: Provider Preference (1-2 hours)
   - Implement default logic
   - Add UI indicators
   - Final testing

**Total Estimated Time**: 14-20 hours (increased due to comprehensive error handling)

---

## Risks & Mitigation

### Risk 1: Vertex AI Authentication Complexity
**Mitigation**: 
- Comprehensive validation
- Clear error messages
- Detailed documentation with examples

### Risk 2: Breaking Existing Functionality
**Mitigation**: 
- Keep old API key functions working
- Gradual migration
- Extensive testing

### Risk 3: User Confusion
**Mitigation**: 
- Clear UI labels
- Help text for each provider
- Default sensible options

### Risk 4: Credential Security
**Mitigation**: 
- Use Chrome's secure storage
- Don't log sensitive data
- Clear credentials on removal

### Risk 5: Vertex-Specific Errors Not Handled
**Mitigation**:
- Comprehensive error type mapping
- Provider-aware error parsing
- Clear user guidance for each error type
- Testing with various error scenarios

---

## Success Criteria

1. ✅ Users can configure Google Generative AI (existing)
2. ✅ Users can configure Vertex AI (new)
3. ✅ Provider selection is intuitive
4. ✅ Vertex is preferred when both configured
5. ✅ Same models available for both providers
6. ✅ Error messages are provider-specific
7. ✅ No breaking changes to existing users
8. ✅ All existing features work with both providers

---

## Future Enhancements

1. **Test Connection Button**
   - Validate credentials before saving
   - Show connection status

2. **Provider Auto-Detection**
   - Detect which provider has valid credentials
   - Auto-switch to working provider

3. **Cost Tracking**
   - Show estimated costs per provider
   - Help users choose cost-effective option

4. **Multiple Service Accounts**
   - Support multiple Vertex projects
   - Switch between them easily

5. **Import/Export Configuration**
   - Export settings as JSON
   - Import from JSON file

---

## Questions & Decisions

### Decided:
- ✅ Use radio buttons for provider selection
- ✅ Store both credentials in same storage
- ✅ Default to Vertex when both configured
- ✅ No separate mode for Vertex (part of remote)
- ✅ Keep same model options for both

### Open Questions:
- Should we validate Vertex credentials on save?
- Should we show a "Test Connection" button?
- Should we add provider status indicator in UI?
- Should we log which provider is being used?

---

## Notes

- Chrome extensions run in Edge-like runtime, so we need Edge runtime version of Vertex SDK
- Vertex AI requires service account, not OAuth2
- Private keys can be very long (~1600+ characters)
- Project ID and location are required for Vertex
- Consider using textarea for private key field
- Add copy-paste helpers for JSON key file fields

### Vertex AI Error Handling Requirements

Based on [Vertex AI API Error Documentation](https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/api-errors), we need to handle the following additional error cases:

#### Error Code Mapping (Vertex AI Specific)

| Status | Error Code | Causes | Handling Strategy |
|--------|-----------|--------|------------------|
| 400 | INVALID_ARGUMENT / FAILED_PRECONDITION | Model requires allowlisting, organization policy block, exceeds token limit | Non-retryable. Show specific error about model access or token limit. Check if user has proper Vertex AI API access. |
| 403 | PERMISSION_DENIED | Service account lacks permissions, can't access Cloud Storage resources | Non-retryable. Guide user to check service account permissions in GCP Console. Different from Google AI 403 (API key issues). |
| 404 | NOT_FOUND | Invalid resource URL, missing files in storage | Non-retryable. Check if model exists and credentials are correct. |
| 429 | RESOURCE_EXHAUSTED | API quota exceeded, server overload, daily logprobs limit reached | Retryable. Apply exponential backoff. Show user which quota was hit (requests/min, daily limit, etc.). |
| 499 | CANCELLED | Client cancelled request | Non-retryable. User action - don't show as error. |
| 500 | UNKNOWN / INTERNAL | Server error, dependency failure | Retryable. Wait longer before retry (server overload). |
| 503 | UNAVAILABLE | Service temporarily unavailable | Retryable. Exponential backoff. If persists >1 hour, suggest contacting support. |
| 504 | DEADLINE_EXCEEDED | Request took longer than client deadline (default 10min) | Retryable. Suggest increasing timeout for complex requests. |

#### Key Differences from Google Generative AI Errors:

1. **403 Permission Denied**
   - **Google AI**: Usually API key issues (leaked, invalid, restricted)
   - **Vertex AI**: Service account permission issues (IAM roles, Cloud Storage access)
   - **Action**: Need provider-aware error messages

2. **400 Invalid Argument**
   - **Vertex AI**: May indicate model not allowlisted or org policy restrictions
   - **Action**: Check if user needs to request model access

3. **429 Resource Exhausted**
   - **Vertex AI**: More granular (quota types: requests/min, daily logprobs limit)
   - **Action**: Parse error message to identify specific quota issue

4. **499 Cancelled**
   - **Vertex AI**: Explicit cancellation error code
   - **Action**: Don't treat as error, user intentionally cancelled

5. **504 Deadline Exceeded**
   - **Vertex AI**: Client-side deadline issues (default 10 minutes)
   - **Action**: Suggest timeout configuration

#### Implementation Requirements:

1. **Create provider-aware error parser** (`src/ai/errors/vertexErrorParser.ts`):
   ```typescript
   export function parseVertexError(error: any, provider: AIProvider): APIError {
     if (provider === 'vertex') {
       // Vertex-specific error parsing
       if (statusCode === 403) {
         return APIError.vertexPermissionDenied(details);
       }
       if (statusCode === 400 && message.includes('allowlist')) {
         return APIError.vertexModelAccessRequired(details);
       }
       // ... etc
     } else {
       // Google AI error parsing (current logic)
       // ... existing error handling
     }
   }
   ```

2. **Add new error types** to `errorTypes.ts`:
   ```typescript
   // Vertex AI specific errors
   API_VERTEX_PERMISSION_DENIED = 'API_VERTEX_PERMISSION_DENIED',
   API_VERTEX_MODEL_ACCESS_REQUIRED = 'API_VERTEX_MODEL_ACCESS_REQUIRED',
   API_VERTEX_QUOTA_EXHAUSTED = 'API_VERTEX_QUOTA_EXHAUSTED',
   API_VERTEX_DEADLINE_EXCEEDED = 'API_VERTEX_DEADLINE_EXCEEDED',
   ```

3. **Update error handler** to accept provider context:
   ```typescript
   export async function parseProviderError(
     error: any, 
     provider: AIProvider
   ): Promise<APIError> {
     // Different parsing logic based on provider
     if (provider === 'vertex') {
       return parseVertexError(error);
     } else {
       return parseGeminiError(error);
     }
   }
   ```

4. **Provider-specific user messages**:
   - **Google AI 403**: "Your API key may be invalid or restricted. Get a new key from AI Studio."
   - **Vertex AI 403**: "Service account lacks permissions. Check IAM roles in GCP Console."

5. **Retry strategies**:
   - Both: Exponential backoff for 429, 500, 503
   - Vertex only: Longer initial delay for 503 (server overload more common)
   - Vertex only: Don't retry 499 (user cancellation)

#### Error Handling Priority:

1. ✅ **Phase 5a**: Add Vertex error types to `errorTypes.ts`
2. ✅ **Phase 5b**: Create `vertexErrorParser.ts` with Vertex-specific parsing
3. ✅ **Phase 5c**: Update `handlers.ts` to be provider-aware
4. ✅ **Phase 5d**: Update retry logic in `streamExecutor.ts` for provider-specific behavior
5. ✅ **Phase 5e**: Add provider-specific error messages to UI components

#### Testing Error Scenarios:

- [ ] Vertex 403: Service account without Vertex AI permissions
- [ ] Vertex 400: Request model not allowlisted
- [ ] Vertex 429: Quota exceeded (different types)
- [ ] Vertex 504: Deadline exceeded with long requests
- [ ] Google 403: Invalid/leaked API key
- [ ] Google 429: Rate limit exceeded
- [ ] Both: 500/503 server errors
- [ ] Both: Network timeouts

---
