# Data Stream Protocol

## Critical Rules
When using `writer.write()` for streaming responses, text content MUST be properly framed:

- **Always use complete lifecycle**: `text-start` → `text-delta` → `text-end`
- Missing `text-start` or `text-end` causes stream parsing errors
- Same pattern applies to other chunk types (reasoning, tool calls, etc.)

## Correct Pattern
```typescript
// ✅ Complete lifecycle
writer.write({ type: 'text-start' });
writer.write({ type: 'text-delta', textDelta: 'Your response...' });
writer.write({ type: 'text-end' });
```

## Common Mistakes
```typescript
// ❌ Missing start/end - causes errors
writer.write({ type: 'text-delta', textDelta: 'Your response...' });
```

## Chunk Types
| Start | Delta | End |
|-------|-------|-----|
| `text-start` | `text-delta` | `text-end` |
| `reasoning-start` | `reasoning-delta` | `reasoning-end` |
| `tool-call-start` | `tool-call-delta` | `tool-call-end` |
