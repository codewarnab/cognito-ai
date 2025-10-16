# Memory Tool Playbook

This document provides guidance on using the Memory System in the Chrome AI Assistant. It mirrors the in-code playbook embedded in `src/sidepanel.tsx`.

## Overview

The Memory System allows the AI assistant to remember facts and behavioral preferences across sessions using Chrome's sync storage (via Plasmo Storage). This enables personalized, context-aware interactions.

## Architecture

### Data Model

Each memory is stored with:
- **id**: Unique identifier (UUID)
- **category**: `"fact"` (personal info, credentials) or `"behavior"` (rules, preferences)
- **key**: Canonicalized key (e.g., `user.name`, `behavior.no-emails`)
- **value**: The stored value (serializable)
- **source**: `"user"`, `"task"`, or `"system"`
- **createdAt/updatedAt**: Timestamps
- **confidence**: Optional 0-1 score
- **pinned**: Optional flag for important memories

### Separation of Concerns

**Behavioral Preferences** are automatically injected into the AI's context via `useCopilotReadable`. The AI knows these without fetching.

**Other Facts** require explicit tool calls (`getMemory`, `listMemories`) to retrieve.

## Available Tools

### 1. `saveMemory`

**Purpose**: Save information to persistent memory.

**Parameters**:
- `category` (required): `"fact"` or `"behavior"`
- `key` (required): Memory key (auto-canonicalized)
- `value` (required): Value to store
- `source` (optional): `"user"` (default), `"task"`, or `"system"`

**CRITICAL**: Always ask for user consent before saving!

**Example**:
```javascript
// Step 1: Detect save-worthy info
User: "My name is Alice"

// Step 2: Ask consent
AI: "Nice to meet you, Alice! Would you like me to remember your name for future conversations?"

// Step 3: If user says yes, save
User: "Yes"
AI: [calls saveMemory({ category: "fact", key: "user.name", value: "Alice", source: "user" })]
AI: "Got it! I'll remember your name. You can ask me to list or delete memories anytime."
```

### 2. `getMemory`

**Purpose**: Retrieve a specific memory by key.

**Parameters**:
- `key` (required): The memory key to retrieve

**Example**:
```javascript
// Retrieve user's name
AI: [calls getMemory({ key: "user.name" })]
// Returns: { found: true, key: "user.name", value: "Alice", category: "fact", ... }
```

### 3. `listMemories`

**Purpose**: List all memories or filter by category.

**Parameters**:
- `category` (optional): `"fact"` or `"behavior"` to filter
- `limit` (optional): Max number to return (default: 20)

**Example**:
```javascript
User: "What do you remember about me?"
AI: [calls listMemories()]
AI: "I remember: your name is Alice, your email is alice@example.com, and you work as a developer."
```

### 4. `deleteMemory`

**Purpose**: Delete a memory by key.

**Parameters**:
- `key` (required): The memory key to delete

**Example**:
```javascript
User: "Forget my email"
AI: [calls deleteMemory({ key: "user.email" })]
AI: "Done! I've forgotten your email."
```

### 5. `suggestSaveMemory`

**Purpose**: Suggest saving information after tasks or when detecting useful info.

**Parameters**:
- `key` (required): Suggested key
- `value` (required): Value to potentially save
- `category` (required): `"fact"` or `"behavior"`
- `reason` (optional): Why this should be saved

**Use Case**: After completing a task, if useful info surfaced (API keys, credentials, preferences), suggest saving.

**Example**:
```javascript
// After extracting email from a page
AI: [calls suggestSaveMemory({ key: "user.email", value: "alice@example.com", category: "fact", reason: "Found your email on the profile page" })]
AI: "I found your email (alice@example.com). Would you like me to remember this for future tasks?"
User: "Yes"
AI: [calls saveMemory(...)]
```

## Consent Workflow

**CRITICAL RULE**: ALWAYS ask user consent before saving. NEVER save without explicit user confirmation.

### Steps:

1. **Detect**: Identify save-worthy information
2. **Suggest**: Ask "Do you want me to remember this?"
3. **Wait**: Get user response
4. **Action**:
   - **Yes** → Call `saveMemory` and confirm
   - **No** → Acknowledge and move on
   - **Never ask again** → Save a behavioral rule to suppress future suggestions for that key

### Detection Patterns

The system auto-detects:

- **Names**: "My name is..." or "Call me..."
- **Emails**: RFC-5322 email patterns
- **Professions**: "I am a..." or "I work as..."
- **Locations**: "I live in..." or "I'm from..."
- **Behavioral Rules**: "Never..." or "Always..."

### Phrasing Suggestions

