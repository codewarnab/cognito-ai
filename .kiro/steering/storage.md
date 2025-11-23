# Storage and Data Standards

## Extension Storage
- Use `@plasmohq/storage` for extension storage
- Avoid direct `localStorage`
- Maintain indices for efficient queries
- Update index on CRUD operations

## Error Handling
- Wrap all storage persistence calls in try-catch
- Revert UI state on failure
- Notify user to prevent silent data loss
- Store previous state before async updates for rollback
