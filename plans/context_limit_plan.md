
## 🎯 Feature Overview

Implement a **Context Limit Indicator** in the Chrome AI Extension to show users how much of their context window they're using. This helps prevent context overflow and provides transparency about token consumption.

### Key Requirements

**UI Component:** Animated circular progress indicator positioned **above the file attachment icon** in the chat input field
- **Always visible** (not just on hover)
- Shows percentage number inside the progress ring
- Uses MagicUI's AnimatedCircularProgressBar component
- **Debounced updates** to prevent excessive re-renders

**Behavior:**
- Context is **reset on every new chat thread creation**
- Only tracks Gemini API (cloud) usage - no local/Nano estimation
- Updates in real-time during streaming responses
- Color-coded: green (< 70%) → yellow (70-85%) → red (> 85%)

**Detailed View (Hover/Click):**
- Token breakdown: Input, Output, Cached (if available)
- "X / Y tokens" display showing current vs. maximum
- Simple progress bar visualization
- Model's context window limit

**UI Component Reference:**
```tsx
import { cn } from "@/lib/utils"

interface AnimatedCircularProgressBarProps {
  max?: number
  min?: number
  value: number
  gaugePrimaryColor: string
  gaugeSecondaryColor: string
  className?: string
}

export function AnimatedCircularProgressBar({
  max = 100,
  min = 0,
  value = 0,
  gaugePrimaryColor,
  gaugeSecondaryColor,
  className,
}: AnimatedCircularProgressBarProps) {
  const circumference = 2 * Math.PI * 45
  const percentPx = circumference / 100
  const currentPercent = Math.round(((value - min) / (max - min)) * 100)

  return (
    <div
      className={cn("relative size-40 text-2xl font-semibold", className)}
      style={
        {
          "--circle-size": "100px",
          "--circumference": circumference,
          "--percent-to-px": `${percentPx}px`,
          "--gap-percent": "5",
          "--offset-factor": "0",
          "--transition-length": "1s",
          "--transition-step": "200ms",
          "--delay": "0s",
          "--percent-to-deg": "3.6deg",
          transform: "translateZ(0)",
        } as React.CSSProperties
      }
    >
      <svg
        fill="none"
        className="size-full"
        strokeWidth="2"
        viewBox="0 0 100 100"
      >
        {currentPercent <= 90 && currentPercent >= 0 && (
          <circle
            cx="50"
            cy="50"
            r="45"
            strokeWidth="10"
            strokeDashoffset="0"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="opacity-100"
            style={
              {
                stroke: gaugeSecondaryColor,
                "--stroke-percent": 90 - currentPercent,
                "--offset-factor-secondary": "calc(1 - var(--offset-factor))",
                strokeDasharray:
                  "calc(var(--stroke-percent) * var(--percent-to-px)) var(--circumference)",
                transform:
                  "rotate(calc(1turn - 90deg - (var(--gap-percent) * var(--percent-to-deg) * var(--offset-factor-secondary)))) scaleY(-1)",
                transition: "all var(--transition-length) ease var(--delay)",
                transformOrigin:
                  "calc(var(--circle-size) / 2) calc(var(--circle-size) / 2)",
              } as React.CSSProperties
            }
          />
        )}
        <circle
          cx="50"
          cy="50"
          r="45"
          strokeWidth="10"
          strokeDashoffset="0"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="opacity-100"
          style={
            {
              stroke: gaugePrimaryColor,
              "--stroke-percent": currentPercent,
              strokeDasharray:
                "calc(var(--stroke-percent) * var(--percent-to-px)) var(--circumference)",
              transition:
                "var(--transition-length) ease var(--delay),stroke var(--transition-length) ease var(--delay)",
              transitionProperty: "stroke-dasharray,transform",
              transform:
                "rotate(calc(-90deg + var(--gap-percent) * var(--offset-factor) * var(--percent-to-deg)))",
              transformOrigin:
                "calc(var(--circle-size) / 2) calc(var(--circle-size) / 2)",
            } as React.CSSProperties
          }
        />
      </svg>
      <span
        data-current-value={currentPercent}
        className="animate-in fade-in absolute inset-0 m-auto size-fit delay-[var(--delay)] duration-[var(--transition-length)] ease-linear"
      >
        {currentPercent}
      </span>
    </div>
  )
}
```