Good consent prompts:
- "Would you like me to remember your name?"
- "Should I save your email for future reference?"
- "I noticed you mentioned your profession. Want me to remember that?"

Bad (too pushy):
- "I'm saving your name now."
- "Your email has been stored."

## Key Canonicalization

Keys are auto-canonicalized:
- Lowercase
- Spaces → dots
- Special chars removed

Examples:
- `"User Name"` → `"user.name"`
- `"API Key!"` → `"api.key"`

## Common Use Cases

### 1. User Shares Name
```
User: "My name is Bob"
AI: "Nice to meet you, Bob! Would you like me to remember your name for future conversations?"
User: "Sure"
AI: [saveMemory] "Saved! I'll remember your name."
```

### 2. Extracting Info from Task
```
AI: [Completes task and finds user's email on a page]
AI: "I found your email (bob@example.com) on this page. Would you like me to remember it?"
User: "Yes"
AI: [saveMemory] "Got it! Saved your email."
```

### 3. User Asks What AI Remembers
```
User: "What do you know about me?"
AI: [listMemories]
AI: "I remember:
- Your name: Bob
- Your email: bob@example.com
- Your profession: Software Engineer
- Behavioral preference: Never ask about newsletters"
```

### 4. User Wants to Forget Something
```
User: "Forget my profession"
AI: [deleteMemory({ key: "user.profession" })]
AI: "Done! I've forgotten your profession."
```

### 5. Behavioral Preference
```
User: "Never ask me about promotions"
AI: "Got it! Would you like me to remember this preference?"
User: "Yes"
AI: [saveMemory({ category: "behavior", key: "behavior.no-promotions", value: "Never ask about promotions" })]
AI: "Saved! I won't suggest things related to promotions in the future."
```

## UI Components

### Memory Panel

Users can open the Memory Panel (💾 button in header) to:
- View all memories
- Filter by category (All / Facts / Behavioral)
- Search memories
- Delete individual memories
- Toggle "Offer save suggestions" on/off

### In-Chat Experience

Memory tools show visual feedback cards during execution:
- **Saving**: "💾 Saving Memory..."
- **Success**: "💾 Memory Saved - Key: user.name"
- **Retrieving**: "🔍 Retrieving Memory..."
- **Listing**: "📋 Found 3 Memories"

## Privacy & Control

- **Sync Storage**: Memories sync across Chrome instances (if user is signed in)
- **User Control**: Users can delete any memory at any time
- **Consent Required**: AI cannot save without explicit permission
- **Transparency**: Users can view all stored memories in the Memory Panel

## Best Practices for AI

1. **Always ask before saving**: "Would you like me to remember this?"
2. **Be specific**: "Would you like me to remember your email (alice@example.com)?"
3. **Acknowledge saves**: "Saved! You can ask me to list or delete memories anytime."
4. **Proactively suggest**: After tasks, suggest saving useful info
5. **Respect refusal**: If user says no, don't ask again for the same info in that session
6. **Use behavioral prefs**: Check injected preferences before making suggestions

## Technical Integration

### Storage Layer
- **Storage**: `@plasmohq/storage` (Chrome sync area)
- **Index**: Maintains key-to-ID mapping for fast lookups
- **CRUD**: `saveMemory`, `getMemory`, `getMemoryByKey`, `listMemories`, `deleteMemory`

### Context Injection
Behavioral preferences are injected via `useCopilotReadable`:
```typescript
behavioralPreferences: {
  "behavior.no-emails": "Never ask about newsletters",
  "behavior.always-dark-mode": "Always use dark mode"
}
```

### Tool Registration
Memory tools are registered in `src/actions/registerAll.ts` via `registerMemoryActions()`.

## Troubleshooting

### Memory not saving?
- Check browser console for storage errors
- Ensure user gave consent
- Verify Plasmo Storage is initialized

### Memory not retrieved?
- Verify key canonicalization (e.g., `"User Name"` → `"user.name"`)
- Check if memory exists via Memory Panel
- Use `listMemories()` to see all stored memories

### Sync not working?
- Ensure user is signed into Chrome
- Check Chrome sync settings
- Storage area is set to `"sync"` by default in `src/memory/store.ts`

## Future Enhancements

Potential improvements:
- **Smart detection**: LLM-based extraction of save-worthy info
- **Confidence scoring**: Auto-update confidence based on usage
- **Memory expiration**: Auto-delete old, unused memories
- **Import/Export**: Allow users to backup/restore memories
- **Categorization**: More granular categories beyond fact/behavior

---

**Version**: 1.0  
**Last Updated**: October 2025  
**Maintainer**: Chrome AI Team

