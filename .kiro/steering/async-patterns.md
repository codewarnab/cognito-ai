# Async Patterns and Promises

## Critical Rules
- Never use `setTimeout` with a return statement expecting outer function to receive value
- Return values inside `setTimeout` callbacks are discarded
- Use Promises for async operations: wrap `setTimeout` in `new Promise((resolve) => ...)`
- Add timeout guards to all Promises interacting with external systems
- Use `Promise.race()` with timeout to prevent indefinite hangs
- Ensure every Promise branch calls resolve/reject

## Message Handling
- Wrap async switch/case in try-catch to ensure response callbacks execute
- Define typed interfaces for message payloads with type guards
- Use spread operator `...array` instead of `.apply(null, Array.from())`

## Concurrency
- Implement concurrency guards for operations that shouldn't run simultaneously
- Check flags before starting; clear in finally blocks