## 📋 Multi-Phase Implementation Plan

### **Phase 1: Backend Infrastructure Setup**
**Goal:** Add token tracking capabilities using Vercel AI SDK v4's built-in usage tracking

#### 1.1 Create Usage Tracking Types (`src/ai/types/usage.ts`)

```typescript
import type { LanguageModelUsage } from 'ai';

/**
 * Extended usage information including context limits
 */
export interface AppUsage extends LanguageModelUsage {
  // From AI SDK LanguageModelUsage:
  // - inputTokens: number | undefined
  // - outputTokens: number | undefined  
  // - totalTokens: number | undefined
  // - reasoningTokens?: number | undefined
  // - cachedInputTokens?: number | undefined
  
  // Additional context information
  context?: {
    inputMax?: number;      // Max input tokens
    outputMax?: number;     // Max output tokens  
    combinedMax?: number;   // Combined max (if applicable)
    totalMax?: number;      // Total context window
  };
}
```

#### 1.2 Integrate Token Tracking in `aiLogic.ts`

Update the `streamText` call to capture usage in `onFinish`:

```typescript
const result = await streamText({
  model,
  messages: modelMessages,
  system: systemPrompt,
  tools,
  maxSteps: 5,
  
  onFinish: (result) => {
    // Capture usage from AI SDK
    const usage: AppUsage = {
      ...result.usage,
      context: {
        totalMax: 2000000, // Gemini 2.0 Flash context window
        inputMax: 2000000,
        outputMax: 8192
      }
    };
    
    log.info('✅ Token usage', {
      input: usage.inputTokens,
      output: usage.outputTokens,
      total: usage.totalTokens,
      cached: usage.cachedInputTokens,
      reasoning: usage.reasoningTokens,
      percentUsed: usage.totalTokens && usage.context?.totalMax
        ? Math.round((usage.totalTokens / usage.context.totalMax) * 100)
        : 0
    });
    
    // Store usage in message metadata for persistence
    return usage;
  }
});
```

#### 1.3 Update Database Schema (`src/db/index.ts`)

Add usage tracking fields:

```typescript
export interface ChatThread {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  initialPageContext?: string;
  lastUsage?: AppUsage; // Track latest usage for thread
}

export interface ChatMessage {
  id: string;
  threadId: string;
  message: any; // UIMessage
  timestamp: number;
  sequenceNumber?: number;
  usage?: AppUsage; // Store usage per message
}

// Helper to calculate cumulative usage for a thread
export async function getThreadUsage(threadId: string): Promise<AppUsage | null> {
  const messages = await db.chatMessages
    .where('threadId')
    .equals(threadId)
    .toArray();
    
  if (messages.length === 0) return null;
  
  // Sum up all usage
  const cumulative: AppUsage = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    cachedInputTokens: 0,
    reasoningTokens: 0
  };
  
  for (const msg of messages) {
    if (msg.usage) {
      cumulative.inputTokens! += msg.usage.inputTokens || 0;
      cumulative.outputTokens! += msg.usage.outputTokens || 0;
      cumulative.totalTokens! += msg.usage.totalTokens || 0;
      cumulative.cachedInputTokens! += msg.usage.cachedInputTokens || 0;
      cumulative.reasoningTokens! += msg.usage.reasoningTokens || 0;
      
      // Copy context limits from last message
      if (msg.usage.context) {
        cumulative.context = msg.usage.context;
      }
    }
  }
  
  return cumulative;
}

// Update thread's last usage
export async function updateThreadUsage(threadId: string, usage: AppUsage): Promise<void> {
  await db.chatThreads.update(threadId, { 
    lastUsage: usage,
    updatedAt: Date.now() 
  });
}
```

---

### **Phase 2: Frontend Component Development**
**Goal:** Build the circular context indicator using MagicUI component

