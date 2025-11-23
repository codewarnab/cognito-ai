# Performance and Best Practices

## Optimization
- Avoid heavy operations on UI thread; use offscreen where applicable
- Throttle/batch UI updates during streaming and downloads
- Use `Math.floor()` for calculations producing integer values
- Extract duplicate constants to single source of truth (DRY principle)

## Calculations
- Progress percentages: `(loaded / total) * 100`
- Aggregate totals from nested collections: `Array.from(map.values()).reduce((sum, set) => sum + set.size, 0)`

## HTTP Operations
- Create new Headers objects to avoid mutating original RequestInit
- Use `new Headers()` constructor for both Headers instances and plain objects
