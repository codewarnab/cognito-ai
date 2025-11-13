# Contextual Suggestions Implementation Plan

## 🎯 Overview
Implement contextual AI suggestions that appear **after** the user starts chatting, based on:
- **Active tab page content** (URL, title, text, buttons, links, etc.)
- **Previous conversation messages**
- **Browser agent capabilities** (navigation, tab management, interaction, memory, etc.)

### Visual Design
- **Horizontal pill-based UI** above the chat input
- **Ordered by confidence** (highest first)
- **Simple pills** with confidence badges (no category colors)
- **Only show when messages exist** (`messages.length > 0`)

---

## 📋 Phase 1: Create Contextual Suggestion Generator

### File: `src/ai/suggestions/contextual.ts`

**Purpose**: Generate intelligent suggestions using conversation context + page content

**Key Features**:
- ✅ Uses `initializeModel()` from `modelFactory.ts` (supports Google AI + Vertex AI)
- ✅ Accepts: `pageContext` + `messages[]` + `modelState`
- ✅ Returns: `ContextualSuggestion[]` with full schema
- ✅ Browser agent system prompt (navigation, interaction, memory, etc.)
- ✅ Retry logic with exponential backoff
- ✅ Fallback to simple suggestions if generation fails

**Schema**:
```typescript
interface ContextualSuggestion {
  id: string
  title: string           // Short text for pill (3-7 words)
  description: string     // Detailed explanation
  action: string         // Full prompt to send
  confidence: number     // 0-100
  category: 'optimization' | 'risk' | 'efficiency' | 'cost' | 'planning'
}
```

**System Prompt**:
- Emphasize browser agent capabilities:
  - Navigate websites, search, manage tabs
  - Click buttons, fill forms, read content
  - Save/retrieve memory, set reminders
  - Analyze pages, extract information
  - Send emails, manage workflows

**Context Building**:
- Recent messages (last 5-10)
- Page URL, title, headings
- Available buttons and links
- Page text preview (first 500 chars)

---

## 📋 Phase 2: Create Hook for Contextual Suggestions

### File: `src/hooks/useContextualSuggestions.ts`

**Purpose**: React hook to manage contextual suggestion state and lifecycle

**Key Features**:
- ✅ Triggers when `messages.length > 0` (conversation started)
- ✅ Debounced generation (2 seconds after new message)
- ✅ Tracks last message ID to avoid duplicate generations
- ✅ Re-generates when page changes (tab switch, URL update)
- ✅ Uses `extractPageContext()` for active tab content
- ✅ Caching based on `lastMessageId + pageUrl`

**State Management**:
```typescript
interface UseContextualSuggestionsResult {
  suggestions: ContextualSuggestion[] | null
  isGenerating: boolean
  error: Error | null
  refresh: () => void  // Manual refresh
}
```

**Trigger Conditions**:
1. New message sent (debounced 2s)
2. Tab switched/URL changed (debounced 1s)
3. Mode changed (immediate)

**Optimization**:
- Don't regenerate for same message + same page
- Clear suggestions when chat is cleared (`messages.length === 0`)
- Cancel pending generation on unmount

---

## 📋 Phase 3: Create New Component - ContextualSuggestionPills

### File: `src/components/features/chat/components/ContextualSuggestionPills.tsx` (NEW)

**Purpose**: Display small horizontal pills **AFTER** user sends messages

**Key Features**:
- ✅ Completely separate from `SuggestedActions` (which shows BEFORE messages)
- ✅ Small horizontal pill layout (like autocomplete example)
- ✅ Shows when `messages.length > 0`
- ✅ Uses `useContextualSuggestions` hook
- ✅ Pills ordered by confidence (highest first)
- ✅ Minimal, clean design

**Props**:
```typescript
interface ContextualSuggestionPillsProps {
  messages: Message[]
  input: string
  isLoading: boolean
  modelState: ModelState
  onSuggestionClick: (action: string) => void
}
```

