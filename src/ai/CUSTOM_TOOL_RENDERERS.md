# Custom Tool Input/Output Renderers

## Overview

Tools can optionally provide custom renderers for their input and output data, allowing for more tailored and user-friendly UI presentations. This is completely optional - if not provided, tools will fall back to the default JSON display.

## Usage

When registering a tool's UI, you can pass an optional third parameter with custom renderers:

```tsx
registerToolUI('toolName', (state: ToolUIState) => {
    return <CompactToolRenderer state={state} />;
}, {
    // Optional: Custom input renderer
    renderInput: (input: any) => ReactNode,
    
    // Optional: Custom output renderer
    renderOutput: (output: any) => ReactNode
});
```

## Example: NavigateTo Tool

The `navigateTo` tool demonstrates minimal custom rendering:

```tsx
registerToolUI('navigateTo', (state: ToolUIState) => {
    return <CompactToolRenderer state={state} />;
}, {
    renderInput: (input: any) => (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            fontSize: '13px',
            color: 'var(--text-secondary)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', opacity: 0.7 }}>URL:</span>
                <a href={input.url} target="_blank" rel="noopener noreferrer"
                   style={{ color: 'var(--text-primary)', fontSize: '12px' }}>
                    {input.url}
                </a>
            </div>
            {input.newTab !== undefined && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', opacity: 0.7 }}>Mode:</span>
                    <span style={{ fontSize: '11px', padding: '2px 6px' }}>
                        {input.newTab ? 'New Tab' : 'Current Tab'}
                    </span>
                </div>
            )}
        </div>
    ),
    renderOutput: (output: any) => (
        // Similar minimal styling for output
    )
});
```

## Design Guidelines

### Keep It Minimal
- Use CSS variables for colors: `var(--text-primary)`, `var(--text-secondary)`, `var(--bg-tertiary)`, etc.
- Avoid bright, glowing colors - stick to subtle, muted tones
- Use opacity for hierarchy (0.7 for labels, 0.9 for values)
- Small font sizes: 11-13px
- Minimal borders: `1px solid var(--border-color)`

### Structure
- Use flexbox for layout
- Small gaps: 4-8px
- No heavy backgrounds or padding
- Links should blend in with minimal decoration

### When to Use Custom Renderers

✅ **Use custom renderers when:**
- Your tool has structured data that benefits from formatted display (URLs, IDs, statuses)
- You want to make specific fields more prominent
- Default JSON display is hard to read for your use case

❌ **Don't use custom renderers when:**
- Simple JSON is sufficient
- Data is already clear in default format
- You'd just be recreating the same look as JSON

## API Reference

### CustomInputOutputRenderers Interface

```typescript
interface CustomInputOutputRenderers {
    renderInput?: (input: any) => ReactNode;
    renderOutput?: (output: any) => ReactNode;
}
```

Both functions are optional. If not provided, the default JSON formatting will be used.
