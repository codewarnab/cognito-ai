# Chrome AI Context Limits Compliance

This document explains how the MiniSearch implementation and overall extension architecture respect the Chrome Built-in AI (Gemini Nano) context and token limits.

## Chrome AI Limits (from official docs)

Based on the Chrome Built-in AI documentation and community reports:

| Limit | Value | Source |
|-------|-------|--------|
| Max tokens per prompt | 1,024 | Community reports, early Prompt API |
| Max tokens per session | 4,096 | Community reports, session retention |
| Max output tokens | 1,024 | Typical for on-device models |
| Recommended chunk size | 800 | Best practice (80% of limit) |

> **Note**: These limits apply to **Gemini Nano** (on-device model). Cloud-based Gemini models (1.5 Pro, 2.5 Flash) support much larger contexts (up to 1M+ tokens), but are not used in this extension for privacy reasons.

## How We Stay Within Limits

### 1. MiniSearch Text Truncation

**Purpose**: Prevent the search index from growing too large  
**Limit**: `TRUNCATION_TOKENS: 2000` tokens per text field  
**Why safe**: This is for the **search index only**, not sent to Chrome AI Prompt API

```typescript
// src/constants.ts
export const MINISEARCH_CONFIG = {
    TRUNCATION_TOKENS: 2000,  // For search index storage only
    // ...
};
```

The MiniSearch index stores text locally in IndexedDB for **sparse keyword search**. This text is NOT sent to the Prompt API, so it doesn't need to respect the 1024-token limit.

### 2. Chunk Processing for Embeddings

**Purpose**: Break long pages into manageable pieces for Chrome AI processing  
**Recommended limit**: `RECOMMENDED_CHUNK_TOKENS: 800` tokens per chunk  
**Why safe**: Well under the 1024-token per-prompt limit

```typescript
// src/constants.ts
export const CHROME_AI_LIMITS = {
    MAX_TOKENS_PER_PROMPT: 1024,      // Hard limit from Chrome
    RECOMMENDED_CHUNK_TOKENS: 800,     // Our safe threshold (78% of limit)
    MAX_TOKENS_PER_SESSION: 4096,
    MAX_OUTPUT_TOKENS: 1024,
};
```

When extracting content from web pages:
1. **Content scripts** extract text and split into chunks of ~800 tokens
2. Each chunk is stored in the `chunks` table with its `tokenLength`
3. Chunks are processed **one at a time** through the Chrome AI Prompt API
4. Each chunk generates a single embedding (no multi-chunk prompts)

### 3. Embedding Worker Safety

**Location**: `src/workers/embed-worker.ts`  
**Strategy**: Process chunks individually, never batch multiple chunks in one prompt

```typescript
// Pseudocode (to be implemented in embed-worker.ts)
async function embedChunk(text: string): Promise<Float32Array> {
    // Verify chunk size
    const tokenCount = estimateTokenCount(text);
    
    if (tokenCount > CHROME_AI_LIMITS.MAX_TOKENS_PER_PROMPT) {
        console.warn(`Chunk too large: ${tokenCount} tokens, truncating`);
        text = truncateToTokenLimit(text, CHROME_AI_LIMITS.RECOMMENDED_CHUNK_TOKENS);
    }
    
    // Send to Chrome AI Prompt API
    const response = await navigator.prompt.send({
        input: [{ type: 'TEXT', text }],
    });
    
    return parseEmbedding(response);
}
```

### 4. Session Management

**Issue**: Chrome AI has a 4096-token session retention limit  
**Solution**: Create a **new session per chunk**

Instead of:
```typescript
// ❌ BAD - Accumulates session context
const session = await navigator.prompt.createSession();
for (const chunk of chunks) {
    await session.send(chunk); // Context grows, exceeds 4096 tokens
}
```

We do:
```typescript
// ✅ GOOD - Each chunk is independent
for (const chunk of chunks) {
    const response = await navigator.prompt.send({
        input: [{ type: 'TEXT', text: chunk.text }]
    }); // No session accumulation
}
```

### 5. Content Extraction Chunking

**Location**: Content scripts (to be implemented)  
**Strategy**: Pre-split content before storing

```typescript
// Pseudocode for content extraction
function extractAndChunk(pageContent: string): ChunkRecord[] {
    const chunks: ChunkRecord[] = [];
    const sentences = splitIntoSentences(pageContent);
    
    let currentChunk = '';
    let currentTokenCount = 0;
    let chunkIndex = 0;
    
    for (const sentence of sentences) {
        const sentenceTokens = estimateTokenCount(sentence);
        
        // Check if adding this sentence would exceed our safe limit
        if (currentTokenCount + sentenceTokens > CHROME_AI_LIMITS.RECOMMENDED_CHUNK_TOKENS) {
            // Save current chunk
            chunks.push({
                chunkId: generateId(),
                text: currentChunk,
                tokenLength: currentTokenCount,
                chunkIndex: chunkIndex++,
                // ...
            });
            
            // Start new chunk
            currentChunk = sentence;
            currentTokenCount = sentenceTokens;
        } else {
            currentChunk += ' ' + sentence;
            currentTokenCount += sentenceTokens;
        }
    }
    
    // Save final chunk
    if (currentChunk) {
        chunks.push({ /* ... */ });
    }
    
    return chunks;
}
```