**UI Structure**:
```tsx
export const ContextualSuggestionPills: React.FC<Props> = ({
  messages, input, isLoading, modelState, onSuggestionClick
}) => {
  const { suggestions, isGenerating, error } = useContextualSuggestions(
    modelState,
    messages
  )
  
  // Only show when messages exist and input is empty
  const shouldShow = messages.length > 0 && !input.trim() && !isLoading
  
  if (!shouldShow) return null
  
  // Sort by confidence (highest first)
  const sortedSuggestions = [...(suggestions || [])].sort(
    (a, b) => b.confidence - a.confidence
  )
  
  return (
    <div className="contextual-pills-container">
      {isGenerating ? (
        // Loading state: shimmer pills
        <div className="pills-loading">
          <Sparkles className="animate-pulse" />
          <span>Generating suggestions...</span>
        </div>
      ) : (
        <div className="pills-wrapper">
          {sortedSuggestions.map(suggestion => (
            <button
              key={suggestion.id}
              onClick={() => onSuggestionClick(suggestion.action)}
              title={suggestion.description}
              className="suggestion-pill"
            >
              <span>{suggestion.title}</span>
              <span className="confidence-badge">
                {suggestion.confidence}%
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Styling** (inline with component):
```css
.contextual-pills-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.pills-wrapper {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  overflow-x: auto;
}

.suggestion-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 9999px;
  background: rgba(59, 130, 246, 0.08);
  border: 1px solid rgba(59, 130, 246, 0.2);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.suggestion-pill:hover {
  transform: scale(1.05);
  background: rgba(59, 130, 246, 0.12);
  border-color: rgba(59, 130, 246, 0.3);
}

.confidence-badge {
  font-size: 0.75rem;
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 4px;
  color: rgb(37, 99, 235);
}
```

---

## 📋 Phase 4: Integrate Into Chat UI

### File: `src/components/features/chat/Chat.tsx` or parent component

**Changes**:

1. **Import new component**:
   ```typescript
   import { ContextualSuggestionPills } from './components/ContextualSuggestionPills'
   ```

2. **Add to render** (above chat input):
   ```tsx
   <div className="chat-container">
     {/* Existing messages */}
     <MessageList messages={messages} />
     
     {/* NEW: Contextual pills (shows AFTER messages) */}
     <ContextualSuggestionPills
       messages={messages}
       input={input}
       isLoading={isLoading}
       modelState={modelState}
       onSuggestionClick={handleSuggestionClick}
     />
     
     {/* Existing input area */}
     <ChatInput
       input={input}
       onInputChange={setInput}
       onSubmit={handleSubmit}
     />
     
     {/* Existing: Big suggestions (shows BEFORE messages) */}
     <SuggestedActions
       messages={messages}
       input={input}
       isLoading={isLoading}
       activeWorkflow={activeWorkflow}
       attachments={attachments}
       isRecording={isRecording}
       modelState={modelState}
       onSuggestionClick={handleSuggestionClick}
     />
   </div>
   ```

**Visual Layout**:
```
┌─────────────────────────────────────┐
│ Messages (conversation history)     │
│ ...                                 │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ [Pill 1] [Pill 2] [Pill 3] [Pill 4]│  ← NEW: Contextual Pills (AFTER messages)
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ Chat Input                          │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ [Big Card 1] [Big Card 2]          │  ← EXISTING: SuggestedActions (BEFORE messages)
│ [Big Card 3] [Big Card 4]          │
└─────────────────────────────────────┘
```

---

## 📋 Phase 5: Styling & Polish

### Refinements for `ContextualSuggestionPills.tsx`

**Enhancements**:
1. Add smooth fade-in animation (Framer Motion)
2. Horizontal scroll for overflow
3. Max width per pill to prevent text overflow
4. Better loading shimmer effect
5. Error state handling

**Animation** (using Framer Motion):
```tsx
import { motion, AnimatePresence } from 'framer-motion'

<AnimatePresence>
  {shouldShow && (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.2 }}
    >
      {/* Pills content */}
    </motion.div>
  )}
