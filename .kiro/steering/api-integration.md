# API Integration Best Practices

## Validation
- Validate enum/union types against official API documentation
- Maintain complete lists of valid values in type definitions
- Check API response structure before accessing properties
- Validate external data types with type guards

## Maintenance
- Monitor API deprecation notices
- Update hardcoded identifiers before deprecation dates
- Add comments with expiration dates for preview/beta endpoints

## Error Handling
- Use standardized error types and helpers
- Provide user-facing messages via `apiErrorHandler`
- Never pass API keys in URL query parameters; use headers
