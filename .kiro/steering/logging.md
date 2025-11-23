# Logging Standards

## Logger Usage
Initialize module-scoped logger and reuse:
```typescript
import { createLogger } from '~logger';
const log = createLogger('FeatureName');
// or with context
const log = createLogger('FeatureName', 'CONTEXT');
```

## Log Levels
- `debug`: verbose state information
- `info`: normal operation
- `warn`: recoverable issues
- `error`: failures

## Security
- Never log API keys, secrets, or PII
- Sanitize error objects before logging
- Remove debug statements that output raw error objects
