# Sequence Diagram Style Guide

A reference for creating clean, readable SVG sequence diagrams that match the Cognito docs style.

## Core Principles

1. **Clean & Minimal** - Fewer colors, bolder lines, bigger fonts
2. **Consistent** - All diagrams should look like they belong together
3. **Readable** - Text should be legible at all viewport sizes
4. **Dark Mode Ready** - Every color needs a dark mode variant

## Participants

```tsx
{/* Participant boxes - white fill, gray stroke, rounded corners */}
<g className="fill-white dark:fill-gray-800 stroke-gray-300 dark:stroke-gray-600">
    <rect x={50} y={10} width={120} height={40} rx={6} className="shadow-sm" strokeWidth={1.5} />
</g>

{/* Labels - bold, sans-serif, 12px equivalent */}
<g className="fill-gray-800 dark:fill-gray-200 text-xs font-bold font-sans">
    <text x={110} y={35} textAnchor="middle">Extension UI</text>
</g>
```

## Lifelines

```tsx
{/* Dashed gray lines extending from participants */}
<g className="stroke-gray-300 dark:stroke-gray-600" strokeWidth={1.5} strokeDasharray="6 4">
    <line x1={110} y1={50} x2={110} y2={520} />
</g>
```

## Arrows & Messages

### Solid Arrows (Requests/Calls)
- **Blue** (`stroke-blue-600 dark:stroke-blue-400`) - HTTP requests, API calls
- **Gray** (`stroke-gray-600 dark:stroke-gray-400`) - Internal calls, routing
- **Amber** (`stroke-amber-600 dark:stroke-amber-400`) - SSE events, async operations

```tsx
{/* Solid arrow with blue color for requests */}
<line x1={95} y1={75} x2={235} y2={75} 
      className="stroke-blue-600 dark:stroke-blue-400" 
      strokeWidth={1.5} 
      markerEnd="url(#arrow-filled-blue)" />
<text x={165} y={68} textAnchor="middle" 
      className="text-[11px] fill-blue-700 dark:fill-blue-300 font-sans font-medium">
    POST /cli/chat
</text>
```

### Dashed Arrows (Responses/Returns)
- **Gray** (`stroke-gray-500 dark:stroke-gray-400`) - Standard responses
- **Green** (`stroke-green-600 dark:stroke-green-400`) - Success states, final responses

```tsx
{/* Dashed arrow for responses */}
<line x1={480} y1={145} x2={280} y2={145} 
      className="stroke-gray-500 dark:stroke-gray-400" 
      strokeWidth={1.5} 
      strokeDasharray="4 2" 
      markerEnd="url(#arrow-open)" />
<text x={380} y={140} textAnchor="middle" 
      className="text-[11px] fill-gray-600 dark:fill-gray-400 font-mono">
    {`{ ok: true, version }`}
</text>
```

### Self-Calls (Loops back to same participant)

```tsx
<path d="M 400 190 Q 450 190 450 210 Q 450 230 400 230" 
      className="fill-none stroke-gray-600 dark:stroke-gray-400" 
      strokeWidth={1.5} 
      markerEnd="url(#arrow-filled)" />
<text x={470} y={205} className="text-[11px] fill-gray-700 dark:fill-gray-300 font-sans">
    buildAISDKTools()
</text>
```

## Block Containers (OPT, ALT, LOOP)

```tsx
{/* Background fill for the block area */}
<rect x={30} y={295} width={840} height={320} rx={4} 
      className="fill-amber-50/50 dark:fill-amber-900/10" />

{/* Label badge */}
<rect x={30} y={295} width={70} height={20} rx={0} 
      className="fill-amber-100 dark:fill-amber-900/40 opacity-80" />
<text x={40} y={309} className="text-[10px] font-bold fill-amber-800 dark:fill-amber-200">
    LOOP
</text>
<text x={110} y={309} className="text-[10px] fill-amber-700 dark:fill-amber-300 italic">
    [for each tool call from LLM]
</text>

{/* Border stroke */}
<rect x={30} y={295} width={840} height={320} rx={4} 
      className="fill-none stroke-amber-200 dark:stroke-amber-800" strokeWidth={1} />
```

Block types and colors:
- **OPT** (optional) - Blue (`fill-blue-50/50`, `stroke-blue-200`)
- **ALT** (alternative) - Amber (`fill-amber-50/50`, `stroke-amber-200`)
- **LOOP** - Amber (`fill-amber-50/50`, `stroke-amber-200`)

## Notes & Annotations

```tsx
{/* Inline note box */}
<rect x={100} y={85} width={135} height={45} rx={4} 
      className="fill-blue-50 stroke-blue-200 dark:fill-blue-900/30 dark:stroke-blue-700" 
      strokeWidth={1} />
<text x={167} y={100} textAnchor="middle" 
      className="text-[10px] fill-blue-700 dark:fill-blue-300 font-mono">
    {`{ messages: [...] }`}
</text>
```