</AnimatePresence>
```

**Responsive Design**:
- Mobile: Stack pills if needed
- Desktop: Horizontal scroll
- Max 5-6 pills visible at once

---

## 📋 Phase 6: Testing & Refinement

### Test Cases:

1. **Empty Chat** → Should show initial suggestions (existing)
2. **After First Message** → Should show contextual suggestions
3. **Tab Switch** → Should regenerate contextual suggestions
4. **URL Change** → Should regenerate contextual suggestions
5. **Mode Switch** (local ↔ remote) → Should regenerate
6. **Clear Chat** → Should hide contextual, show initial
7. **Typing in Input** → Should hide both suggestion types
8. **API Error** → Should show error state or fallback
9. **No API Key** → Should handle gracefully

### Edge Cases:
- Restricted pages (chrome://, extension pages)
- No page context available
- Very long conversations (limit to last 10 messages)
- Rapid tab switching (debounce properly)

---

## 🔧 Technical Specifications

### Dependencies:
- ✅ `ai` (Vercel AI SDK) - already installed
- ✅ `@ai-sdk/google` - already installed
- ✅ `@ai-sdk/google-vertex` - already installed
- ✅ `zod` - already installed
- ✅ `framer-motion` - already used in SuggestedActions

### Model Selection:
- **Google AI**: `gemini-2.5-flash` (fast, good for suggestions)
- **Vertex AI**: Same model via Vertex endpoint
- **Local**: Not applicable for contextual (requires message history analysis)

### Performance:
- Debounce: 2 seconds after message
- Cache: `lastMessageId + pageUrl` as key
- Limit: 4-6 suggestions per generation
- Timeout: 10 seconds max per generation

---

## 🚀 Implementation Order

### Step 1: Create Generator (30 min)
- Create `src/ai/suggestions/contextual.ts`
- Implement `generateContextualSuggestions()`
- Add Zod schema with full fields
- Test with mock data

### Step 2: Create Hook (20 min)
- Create `src/hooks/useContextualSuggestions.ts`
- Implement debouncing and caching
- Add tab change listeners
- Test in isolation

### Step 3: Create New Component (30 min)
- Create `ContextualSuggestionPills.tsx`
- Implement horizontal pill layout
- Add confidence badges
- Sort by confidence

### Step 4: Integrate Into Chat (15 min)
- Add component to Chat.tsx (above input)
- Wire up event handlers
- Test positioning

### Step 5: Styling (15 min)
- Add CSS for pills and badges
- Implement hover effects
- Add loading shimmer
- Test responsive layout

### Step 6: Testing (30 min)
- Manual testing all scenarios
- Edge case validation
- Performance optimization
- Bug fixes

**Total Estimated Time**: ~2 hours

---

## 📊 Success Metrics

1. ✅ Suggestions appear after first message
2. ✅ Relevant to page content and conversation
3. ✅ Ordered by confidence (highest first)
4. ✅ Smooth UI transitions (no jank)
5. ✅ Works with both Google AI and Vertex AI
6. ✅ Handles errors gracefully
7. ✅ Performant (no lag on message send)

---

## 🎨 Example User Flow

**BEFORE First Message**:
```
┌────────────────────────────────────────┐
│                                        │
│  [Big Card: Search React tutorials]   │
│  [Big Card: Find GitHub visits]       │  ← SuggestedActions (existing)
│  [Big Card: Set reminder]             │
│                                        │
│  ┌──────────────────────────────────┐ │
│  │ Type your message here...        │ │
│  └──────────────────────────────────┘ │
└────────────────────────────────────────┘
```

**AFTER First Message**:
```
┌────────────────────────────────────────┐
│ User: What is this repo about?         │
│ AI: This is a Chrome AI extension...  │
│                                        │
│ [Pill: Analyze README (95%)]          │  ← NEW: ContextualSuggestionPills
│ [Pill: Show commits (88%)]            │
│ [Pill: Check issues (82%)]            │
│                                        │
│  ┌──────────────────────────────────┐ │
│  │ Type your message here...        │ │
│  └──────────────────────────────────┘ │
└────────────────────────────────────────┘
```

1. User opens extension on GitHub repo page
2. Sees **big suggestion cards** (existing SuggestedActions)
3. Types: "What is this repo about?"
4. AI responds with repo description
5. **Small horizontal pills appear** above input (NEW)
   - "Analyze the README file" (95%)
   - "Show recent commits" (88%)
   - "Check open issues" (82%)
   - "Search for contributors" (75%)
6. User clicks "Analyze the README file"
7. Prompt sent automatically
8. New contextual pills generated based on new context

---

## 📝 Notes

- **No category colors** - Keep pills simple with just confidence
- **No recent queries** - Only AI-generated suggestions
- **Browser agent focus** - System prompt emphasizes agent capabilities
- **Vertex as default** - Use `getActiveProvider()` logic from modelFactory
- **Debouncing is critical** - Avoid excessive API calls

---

## 🔄 Future Enhancements (Out of Scope)

- [ ] User feedback on suggestions (thumbs up/down)
- [ ] Learning from user preferences
- [ ] Multi-language support
- [ ] Voice activation for suggestions
- [ ] Custom suggestion templates
