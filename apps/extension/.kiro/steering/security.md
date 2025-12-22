# Security Standards

## Critical Rules
- Never embed secrets in code or logs
- Never pass API keys in URL query parameters; use request headers (e.g., `X-Goog-Api-Key`)
- Escape regex metacharacters in user-provided strings: `.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`
- Validate user inputs and tool parameters
- Respect Chrome MV3 permissions and protected pages

## Data Protection
- Do not log secrets, API keys, or PII
- Sanitize error objects before logging
- Validate external data types before accessing properties

## DOM Data Extraction (CRITICAL)

When extracting data from the DOM that will be sent to AI or any backend:

### Never Capture Sensitive Input Values
- **ALWAYS** check if an input is sensitive before capturing its value
- Sensitive input types: `password`, `cc-number`, `cc-exp`, `cc-csc`
- Sensitive autocomplete values: `current-password`, `new-password`, `one-time-code`, `cc-*`
- Sensitive name/id patterns: `/password|card|cvv|cvc|csc|ssn|secret|pin|security.?code/i`

### Implementation Pattern
```typescript
// SECURITY: Check if input is sensitive before capturing value
function isSensitiveInput(input: HTMLInputElement): boolean {
    const type = (input.type || '').toLowerCase();
    const name = (input.name || '').toLowerCase();
    const autocomplete = (input.autocomplete || '').toLowerCase();
    
    // Check sensitive types
    if (type === 'password') return true;
    
    // Check sensitive autocomplete values
    const sensitiveAutocomplete = ['cc-number', 'cc-exp', 'cc-csc', 'current-password', 'new-password'];
    if (sensitiveAutocomplete.some(s => autocomplete.includes(s))) return true;
    
    // Check sensitive name/id patterns
    if (/password|card|cvv|cvc|csc|ssn|secret|pin/i.test(name)) return true;
    
    return false;
}

// Usage when collecting inputs:
inputs.push({
    type: input.type,
    name: input.name,
    // SECURITY: Stripping value from sensitive fields to prevent PII leakage to AI
    value: isSensitiveInput(input) ? undefined : (input.value || undefined),
});
```

### Security Comments
- **ALWAYS** add `// SECURITY:` comments when stripping sensitive data
- Comments must explain WHY the data is being stripped
- Example: `// SECURITY: Stripping value from sensitive fields to prevent PII leakage to AI`

### Defense-in-Depth
Apply security checks at multiple layers:
1. **Extraction layer**: Strip values when reading from DOM
2. **Formatting layer**: Re-check before formatting data for AI
3. **Transport layer**: Validate before sending to backend

### Files to Check
When modifying DOM extraction code, ensure security checks exist in:
- `src/utils/tabs/pageContextExtractor.ts` - Main page context extraction
- `src/actions/interactions/text-extraction.tsx` - Search bar detection
- Any new code that reads `input.value` or form data from the DOM