#### 2.1 Create AnimatedCircularProgressBar Component (`src/components/chat/AnimatedCircularProgressBar.tsx`)

```typescript
import { cn } from "@/lib/utils";

interface AnimatedCircularProgressBarProps {
  max?: number;
  min?: number;
  value: number;
  gaugePrimaryColor: string;
  gaugeSecondaryColor: string;
  className?: string;
  showPercentage?: boolean;
}

export function AnimatedCircularProgressBar({
  max = 100,
  min = 0,
  value = 0,
  gaugePrimaryColor,
  gaugeSecondaryColor,
  className,
  showPercentage = true
}: AnimatedCircularProgressBarProps) {
  const circumference = 2 * Math.PI * 45;
  const percentPx = circumference / 100;
  const currentPercent = Math.round(((value - min) / (max - min)) * 100);

  return (
    <div
      className={cn("relative size-40 text-2xl font-semibold", className)}
      style={{
        "--circle-size": "100px",
        "--circumference": circumference,
        "--percent-to-px": `${percentPx}px`,
        "--gap-percent": "5",
        "--offset-factor": "0",
        "--transition-length": "1s",
        "--transition-step": "200ms",
        "--delay": "0s",
        "--percent-to-deg": "3.6deg",
        transform: "translateZ(0)",
      } as React.CSSProperties}
    >
      <svg fill="none" className="size-full" strokeWidth="2" viewBox="0 0 100 100">
        {currentPercent <= 90 && currentPercent >= 0 && (
          <circle
            cx="50"
            cy="50"
            r="45"
            strokeWidth="10"
            strokeDashoffset="0"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="opacity-100"
            style={{
              stroke: gaugeSecondaryColor,
              "--stroke-percent": 90 - currentPercent,
              strokeDasharray: "calc(var(--stroke-percent) * var(--percent-to-px)) var(--circumference)",
              transition: "all var(--transition-length) ease var(--delay)",
            } as React.CSSProperties}
          />
        )}
        <circle
          cx="50"
          cy="50"
          r="45"
          strokeWidth="10"
          strokeDashoffset="0"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="opacity-100"
          style={{
            stroke: gaugePrimaryColor,
            "--stroke-percent": currentPercent,
            strokeDasharray: "calc(var(--stroke-percent) * var(--percent-to-px)) var(--circumference)",
            transition: "var(--transition-length) ease var(--delay),stroke var(--transition-length) ease var(--delay)",
            transitionProperty: "stroke-dasharray,transform",
          } as React.CSSProperties}
        />
      </svg>
      {showPercentage && (
        <span
          data-current-value={currentPercent}
          className="animate-in fade-in absolute inset-0 m-auto size-fit"
        >
          {currentPercent}
        </span>
      )}
    </div>
  );
}
```

#### 2.2 Create ContextIndicator Component (`src/components/chat/ContextIndicator.tsx`)

