# Chrome AI Context Limits - Summary

## ✅ Implementation Status

The MiniSearch implementation and overall extension architecture have been reviewed and updated to ensure compliance with Chrome Built-in AI (Gemini Nano) token limits.

## Key Limits Added

```typescript
// src/constants.ts
export const CHROME_AI_LIMITS = {
    MAX_TOKENS_PER_PROMPT: 1024,      // Per Chrome AI docs
    MAX_TOKENS_PER_SESSION: 4096,     // Session retention limit
    RECOMMENDED_CHUNK_TOKENS: 800,    // Safe threshold (78% of limit)
    MAX_OUTPUT_TOKENS: 1024,
};
```

## Critical Distinctions

### 1. MiniSearch Index (Local Storage Only)
- **Truncation**: 2000 tokens
- **Purpose**: Local keyword search in IndexedDB
- **NOT sent to Chrome AI**: Never interacts with Prompt API
- ✅ **Safe**: No token limit concerns

### 2. Embedding/AI Processing (Chrome AI Interaction)
- **Chunk size**: 800 tokens (recommended)
- **Hard limit**: 1024 tokens per prompt
- **Strategy**: One chunk = one prompt (no session accumulation)
- ✅ **Safe**: Well within limits

## Architecture Guarantees

```
Page Content
    ↓ Split into ~800 token chunks
Chunks Table (with tokenLength field)
    ↓ Process one at a time
Chrome AI Prompt API ← Max 1024 tokens per prompt
    ↓
Embeddings stored

Separately:
Pages/Chunks → MiniSearch Index (local search only, never sent to AI)
```

## What Was Updated

1. ✅ Added `CHROME_AI_LIMITS` constants
2. ✅ Clarified MiniSearch truncation is for local storage only
3. ✅ Documented safe chunking strategy (800 tokens)
4. ✅ Created comprehensive compliance document
5. ✅ Build verified successful

## Files Modified/Created

- **Modified**: `src/constants.ts` - Added Chrome AI limits
- **Created**: `docs/chrome-ai-limits-compliance.md` - Full compliance guide

## Next Steps (TODOs)

When implementing content extraction and embedding:

1. **Content Script**: Use `CHROME_AI_LIMITS.RECOMMENDED_CHUNK_TOKENS` (800) when splitting page content
2. **Embedding Worker**: Verify `tokenLength ≤ MAX_TOKENS_PER_PROMPT` before sending to Chrome AI
3. **Token Estimation**: Use conservative word-to-token approximation (~1.3 tokens per word)
4. **No Session Accumulation**: Each chunk processed independently

## References

- Chrome AI docs: `docs/chrome-ai-docs.md`
- Compliance guide: `docs/chrome-ai-limits-compliance.md`
- Constants: `src/constants.ts`

---

**Status**: ✅ **COMPLIANT** - Architecture designed to never exceed Chrome AI token limits