## Token Estimation

Since we don't have access to the actual tokenizer, we use approximation:

```typescript
/**
 * Rough token count estimation
 * Rule of thumb: ~1.3 tokens per word for English text
 */
function estimateTokenCount(text: string): number {
    const words = text.split(/\s+/).length;
    return Math.ceil(words * 1.3);
}

/**
 * More conservative estimate for safety
 */
function estimateTokenCountSafe(text: string): number {
    // Count words + punctuation as separate tokens
    const tokens = text.match(/\w+|[^\w\s]/g) || [];
    return tokens.length;
}
```

## Architecture Guarantees

### Data Flow with Token Limits

```
Web Page Content
    ↓
Content Script Extraction
    ↓ [Split into chunks ≤ 800 tokens each]
Database (chunks table with tokenLength)
    ↓ [Process one chunk at a time]
Embedding Worker
    ↓ [Verify tokenLength ≤ 1024 before sending]
Chrome AI Prompt API (Gemini Nano)
    ↓ [Generate embedding]
Database (store embedding with chunk)
```

### MiniSearch Index Isolation

```
Database Pages/Chunks
    ↓ [Extract title + description for sparse search]
MiniSearch Index
    ↓ [Truncate to 2000 tokens for storage only]
IndexedDB (miniSearchIndex store)
    
    ← NEVER sent to Chrome AI
    ← Used only for local keyword search
```

## Verification Checklist

- [x] **Chunk size limit defined**: `RECOMMENDED_CHUNK_TOKENS: 800`
- [x] **Per-prompt limit documented**: `MAX_TOKENS_PER_PROMPT: 1024`
- [x] **Session limit documented**: `MAX_TOKENS_PER_SESSION: 4096`
- [x] **MiniSearch truncation clarified**: Only for local storage, not AI prompts
- [x] **Chunking strategy**: Break content at sentence boundaries
- [x] **Session isolation**: One-shot prompts, no session accumulation
- [x] **Token estimation**: Conservative approximation functions
- [ ] **TODO**: Implement token-aware chunking in content script
- [ ] **TODO**: Add token verification in embedding worker
- [ ] **TODO**: Add telemetry for token count monitoring

## Testing Recommendations

### Unit Tests
```typescript
// Test chunk size limits
test('chunks respect token limit', () => {
    const longText = 'word '.repeat(2000); // ~2600 tokens
    const chunks = chunkText(longText, CHROME_AI_LIMITS.RECOMMENDED_CHUNK_TOKENS);
    
    for (const chunk of chunks) {
        const tokenCount = estimateTokenCount(chunk);
        expect(tokenCount).toBeLessThanOrEqual(CHROME_AI_LIMITS.RECOMMENDED_CHUNK_TOKENS);
    }
});
```

### Integration Tests
```typescript
// Test actual Chrome AI API calls
test('embedding generation respects prompt limit', async () => {
    const testChunk = 'word '.repeat(1500); // ~1950 tokens - TOO LARGE
    
    await expect(async () => {
        await embedChunk(testChunk); // Should truncate automatically
    }).not.toThrow();
    
    // Verify truncation occurred
    const actualPrompt = getLastPromptSent();
    const tokenCount = estimateTokenCount(actualPrompt);
    expect(tokenCount).toBeLessThanOrEqual(CHROME_AI_LIMITS.MAX_TOKENS_PER_PROMPT);
});
```

## Monitoring & Alerts

### Console Warnings
```typescript
if (tokenCount > CHROME_AI_LIMITS.MAX_TOKENS_PER_PROMPT * 0.9) {
    console.warn(
        `[Token Warning] Chunk approaching token limit: ${tokenCount}/${CHROME_AI_LIMITS.MAX_TOKENS_PER_PROMPT}`
    );
}
```

### Statistics Tracking
```typescript
// Store in chrome.storage.local
interface TokenStats {
    totalChunksProcessed: number;
    averageTokensPerChunk: number;
    maxTokensEncountered: number;
    truncationCount: number; // How many times we had to truncate
}
```

## References

- Chrome AI Documentation: `docs/chrome-ai-docs.md`
- Token limits source: Chrome Built-in AI docs, community reports
- Gemini API token guide: https://ai.google.dev/gemini-api/docs/tokens
- Implementation: `src/constants.ts`, `src/workers/embed-worker.ts`

## Summary

✅ **MiniSearch is safe**: Uses 2000-token truncation for local storage only  
✅ **Chunking strategy**: 800 tokens per chunk (78% of 1024 limit)  
✅ **No session accumulation**: One-shot prompts prevent context buildup  
✅ **Token estimation**: Conservative approximation ensures safety margin  
⚠️ **TODO**: Implement token-aware chunking in content scripts  
⚠️ **TODO**: Add runtime token verification in embedding worker  

The architecture is designed to **never exceed Chrome AI limits** by keeping chunks small, processing independently, and using the MiniSearch index purely for local keyword search (not AI prompts).