```typescript
import { useState, useMemo } from "react";
import { AnimatedCircularProgressBar } from "./AnimatedCircularProgressBar";
import type { AppUsage } from "@/ai/types/usage";
import { debounce } from "@/utils/debounce";

interface ContextIndicatorProps {
  usage: AppUsage | null;
  className?: string;
}

export function ContextIndicator({ usage, className }: ContextIndicatorProps) {
  const [showDetails, setShowDetails] = useState(false);

  // Calculate percentage with debouncing
  const percent = useMemo(() => {
    if (!usage?.totalTokens || !usage?.context?.totalMax) return 0;
    return Math.min(100, Math.round((usage.totalTokens / usage.context.totalMax) * 100));
  }, [usage?.totalTokens, usage?.context?.totalMax]);

  // Color based on usage
  const colors = useMemo(() => {
    if (percent < 70) {
      return { primary: "#10b981", secondary: "#d1fae5" }; // green
    } else if (percent < 85) {
      return { primary: "#f59e0b", secondary: "#fef3c7" }; // yellow
    } else {
      return { primary: "#ef4444", secondary: "#fee2e2" }; // red
    }
  }, [percent]);

  if (!usage?.totalTokens) return null;

  return (
    <div className={cn("context-indicator", className)}>
      {/* Circular Progress - Always Visible */}
      <button
        className="context-button"
        onClick={() => setShowDetails(!showDetails)}
        aria-label={`Context usage: ${percent}%`}
      >
        <AnimatedCircularProgressBar
          value={percent}
          gaugePrimaryColor={colors.primary}
          gaugeSecondaryColor={colors.secondary}
          className="size-8" // Compact size for input area
        />
      </button>

      {/* Details Dropdown - Show on hover/click */}
      {showDetails && (
        <div className="context-details">
          <div className="context-header">
            <span>{percent}%</span>
            <span className="token-count">
              {usage.totalTokens?.toLocaleString()} / {usage.context?.totalMax?.toLocaleString()} tokens
            </span>
          </div>

          {/* Progress Bar */}
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${percent}%`, backgroundColor: colors.primary }}
            />
          </div>

          {/* Token Breakdown */}
          <div className="token-breakdown">
            {usage.cachedInputTokens && usage.cachedInputTokens > 0 && (
              <div className="token-row">
                <span>Cache Hits</span>
                <span>{usage.cachedInputTokens.toLocaleString()}</span>
              </div>
            )}
            <div className="token-row">
              <span>Input</span>
              <span>{usage.inputTokens?.toLocaleString() || 0}</span>
            </div>
            <div className="token-row">
              <span>Output</span>
              <span>{usage.outputTokens?.toLocaleString() || 0}</span>
            </div>
            {usage.reasoningTokens && usage.reasoningTokens > 0 && (
              <div className="token-row">
                <span>Reasoning</span>
                <span>{usage.reasoningTokens.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

#### 2.3 Add Styling (`src/styles/context-indicator.css`)

```css
.context-indicator {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.context-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.context-button:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.context-details {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: 8px;
  min-width: 240px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 12px;
  z-index: 1000;
}

.context-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 14px;
}

.token-count {
  color: #6b7280;
  font-size: 12px;
}

.progress-bar {
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 12px;
}

.progress-fill {
  height: 100%;
  transition: width 1s ease, background-color 0.3s;
}

.token-breakdown {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.token-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #374151;
}

.token-row span:first-child {
  color: #6b7280;
}

.token-row span:last-child {
  font-family: monospace;
  font-weight: 500;
}
```

---

### **Phase 3: Integration with Chat System**

#### 3.1 Update `useAIChat` Hook

```typescript
// src/ai/useAIChat.ts
export function useAIChat({ threadId, onError, onFinish }: UseAIChatOptions) {
  const [currentUsage, setCurrentUsage] = useState<AppUsage | null>(null);

  const chat = useChat({
    // ... existing config
    
    onFinish: async (result) => {
      // Extract usage from result
      if (result.usage) {
        const usage: AppUsage = {
          ...result.usage,
          context: {
            totalMax: 2000000, // Gemini 2.0 context window
            inputMax: 2000000,
            outputMax: 8192
          }
        };
        
        // Update state with debouncing
        setCurrentUsage(usage);
        
        // Save to database
        if (threadId) {
          await updateThreadUsage(threadId, usage);
        }
      }
      
      // Call original onFinish
      onFinish?.(result);
    }
  });

  return {
    ...chat,
    usage: currentUsage
  };
}
```

#### 3.2 Integrate in Chat Input Component

In `CopilotChatWindow.tsx` or your input component:

```tsx
import { ContextIndicator } from "./ContextIndicator";

// Inside component:
const { messages, sendMessage, usage } = aiChat;

return (
  <div className="chat-input-container">
    {/* Other input elements */}
    
    {/* Context Indicator - positioned above file attachment icon */}
    <ContextIndicator usage={usage} className="context-position" />
    
    {/* File attachment button */}
    <button className="file-attach-button">📎</button>
  </div>
);
```

---

### **Phase 4: Real-Time Updates & Warnings**

#### 4.1 Streaming Updates (if supported)

```typescript
// In onChunk callback (if available)
onChunk: debounce((chunk) => {
  if (chunk.usage) {
    setCurrentUsage(prev => ({
      ...prev,
      ...chunk.usage
    }));
  }
}, 500) // Debounce for performance
```

#### 4.2 Warning System

```typescript
// Add warning state
const [showWarning, setShowWarning] = useState(false);

useEffect(() => {
  if (!usage?.totalTokens || !usage?.context?.totalMax) return;
  
  const percent = (usage.totalTokens / usage.context.totalMax) * 100;
  
  if (percent >= 90 && !showWarning) {
    setShowWarning(true);
    // Show toast notification
    showToast({
      title: "Context Limit Warning",
      message: "You're approaching the context limit. Consider starting a new thread.",
      type: "warning"
    });
  } else if (percent < 90) {
    setShowWarning(false);
  }
}, [usage]);
```

---

### **Phase 5: New Thread Context Reset**

Ensure context resets when creating new threads:

```typescript
// In handleNewThread function
const handleNewThread = async () => {
  const thread = await createThread();
  setCurrentThreadId(thread.id);
  setMessages([]);
  setCurrentUsage(null); // ← Reset usage
  await setLastActiveThreadId(thread.id);
};
```

## 📚 Key Vercel AI SDK References

Based on fetched documentation:

### **Usage Tracking (AI SDK v4)**
- **`streamText` onFinish callback**: Contains `result.usage` with token counts
- **`LanguageModelUsage` interface**:
  ```typescript
  {
    inputTokens: number | undefined;
    outputTokens: number | undefined;
    totalTokens: number | undefined;
    reasoningTokens?: number | undefined;
    cachedInputTokens?: number | undefined;
  }
  ```

### **Google Gemini Provider**
- **Context Windows**:
  - Gemini 2.0 Flash: 2M tokens (2,000,000)
  - Gemini 1.5 Pro: 2M tokens
  - Gemini 1.5 Flash: 1M tokens
- **Cached Tokens**: Supported via implicit/explicit caching
- **Provider Metadata**: Available in `providerMetadata.google.usageMetadata`

### **Token Counting**
- Tokens are automatically tracked in `streamText` and `generateText`
- Available in `onFinish` callback: `result.usage`
- Cached tokens reported separately: `cachedInputTokens`

## 🔍 Key Implementation Notes

1. **No Token Estimation for Local Mode**: We only track cloud (Gemini API) usage as specified
2. **Context Reset**: Automatically happens on new thread creation
3. **Debouncing**: Use debounce (300-500ms) to prevent excessive re-renders during streaming
4. **Database Schema Update**: Need to update to v5 to add usage fields
5. **Color Thresholds**: Green (< 70%), Yellow (70-85%), Red (> 85%)
6. **Positioning**: Above file attachment icon, always visible
7. **UI Library**: Use Radix UI for dropdown (no shadcn/ui)


files mentioned in that docs (context.tsx) this is form vercel chat bot template repo 
"use client";

import type { ComponentProps } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import type { AppUsage } from "@/lib/usage";
import { cn } from "@/lib/utils";

export type ContextProps = ComponentProps<"button"> & {
  /** Optional full usage payload to enable breakdown view */
  usage?: AppUsage;
};

const _THOUSAND = 1000;
const _MILLION = 1_000_000;
const _BILLION = 1_000_000_000;
const PERCENT_MAX = 100;

// Lucide CircleIcon geometry
const ICON_VIEWBOX = 24;
const ICON_CENTER = 12;
const ICON_RADIUS = 10;
const ICON_STROKE_WIDTH = 2;

type ContextIconProps = {
  percent: number; // 0 - 100
};

export const ContextIcon = ({ percent }: ContextIconProps) => {
  const radius = ICON_RADIUS;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - percent / PERCENT_MAX);

  return (
    <svg
      aria-label={`${percent.toFixed(2)}% of model context used`}
      height="28"
      role="img"
      style={{ color: "currentcolor" }}
      viewBox={`0 0 ${ICON_VIEWBOX} ${ICON_VIEWBOX}`}
      width="28"
    >
      <circle
        cx={ICON_CENTER}
        cy={ICON_CENTER}
        fill="none"
        opacity="0.25"
        r={radius}
        stroke="currentColor"
        strokeWidth={ICON_STROKE_WIDTH}
      />
      <circle
        cx={ICON_CENTER}
        cy={ICON_CENTER}
        fill="none"
        opacity="0.7"
        r={radius}
        stroke="currentColor"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        strokeWidth={ICON_STROKE_WIDTH}
        transform={`rotate(-90 ${ICON_CENTER} ${ICON_CENTER})`}
      />
    </svg>
  );
};

function InfoRow({
  label,
  tokens,
  costText,
}: {
  label: string;
  tokens?: number;
  costText?: string;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2 font-mono">
        <span className="min-w-[4ch] text-right">
          {tokens === undefined ? "—" : tokens.toLocaleString()}
        </span>
        {costText !== undefined &&
          costText !== null &&
          !Number.isNaN(Number.parseFloat(costText)) && (
            <span className="text-muted-foreground">
              ${Number.parseFloat(costText).toFixed(6)}
            </span>
          )}
      </div>
    </div>
  );
}

export const Context = ({ className, usage, ...props }: ContextProps) => {
  const used = usage?.totalTokens ?? 0;
  const max =
    usage?.context?.totalMax ??
    usage?.context?.combinedMax ??
    usage?.context?.inputMax;
  const hasMax = typeof max === "number" && Number.isFinite(max) && max > 0;
  const usedPercent = hasMax ? Math.min(100, (used / max) * 100) : 0;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "inline-flex select-none items-center gap-1 rounded-md text-sm",
            "cursor-pointer bg-background text-foreground",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 outline-none ring-offset-background",
            className
          )}
          type="button"
          {...props}
        >
          <span className="hidden font-medium text-muted-foreground">
            {usedPercent.toFixed(1)}%
          </span>
          <ContextIcon percent={usedPercent} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-fit p-3" side="top">
        <div className="min-w-[240px] space-y-2">
          <div className="flex items-start justify-between text-sm">
            <span>{usedPercent.toFixed(1)}%</span>
            <span className="text-muted-foreground">
              {hasMax ? `${used} / ${max} tokens` : `${used} tokens`}
            </span>
          </div>
          <div className="space-y-2">
            <Progress className="h-2 bg-muted" value={usedPercent} />
          </div>
          <div className="mt-1 space-y-1">
            {usage?.cachedInputTokens && usage.cachedInputTokens > 0 && (
              <InfoRow
                costText={usage?.costUSD?.cacheReadUSD?.toString()}
                label="Cache Hits"
                tokens={usage?.cachedInputTokens}
              />
            )}
            <InfoRow
              costText={usage?.costUSD?.inputUSD?.toString()}
              label="Input"
              tokens={usage?.inputTokens}
            />
            <InfoRow
              costText={usage?.costUSD?.outputUSD?.toString()}
              label="Output"
              tokens={usage?.outputTokens}
            />
            <InfoRow
              costText={usage?.costUSD?.reasoningUSD?.toString()}
              label="Reasoning"
              tokens={
                usage?.reasoningTokens && usage.reasoningTokens > 0
                  ? usage.reasoningTokens
                  : undefined
              }
            />
            {usage?.costUSD?.totalUSD !== undefined && (
              <>
                <Separator className="mt-1" />
                <div className="flex items-center justify-between pt-1 text-xs">
                  <span className="text-muted-foreground">Total cost</span>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="min-w-[4ch] text-right" />
                    <span>
                      {Number.isNaN(
                        Number.parseFloat(usage.costUSD.totalUSD.toString())
                      )
                        ? "—"
                        : `$${Number.parseFloat(usage.costUSD.totalUSD.toString()).toFixed(6)}`}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};



usage.ts
import type { LanguageModelUsage } from "ai";
import type { UsageData } from "tokenlens/helpers";

// Server-merged usage: base usage + TokenLens summary + optional modelId
export type AppUsage = LanguageModelUsage & UsageData & { modelId?: string };

