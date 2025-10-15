# Knowledge Question Refusal Fix

## Problem Identified

User asked: **"do you know who is codewarnab?"**

Agent response: ❌ *"I'm sorry, I cannot answer general knowledge questions. My capabilities are limited to browsing and interacting with web pages."*

**This is EXACTLY the wrong behavior** - the agent HAS a browser and should USE it!

## Root Cause

The agent didn't understand that it can answer ANY question by:
1. Navigating to a search engine
2. Searching for the query
3. Reading the results
4. Providing the answer

## Solution Implemented

### 1. Enhanced Primary Directive

Added to the main `description`:
```typescript
CRITICAL: You CAN answer ANY question by using the browser. For knowledge questions, 
IMMEDIATELY navigate to a search engine (google.com, bing.com, etc.), search for the 
answer, read the results, and provide the information. NEVER say "I cannot answer" - 
you have a browser, USE IT.
```

### 2. Added Knowledge Questions Behavior Guideline

Position #2 in `behaviorGuidelines` (high priority):
```typescript
"KNOWLEDGE QUESTIONS: NEVER refuse to answer questions. Navigate to google.com or 
bing.com, search for the answer, read results with readPageContent, and provide 
the information. You have a browser - USE IT."
```

### 3. Tool Playbook - First Entry

Made "ANSWERING QUESTIONS" the FIRST item in the tool playbook:
```typescript
"ANSWERING QUESTIONS: For ANY knowledge question (who/what/where/when/why/how), 
navigate to 'https://www.google.com/search?q=' + encodeURIComponent(question), 
then readPageContent to extract the answer. NEVER say you cannot answer."
```

### 4. Search Workflow Added

Explicit step-by-step process:
```typescript
"SEARCH WORKFLOW: (1) navigateTo Google/Bing with query, (2) readPageContent to 
get results, (3) extract relevant info, (4) report answer to user."
```

### 5. Error Recovery Entry

First entry in `errorRecovery`:
```typescript
"DON'T KNOW ANSWER: NEVER say 'I cannot answer'. Instead, navigate to Google/Bing, 
search, read results, provide answer."
```

## Expected New Behavior

When user asks: **"who is codewarnab?"**

Agent should:
1. ✅ Recognize this as a knowledge question
2. ✅ Navigate to `https://www.google.com/search?q=who+is+codewarnab`
3. ✅ Use `readPageContent` to extract search results
4. ✅ Parse the relevant information
5. ✅ Report back: "Based on my search, codewarnab is [information from results]..."

## Test Cases

### Should Now Work

| Question | Expected Behavior |
|----------|------------------|
| "Who is codewarnab?" | Search Google → Read results → Provide answer |
| "What is the capital of France?" | Search → Read → "Paris" |
| "When was the Eiffel Tower built?" | Search → Read → "1889" |
| "How does photosynthesis work?" | Search → Read → Explain process |
| "Latest news about AI" | Search → Read → Summarize news |

### Should Still Refuse

| Request | Reason |
|---------|--------|
| "Hack this website" | Illegal |
| "Generate malware code" | Unsafe/harmful |
| "What's my password?" | Requires user-provided credentials |

## Implementation Files

- `src/sidepanel.tsx` - Lines 83-123 (enhanced prompting)
- `MAX_AUTONOMY_IMPLEMENTATION.md` - Updated documentation
- `KNOWLEDGE_QUESTION_FIX.md` - This file

## Why This Fix Is Critical

A browser agent that refuses to answer questions is **fundamentally broken** because:
1. It HAS the tool (browser) needed to answer
2. It's designed to be autonomous and execute tasks
3. Users expect it to leverage its capabilities
4. "I cannot answer" contradicts its core purpose

The fix ensures the agent **understands it can and should** use the browser to answer ANY question by searching the web.

## Prompt Engineering Technique Used

**Explicit Capability Framing**: Instead of listing what the agent "cannot" do, we explicitly state what it CAN do and HOW to do it. This is a key principle in max-autonomy prompting:

- ❌ Bad: "I cannot answer general knowledge questions"
- ✅ Good: "I CAN answer ANY question by using the browser to search"

The fix uses:
1. **Directive Framing**: "NEVER say I cannot answer"
2. **Procedural Guidance**: Step-by-step search workflow
3. **Capability Assertion**: "You have a browser - USE IT"
4. **Error Prevention**: Explicit "DON'T KNOW ANSWER" recovery rule

