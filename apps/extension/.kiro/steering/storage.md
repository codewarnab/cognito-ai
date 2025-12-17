# Storage and Data Standards

## Zustand Stores (Primary)
- Use Zustand stores from `@/stores` for UI state management
- Stores auto-sync with Chrome storage via `chromeStorageSync` middleware
- See `zustand-stores.md` for usage patterns

## Extension Storage
- Use `@plasmohq/storage` for extension storage outside of stores
- Avoid direct `localStorage`
- Maintain indices for efficient queries
- Update index on CRUD operations

## Error Handling
- Wrap all storage persistence calls in try-catch
- Revert UI state on failure
- Notify user to prevent silent data loss
- Store previous state before async updates for rollback