## Arrow Marker Definitions

Always include these at the end of your SVG:

```tsx
<defs>
    {/* Filled arrows for requests */}
    <marker id="arrow-filled" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
        <path d="M0,0 L0,6 L9,3 z" className="fill-gray-600 dark:fill-gray-400" />
    </marker>
    <marker id="arrow-filled-blue" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
        <path d="M0,0 L0,6 L9,3 z" className="fill-blue-600 dark:fill-blue-400" />
    </marker>
    <marker id="arrow-filled-amber" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
        <path d="M0,0 L0,6 L9,3 z" className="fill-amber-600 dark:fill-amber-400" />
    </marker>
    
    {/* Open arrows for responses */}
    <marker id="arrow-open" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
        <path d="M0,0 L0,6 L9,3 z" className="fill-none stroke-gray-500 dark:stroke-gray-400" strokeWidth="1.5" />
    </marker>
    <marker id="arrow-open-green" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
        <path d="M0,0 L0,6 L9,3 z" className="fill-none stroke-green-600 dark:stroke-green-400" strokeWidth="1.5" />
    </marker>
</defs>
```

**Important:** Use unique marker IDs per component (e.g., `arrow-filled-chat`, `arrow-filled-seq`) to prevent caching collisions between diagrams.

## Typography

### CRITICAL: Minimum Font Sizes

Diagrams must be readable on all screen sizes. Small fonts are the #1 cause of unreadable diagrams.

| Element | Minimum Size | Recommended Size | Weight | Font |
|---------|--------------|------------------|--------|------|
| Participant labels | `text-base` (16px) | `text-base` | `font-bold` | `font-sans` |
| Message labels | `text-sm` (14px) | `text-sm` | `font-medium` | `font-sans` |
| Subtitles/descriptions | `text-[13px]` | `text-[13px]` | normal, `italic` | `font-sans` |
| Code/payloads in notes | `text-xs` (12px) | `text-xs` | normal | `font-mono` |
| Block labels (OPT/LOOP) | `text-sm` (14px) | `text-sm` | `font-bold` | default |
| Block conditions | `text-[13px]` | `text-[13px]` | `italic` | `font-sans` |

**Hard rules:**
- **NEVER use `text-[11px]` or smaller** - it's unreadable on most screens
- **NEVER use `text-[10px]` or `text-[9px]`** - completely unreadable
- Participant labels must always be `text-base` (16px) or larger
- Message labels must be at least `text-sm` (14px)
- Subtitles must be at least `text-[13px]}

```tsx
{/* GOOD: Readable font sizes */}
<g className="text-base font-bold">  {/* 16px for participants */}
    <text>Extension UI</text>
</g>
<text className="text-sm font-medium">POST /api/chat</text>  {/* 14px Message */}
<text className="text-[13px] italic">Triggers extraction</text>  {/* Subtitle */}

{/* BAD: Too small - don't do this */}
<text className="text-[11px]">Too small!</text>
<text className="text-[10px]">Unreadable!</text>
<text className="text-xs">Only for code in note boxes</text>
```

**Note:** Use `text-sm` (14px) minimum for message labels. `text-xs` (12px) is only acceptable for code snippets inside note boxes.

## Spacing Guidelines

### CRITICAL: Horizontal Participant Spacing

**This is the most common mistake.** Participants that are too close together cause overlapping text and unreadable diagrams.

| Number of Participants | Minimum viewBox Width | Spacing Between Centers |
|------------------------|----------------------|------------------------|
| 3-4 participants | 900px | 200px minimum |
| 5-6 participants | 1100px | 180px minimum |
| 6+ participants | 1200px+ | 160px minimum |

**Rule of thumb:** Calculate `(participants - 1) × 180 + 200` for minimum viewBox width.

```tsx
{/* GOOD: 6 participants with proper spacing (1100px viewBox) */}
{/* Centers at: 90, 260, 450, 660, 850, 1025 = ~170-200px gaps */}
<svg viewBox="0 0 1100 600">
    <rect x={50} y={10} width={80} height={40} />   {/* Center: 90 */}
    <rect x={200} y={10} width={120} height={40} /> {/* Center: 260 */}
    <rect x={380} y={10} width={140} height={40} /> {/* Center: 450 */}
    {/* ... */}
</svg>

{/* BAD: Cramped spacing causes overlap */}
<svg viewBox="0 0 520 340">  {/* Too narrow! */}
    {/* Participants will overlap */}
