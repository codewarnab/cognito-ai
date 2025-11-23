---
inclusion: fileMatch
fileMatchPattern: "**/actions/**/*.{ts,tsx}"
---

# Browser Tools and Workflows

## Tool Registration
- Follow existing patterns for parameters and execution
- Keep descriptions actionable; include preconditions/limitations
- Remove unimplemented features from tool schemas
- Use Zod's built-in validators (`.min()`, `.max()`, `.int()`)

## Testing
- Test assertions must throw errors or use assertion libraries
- Logging-only "tests" provide false confidence

## Tool Counting
- Apply same filtering logic as tool selection functions
- Count only enabled tools; exclude disabled/workflow-only tools
