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