</svg>
```

### Participant Dimensions

- **Width**: 80-140px (adjust based on label length)
- **Height**: 40px
- **Edge padding**: 50px minimum from viewBox edges
- **Gap between participant boxes**: 60px minimum (not center-to-center)

### Vertical Spacing

- **Between message groups**: 60-70px minimum (not 45px - too cramped!)
- **Between main label and subtitle**: 18px
- **Between arrow and note box below it**: 15px
- **Self-call curve height**: 50-60px
- **Inside LOOP/OPT blocks**: Add 20px padding top/bottom
- **Between ALT/OPT section dividers**: 80px minimum

### Preventing Overlap Issues

1. **Arrow labels**: Center text between the two lifelines, not at arrow start/end
2. **Note boxes**: Position to the side of arrows or 10px below, never overlapping
3. **Self-call labels**: Place text 20px to the right of the curve apex
4. **Italic subtitles**: Always 15px below main label
5. **Response + note combo**: If arrow has a note box, add 50px before next message

### Note Box Sizing & Placement

```tsx
{/* Calculate width: ~7px per character for font-mono text-[10px] + 30px padding */}
{/* Example: "{ results: [memories...] }" = 25 chars × 7 + 30 = 205px */}

{/* GOOD: Note box positioned to the side, not overlapping */}
<line x1={450} y1={300} x2={850} y2={300} />  {/* Arrow */}
<rect x={870} y={280} width={140} height={40} />  {/* Note to the right */}

{/* GOOD: Note box below arrow with gap */}
<line x1={450} y1={300} x2={650} y2={300} />  {/* Arrow */}
<rect x={460} y={310} width={180} height={35} />  {/* Note below, 10px gap */}

{/* BAD: Note box overlapping arrow path */}
<line x1={450} y1={300} x2={650} y2={300} />
<rect x={500} y={285} width={100} height={30} />  {/* Overlaps! */}
```

### Line Spacing in Multi-line Notes

```tsx
{/* 15px line height for readability */}
<text y={295}>Line 1</text>
<text y={310}>Line 2</text>  {/* +15px */}
<text y={325}>Line 3</text>  {/* +15px */}
```

### Minimum Font Sizes

- **Never go below `text-[10px]`** for any text
- Use `text-[11px]` for primary message labels
- Use `text-[10px]` for secondary labels, code, and annotations
- **Do not use `text-[9px]`** - it's unreadable on most screens

### Quick Spacing Checklist

Before finalizing a diagram, verify:

- [ ] viewBox width is 1100px+ for 5+ participants
- [ ] Participant centers are 180-220px apart
- [ ] No text overlaps any other text
- [ ] No note boxes overlap arrows
- [ ] All text is at least 50px from viewBox edges
- [ ] Vertical gaps between messages are 60px+
- [ ] Self-call labels don't overlap the curve path
- [ ] Participant labels use `text-base` (16px)
- [ ] Message labels use `text-sm` (14px) minimum
- [ ] Subtitles use `text-[13px]` minimum
- [ ] No font smaller than `text-xs` (12px) anywhere, and only for code in notes
- [ ] viewBox height is tall enough (calculate: 80 + messages × 70)

## Color Palette Summary

| Use Case | Light Mode | Dark Mode |
|----------|------------|-----------|
| Participant fill | `fill-white` | `fill-gray-800` |
| Participant stroke | `stroke-gray-300` | `stroke-gray-600` |
| Lifelines | `stroke-gray-300` | `stroke-gray-600` |
| Request arrows | `stroke-blue-600` | `stroke-blue-400` |
| Internal calls | `stroke-gray-600` | `stroke-gray-400` |
| Async/SSE | `stroke-amber-600` | `stroke-amber-400` |
| Response arrows | `stroke-gray-500` | `stroke-gray-400` |
| Success responses | `stroke-green-600` | `stroke-green-400` |

## Do's and Don'ts

✅ **Do:**
- Use 1100px+ viewBox width for diagrams with 5+ participants
- Maintain 160-200px spacing between participant centers
- Use descriptive message labels (e.g., "POST /cli/chat" not just "request")
- Add context in italics below main labels when helpful
- Use `font-mono` for code, payloads, and JSON
- Keep colors minimal - gray for most, color for emphasis
- Test in both light and dark modes
- Leave 50px+ padding from viewBox edges
- Use 60-70px vertical spacing between message groups
- Position note boxes below or beside arrows, never overlapping
- Run the spacing checklist before finalizing

❌ **Don't:**
- Use viewBox width under 900px (causes cramped layouts)
- Place participants closer than 160px center-to-center
- Let text labels overlap each other or arrows
- Add step numbers (clutters the diagram)
- Use too many colors (stick to gray + 1-2 accent colors)
- Use shadows on arrows or lines
- Make fonts smaller than 10px
- Forget dark mode variants
- Place note boxes at viewBox edges (causes overflow/clipping)
- Cram too many elements vertically (increase viewBox height instead)
- Use long condition text in ALT/LOOP blocks (abbreviate or split lines)
- Guess spacing - calculate it based on participant count
