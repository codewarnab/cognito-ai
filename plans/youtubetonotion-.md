# YouTube to Notion Notes - Multi-Phase Implementation Plan

## 🎯 Project Overview

**Goal**: Create a workflow that converts YouTube videos into structured, hierarchical Notion notes with intelligent formatting based on video type.

**Key Architecture Decision**: Use nested agent tools (agents calling agents) to prevent large transcript context from burdening the main workflow agent. Each agent handles its specialized task with its own Gemini instance.

---

## 🏗️ High-Level Architecture (Nested Agent Pattern)

**SDK Architecture Note**: All agents use `@google/genai` SDK with provider-aware initialization. Provider selection (Google AI vs Vertex AI) is centralized via `genAIFactory.ts`, ensuring all nested agents respect user's provider choice.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MAIN WORKFLOW AGENT                               │
│                  (youtube-to-notion workflow)                        │
│                                                                       │
│  Role: Minimal orchestration - NO heavy processing                   │
│  • Validates prerequisites (YouTube page + Notion MCP)               │
│  • Calls ONE agent tool: youtubeToNotionAgent                        │
│  • Receives compact success response with Notion URLs                │
│  • Displays success message to user                                  │
│  • Context: ~500 tokens (NO large transcripts)                       │
│  • SDK: Uses @google/genai via genAIFactory (provider-aware)         │
│                                                                       │
│  Allowed Tools: ['getActiveTab', 'youtubeToNotionAgent']            │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         │ Single Tool Call
                         │ Input: { youtubeUrl, videoTitle }
                         │ Output: { success, mainPageUrl, pageCount }
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│          YOUTUBE TO NOTION AGENT (Parent Sub-Agent)                  │
│                  youtubeToNotionAgent Tool                           │
│                                                                       │
│  Role: Heavy lifting - video analysis & note generation              │
│  • Has its own GoogleGenAI client with large context window          │
│  • Uses @google/genai SDK with provider-aware initialization         │
│  • Respects user's provider selection (Google AI or Vertex AI)       │
│  • Calls analyzeYouTubeVideo → receives 50k char transcript          │
│  • KEEPS transcript in its own context (NO passing to main)          │
│  • Analyzes transcript internally:                                   │
│    - Detects video type (tutorial/lecture/podcast/etc)               │
│    - Selects appropriate template structure                          │
│    - Generates structured notes (4-10 pages)                         │
│  • Calls notionCreatorAgent with structured data                     │
│  • Waits for Notion creation success                                 │
│  • Returns compact response to main workflow                         │
│                                                                       │
│  SDK: @google/genai via initializeGenAIClient() from genAIFactory    │
│  Internal Tools: ['analyzeYouTubeVideo', 'notionCreatorAgent']      │
│                                                                       │
│  Input:                                                               │
│  {                                                                    │
│    youtubeUrl: string,                                               │
│    videoTitle: string                                                │
│  }                                                                    │
│                                                                       │
│  Output:                                                              │
│  {                                                                    │
│    success: true,                                                    │
│    mainPageUrl: "https://notion.so/...",                            │
│    pageCount: 6,                                                     │
│    message: "Created [Video Title] with 6 pages in Notion"          │
│  }                                                                    │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         │ Internal Tool Call
                         │ Input: { mainPageTitle, videoUrl, nestedPages[] }
                         │ Output: { success, mainPageUrl, pageUrls[] }
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│          NOTION CREATOR AGENT (Child Sub-Agent)                      │
│                  notionCreatorAgent Tool                             │
│                                                                       │
│  Role: Notion page creation orchestration                            │
│  • Has its own GoogleGenAI client for API orchestration              │
│  • Uses @google/genai SDK with provider-aware initialization         │
│  • Respects user's provider selection (Google AI or Vertex AI)       │
│  • Receives structured notes (NOT full transcript)                   │
│  • Creates main Notion page via notion-create-pages                  │
│  • Loops through nested pages array                                  │
│  • Creates each nested page with parent_page_id                      │
│  • Handles Notion API errors gracefully                              │
│  • Returns success with all created page URLs                        │
│                                                                       │
│  SDK: @google/genai via initializeGenAIClient() from genAIFactory    │
│  Internal Tools: ['notion-create-pages', 'notion-update-page']      │
│                                                                       │
│  Input:                                                               │
│  {                                                                    │
│    mainPageTitle: "[Video Title] Notes [Cognito AI]",               │
│    videoUrl: "https://youtube.com/...",                              │
│    nestedPages: [                                                    │
│      { title: "Question 1", content: "Answer..." },                 │
│      { title: "Question 2", content: "Answer..." }                  │
│    ]                                                                 │
│  }                                                                    │
│                                                                       │
│  Output:                                                              │
│  {                                                                    │
│    success: true,                                                    │
│    mainPageUrl: "https://notion.so/main-page-id",                   │
│    nestedPageUrls: [                                                 │
│      "https://notion.so/nested-1",                                   │
│      "https://notion.so/nested-2"                                    │
│    ],                                                                 │
│    pageCount: 3                                                      │
│  }                                                                    │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         │ Uses MCP Tools
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      NOTION MCP TOOLS                                │
│                                                                       │
│  • notion-create-pages  - Create main & nested pages                │
│  • notion-update-page   - Update properties (if needed)             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📐 Detailed Component Architecture

### Provider Selection Architecture

All nested agents automatically inherit the user's provider selection through centralized initialization:

```typescript
// genAIFactory.ts - Centralized provider-aware initialization
import { GoogleGenAI } from '@google/genai';
import { getActiveProvider, getVertexCredentials, getGoogleApiKey } from '@/utils/providerCredentials';

export async function initializeGenAIClient(): Promise<GoogleGenAI> {
    const activeProvider = await getActiveProvider();
    
    if (activeProvider === 'vertex') {
        const { projectId, location } = await getVertexCredentials();
        return new GoogleGenAI({
            vertexai: true,
            project: projectId,
            location: location,
        });
    } else {
        const apiKey = await getGoogleApiKey();
        return new GoogleGenAI({ apiKey });
    }
}

// Usage in ALL agents (main workflow, YouTube-to-Notion, Notion Creator)
const client = await initializeGenAIClient();
const response = await client.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { /* ... */ }
});
```

**Key Benefits:**
- ✅ Single source of truth for provider selection
- ✅ All nested agents use same provider automatically
- ✅ No provider logic duplicated in each agent
- ✅ Easy to test with both Google AI and Vertex AI
- ✅ User preference respected throughout entire workflow

### Key Benefit: No Large Context Passing Between Agents

```
❌ OLD APPROACH (Inefficient):
Main Agent ← (50k chars) ← YouTube Agent
Main Agent → (50k chars) → Notes Agent
Main Agent ← (50k chars) ← Notes Agent
Main Agent → (10k chars) → Notion API

✅ NEW APPROACH (Efficient):
Main Agent → (100 chars) → YouTube to Notion Agent
  └→ Internal: YouTube Agent → (50k chars) → stays inside
  └→ Internal: Process 50k chars → stays inside
  └→ Internal: Generate notes → stays inside
  └→ Internal: Notion Creator Agent → (5k chars structured data)
  └→ Internal: Notion API calls
Main Agent ← (200 chars) ← Success response

Result: Main agent context stays minimal!
```

### 1. YouTube to Notion Agent (Parent Sub-Agent)

```
┌─────────────────────────────────────────────────────────────────┐
│           youtubeToNotionAgent (Parent Sub-Agent)                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Input (from Main Workflow):                                    │
│  {                                                               │
│    youtubeUrl: string,        // YouTube video URL              │
│    videoTitle: string         // Video title from page          │
│  }                                                               │
│                                                                  │
│  ┌────────────────────────────────────────────────────┐         │
│  │  Phase 1: Analyze Video & Get Transcript           │         │
│  │  • Calls analyzeYouTubeVideo tool                  │         │
│  │  • Receives 50k+ char transcript                   │         │
│  │  • KEEPS in own context (no passing)               │         │
│  └────────────────────────────────────────────────────┘         │
│                         ↓                                        │
│  ┌────────────────────────────────────────────────────┐         │
│  │  Phase 2: Detect Video Type                        │         │
│  │  • Analyzes transcript patterns internally         │         │
│  │  • Keywords: "step" → tutorial                     │         │
│  │             "theory" → lecture                     │         │
│  │             "interview" → podcast                  │         │
│  │  • Determines: tutorial/lecture/podcast/etc        │         │
│  └────────────────────────────────────────────────────┘         │
│                         ↓                                        │
│  ┌────────────────────────────────────────────────────┐         │
│  │  Phase 3: Select Template & Generate Notes         │         │
│  │  • Based on detected type, select format:         │         │
│  │    - Lecture → Q&A format                          │         │
│  │    - Tutorial → Step-by-step sections              │         │
│  │    - Podcast → Key insights                        │         │
│  │  • Extract 4-10 key questions/topics               │         │
│  │  • Generate detailed content for each              │         │
│  │  • Format as structured JSON                       │         │
│  └────────────────────────────────────────────────────┘         │
│                         ↓                                        │
│  ┌────────────────────────────────────────────────────┐         │
│  │  Phase 4: Call Notion Creator Agent                │         │
│  │  • Calls notionCreatorAgent (child agent)          │         │
│  │  • Passes structured data (NOT transcript)         │         │
│  │  • Waits for success response                      │         │
│  │  • Receives Notion page URLs                       │         │
│  └────────────────────────────────────────────────────┘         │
│                                                                  │
│  Output (to Main Workflow):                                     │
│  {                                                               │
│    success: true,                                                │
│    mainPageUrl: "https://notion.so/page-id",                    │
│    pageCount: 6,                                                 │
│    videoType: "lecture",                                         │
│    message: "Created 'Video Title Notes' with 6 pages"          │
│  }                                                               │
│                                                                  │
│  Internal Tools Available:                                       │
│  • analyzeYouTubeVideo - Get transcript                         │
│  • notionCreatorAgent - Create Notion pages                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Notion Creator Agent (Child Sub-Agent)

```
┌─────────────────────────────────────────────────────────────────┐
│            notionCreatorAgent (Child Sub-Agent)                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Input (from youtubeToNotionAgent):                             │
│  {                                                               │
│    mainPageTitle: "[Video Title] Notes [Cognito AI]",          │
│    videoUrl: "https://youtube.com/...",                         │
│    nestedPages: [                                                │
│      {                                                           │
│        title: "What is Disk Scheduling?",                       │
│        content: "Detailed answer..."                            │
│      },                                                          │
│      {                                                           │
│        title: "FCFS Algorithm",                                 │
│        content: "Explanation..."                                │
│      }                                                           │
│      // ... 4-10 pages                                          │
│    ]                                                             │
│  }                                                               │
│                                                                  │
│  ┌────────────────────────────────────────────────────┐         │
│  │  Phase 1: Create Main Notion Page                  │         │
│  │  • Call notion-create-pages                        │         │
│  │  • Title: mainPageTitle                            │         │
│  │  • Properties: { "Video URL": videoUrl }           │         │
│  │  • Content: Introduction paragraph                 │         │
│  │  • Save returned page_id                           │         │
│  └────────────────────────────────────────────────────┘         │
│                         ↓                                        │
│  ┌────────────────────────────────────────────────────┐         │
│  │  Phase 2: Create Nested Pages (Loop)               │         │
│  │  • For each page in nestedPages:                   │         │
│  │    - Call notion-create-pages                      │         │
│  │    - Title: page.title                             │         │
│  │    - Parent: main_page_id                          │         │
│  │    - Content: page.content                         │         │
│  │    - Save returned page_id                         │         │
│  │  • Handle API errors gracefully                    │         │
│  │  • Respect rate limits (180/min)                   │         │
│  └────────────────────────────────────────────────────┘         │
│                         ↓                                        │
│  ┌────────────────────────────────────────────────────┐         │
│  │  Phase 3: Return Success with URLs                 │         │
│  │  • Compile all created page URLs                   │         │
│  │  • Return to parent agent                          │         │
│  └────────────────────────────────────────────────────┘         │
│                                                                  │
│  Output (to youtubeToNotionAgent):                              │
│  {                                                               │
│    success: true,                                                │
│    mainPageUrl: "https://notion.so/main-page-id",               │
│    nestedPageUrls: [                                             │
│      "https://notion.so/nested-1",                              │
│      "https://notion.so/nested-2",                              │
│      // ... all nested pages                                    │
│    ],                                                             │
│    pageCount: 6                                                  │
│  }                                                               │
│                                                                  │
│  Internal Tools Available:                                       │
│  • notion-create-pages - Create pages                           │
│  • notion-update-page - Update if needed                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Complete Workflow Execution Flow (Nested Agents)

```
┌─────────────────────────────────────────────────────────────────┐
│  USER ACTION: Select "YouTube to Notion Notes" from dropdown    │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PRE-EXECUTION VALIDATION                      │
├─────────────────────────────────────────────────────────────────┤
│  validateYouTubeToNotionPrerequisites() {                       │
│                                                                  │
│    1. Check Active Tab                                          │
│       const tab = await getActiveTab()                          │
│       if (!tab.url.includes('youtube.com/watch')) {             │
│         showErrorToast("❌ Must be on YouTube video page")      │
│         return false                                            │
│       }                                                          │
│                                                                  │
│    2. Check Notion MCP Status                                   │
│       const notionStatus = await getServerState('notion')       │
│       if (notionStatus.state !== 'connected' ||                 │
│           !notionStatus.isEnabled) {                            │
│         showErrorToast("❌ Enable Notion MCP in settings")      │
│         return false                                            │
│       }                                                          │
│                                                                  │
│    return true                                                  │
│  }                                                               │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              MAIN WORKFLOW AGENT STARTS (Lightweight)            │
│              Context: ~500 tokens only                           │
└─────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────┐
    │ STEP 1: Get Video Metadata                              │
    │ Tool: getActiveTab                                       │
    │ Output: { url, title }                                   │
    │ Context: 100 tokens                                      │
    └───────────────────────┬─────────────────────────────────┘
                            │
                            ▼
    ┌─────────────────────────────────────────────────────────┐
    │ STEP 2: Call YouTube to Notion Agent                     │
    │ Tool: youtubeToNotionAgent (SINGLE CALL)                 │
    │                                                           │
    │ Input: {                                                  │
    │   youtubeUrl: "https://youtube.com/...",                 │
    │   videoTitle: "Disk Scheduling Algorithms"              │
    │ }                                                         │
    │                                                           │
    │ Main workflow waits... (agent does heavy work)           │
    └───────────────────────┬─────────────────────────────────┘
                            │
                            │
        ┌───────────────────┴───────────────────┐
        │  YOUTUBE TO NOTION AGENT EXECUTES     │
        │  (Has its own Gemini instance)        │
        └───────────────────┬───────────────────┘
                            │
                            ▼
        ┌─────────────────────────────────────────────────────┐
        │ 2a. Call analyzeYouTubeVideo                         │
        │ • Fetches transcript (50k+ chars)                    │
        │ • KEEPS in own context (no passing back)             │
        │ • Falls back to video analysis if needed             │
        └───────────────────┬─────────────────────────────────┘
                            │
                            ▼
        ┌─────────────────────────────────────────────────────┐
        │ 2b. Detect Video Type (Internal Processing)          │
        │ • Analyzes 50k char transcript internally            │
        │ • Detects: lecture, tutorial, podcast, etc.          │
        │ • No data sent back yet                              │
        └───────────────────┬─────────────────────────────────┘
                            │
                            ▼
        ┌─────────────────────────────────────────────────────┐
        │ 2c. Generate Structured Notes (Internal)             │
        │ • Based on video type, select template               │
        │ • Extract 4-10 key questions/topics                  │
        │ • Generate detailed content for each                 │
        │ • Create structured JSON (5-10k chars)               │
        │ • Still keeping 50k transcript in context            │
        └───────────────────┬─────────────────────────────────┘
                            │
                            ▼
        ┌─────────────────────────────────────────────────────┐
        │ 2d. Call notionCreatorAgent                          │
        │ Tool: notionCreatorAgent (child agent)               │
        │                                                       │
        │ Input: {                                              │
        │   mainPageTitle: "Disk Scheduling... [Cognito AI]", │
        │   videoUrl: "https://youtube.com/...",               │
        │   nestedPages: [                                     │
        │     { title: "What is Disk Scheduling?",            │
        │       content: "..." },                              │
        │     { title: "FCFS Algorithm", content: "..." }     │
        │   ]                                                  │
        │ }                                                     │
        │                                                       │
        │ Agent waits for Notion creation...                   │
        └───────────────────┬─────────────────────────────────┘
                            │
                            │
            ┌───────────────┴──────────────┐
            │ NOTION CREATOR AGENT EXECUTES │
            │ (Has its own Gemini instance) │
            └───────────────┬──────────────┘
                            │
                            ▼
            ┌──────────────────────────────────────────────┐
            │ 2d-i. Create Main Notion Page                 │
            │ Tool: notion-create-pages                     │
            │ Returns: { page_id: "main-123" }             │
            └───────────────┬──────────────────────────────┘
                            │
                            ▼
            ┌──────────────────────────────────────────────┐
            │ 2d-ii. Create Nested Pages (Loop)             │
            │ For each of 6 pages:                          │
            │   Tool: notion-create-pages                   │
            │   Parent: "main-123"                          │
            │   Returns: { page_id: "nested-456" }         │
            └───────────────┬──────────────────────────────┘
                            │
                            ▼
            ┌──────────────────────────────────────────────┐
            │ 2d-iii. Return to Parent Agent                │
            │ Output: {                                      │
            │   success: true,                              │
            │   mainPageUrl: "https://notion.so/main-123", │
            │   nestedPageUrls: [...],                      │
            │   pageCount: 6                                │
            │ }                                              │
            └───────────────┬──────────────────────────────┘
                            │
                            │ Returns to parent
        ┌───────────────────┴─────────────────────────────────┐
        │ 2e. YouTube to Notion Agent receives success        │
        │ • Notion pages created successfully                  │
        │ • Compile response for main workflow                 │
        └───────────────────┬─────────────────────────────────┘
                            │
                            │ Returns to main workflow
    ┌───────────────────────┴─────────────────────────────────┐
    │ STEP 3: Receive Response (Compact!)                      │
    │ Output: {                                                 │
    │   success: true,                                         │
    │   mainPageUrl: "https://notion.so/main-123",            │
    │   pageCount: 6,                                          │
    │   videoType: "lecture",                                  │
    │   message: "Created 'Disk Scheduling...' with 6 pages"  │
    │ }                                                         │
    │                                                           │
    │ Context: Still only ~700 tokens total!                   │
    └───────────────────────┬─────────────────────────────────┘
                            │
                            ▼
    ┌─────────────────────────────────────────────────────────┐
    │ STEP 4: Display Success to User                          │
    │ • Show: "✅ Created 'Video Title Notes' with 6 pages"   │
    │ • Show: Notion link: [Open in Notion]                   │
    │ • Add: [WORKFLOW_COMPLETE] marker                        │
    └─────────────────────────────────────────────────────────┘

CONTEXT SIZE COMPARISON:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ Old Approach (Everything in Main Agent):
Main Workflow: 50k + 50k + 10k = 110k tokens ⚠️ Too much!

✅ New Approach (Nested Agents):
Main Workflow: 500 tokens ✅ Minimal!
YouTube to Notion Agent: 50k tokens ✅ Has context for it
Notion Creator Agent: 5k tokens ✅ Only structured data
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 🎭 Video Type Templates

### Template Definitions

```typescript
export type VideoType = 
  | 'tutorial'      // How-to, coding tutorials
  | 'lecture'       // Academic, educational content
  | 'podcast'       // Interviews, discussions
  | 'documentary'   // In-depth explorations
  | 'presentation'  // Conference talks, slides
  | 'webinar'       // Professional training
  | 'course'        // Structured learning
  | 'review'        // Product/service reviews
  | 'generic';      // Fallback

export interface VideoNotesTemplate {
  type: VideoType;
  name: string;
  description: string;
  format: 'Q&A' | 'Step-by-Step' | 'Insights' | 'Mixed';
  sectionGuidelines: {
    minSections: number;
    maxSections: number;
    sectionTypes: string[];
  };
  exampleTitles: string[];
}
```

### Template Examples

#### 1. Lecture Template (Q&A Format)
```
Type: lecture
Format: Q&A
Section Types:
  • Conceptual questions ("What is...?", "How does...?")
  • Comparison questions ("X vs Y")
  • Application questions ("When to use...?")
  • Practice problems (if mentioned)

Example Output:
├─ "What is the CAP Theorem?"
├─ "Consistency vs Availability - Trade-offs"
├─ "Real-world Examples of CAP Theorem"
└─ "Practice Problems and Solutions"
```

#### 2. Tutorial Template (Step-by-Step)
```
Type: tutorial
Format: Step-by-Step
Section Types:
  • Prerequisites & Setup
  • Implementation steps (numbered)
  • Code explanations
  • Common pitfalls
  • Best practices

Example Output:
├─ "Prerequisites and Setup"
├─ "Step 1: Initialize Project"
├─ "Step 2: Configure Authentication"
├─ "Common Errors and Solutions"
└─ "Best Practices and Optimization"
```

#### 3. Podcast Template (Key Insights)
```
Type: podcast
Format: Insights
Section Types:
  • Guest background
  • Key topics discussed
  • Main takeaways
  • Resources mentioned
  • Action items

Example Output:
├─ "Guest: John Doe - Background and Expertise"
├─ "Key Topic 1: Future of AI in Healthcare"
├─ "Key Topic 2: Challenges in Data Privacy"
├─ "Resources and Tools Mentioned"
└─ "Main Takeaways and Action Items"
```

---

## 📦 Implementation Phases (Updated for Nested Agent Architecture)

### **PHASE 1: Notion Creator Agent (Child Sub-Agent)** 
**Duration**: 3-4 hours  
**Priority**: Critical (Start Here - Foundation)

#### Why Start Here?
This is the leaf node of the agent tree. Building from bottom-up ensures we can test each layer independently.

#### Files to Create:
1. `src/ai/agents/notion/notionCreatorAgent.ts`
   - Agent implementation with GoogleGenAI client (@google/genai)
   - Provider-aware initialization using genAIFactory
   - System prompt for Notion page creation
   - Handles Notion MCP tool calls
   - Error handling for API failures
   - Works with both Google AI and Vertex AI

**Provider-Aware Initialization Example:**
```typescript
import { GoogleGenAI } from '@google/genai';
import { initializeGenAIClient } from '../../core/genAIFactory';
import { createLogger } from '../../../logger';

const log = createLogger('NotionCreatorAgent');

export async function executeNotionCreatorAgent(
  input: NotionCreatorInput
): Promise<NotionCreatorOutput> {
  try {
    log.info('Initializing Notion Creator Agent with provider-aware client');
    
    // Initialize client that respects user's provider selection
    const client = await initializeGenAIClient();
    
    // Get filtered Notion tools
    const notionTools = await getNotionTools();
    
    // Generate content with Gen AI SDK
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'user', parts: [{ text: JSON.stringify(input) }] }
      ],
      config: {
        tools: notionTools,
        temperature: 0.7,
      }
    });
    
    // Process response and handle tool calls
    return processNotionCreationResponse(response);
  } catch (error) {
    log.error('Notion Creator Agent failed', error);
    throw error;
  }
}
```

2. `src/ai/agents/notion/notionCreatorAgentTool.ts`
   - Function declaration for parent agents
   - Execute function wrapper
   - Input/output type definitions

#### Agent Responsibilities:
```typescript
// This agent ONLY handles Notion page creation
// Receives structured data, creates pages, returns URLs

Input: {
  mainPageTitle: string,
  videoUrl: string,
  nestedPages: Array<{ title: string, content: string }>
}

Internal Logic:
1. Call notion-create-pages for main page
2. Save main page ID
3. Loop through nestedPages array
4. Call notion-create-pages for each with parent_id
5. Collect all created page URLs
6. Return success with URLs

Output: {
  success: boolean,
  mainPageUrl: string,
  nestedPageUrls: string[],
  pageCount: number
}

Internal Tools Available (Filtered from MCP):
- notion-create-pages: Create pages in Notion
- notion-update-page: Update page properties
- notion-search: Search for existing pages/databases
- notion-fetch: Retrieve content from pages
- notion-move-pages: Move pages to different parents
- notion-duplicate-page: Duplicate existing pages

Note: Only these specific Notion tools are passed to this agent,
filtered from the full MCP tool set during agent initialization.
```

#### System Prompt Structure:
```typescript
// Note: Agent uses @google/genai SDK with provider-aware initialization
const systemPrompt = `You are a Notion Page Creator Agent.

**SDK**: Powered by @google/genai (supports both Google AI and Vertex AI)

Your SOLE PURPOSE is to create hierarchical Notion pages using MCP tools.

TOOLS AVAILABLE:
- notion-create-pages: Create a new page
- notion-update-page: Update page properties
- notion-search: Search for existing pages/databases
- notion-fetch: Retrieve content from a page by URL
- notion-move-pages: Move pages to different parent
- notion-duplicate-page: Duplicate existing pages

EXECUTION STEPS:
1. Create main page with mainPageTitle
2. Add Video URL as page property
3. For each nested page:
   - Create with parent_page_id = main page
   - Use page.title as title
   - Use page.content as content
4. Return all created URLs

OPTIONAL ENHANCEMENTS:
- Use notion-search to check if similar notes already exist
- Use notion-fetch to retrieve existing page structures if needed
- Use notion-move-pages if user specifies a parent location
- Use notion-duplicate-page to replicate template structures

CRITICAL RULES:
- ALWAYS create main page first
- ALWAYS use parent_page_id for nested pages
- Handle API errors gracefully
- Return all URLs for confirmation

ERROR HANDLING:
- If rate limited: return clear error message
- If unauthorized: suggest reconnecting MCP
- If page creation fails: report which page failed
- If search fails: continue with page creation anyway
`;
```

#### Tool Filtering Implementation:

**Challenge**: The agent needs ONLY Notion MCP tools, but the full MCP client includes many tools from multiple servers.

**Solution**: Filter MCP tools before passing to agent initialization.

```typescript
// In notionCreatorAgent.ts

async function getNotionTools(): Promise<Record<string, any>> {
  // Initialize MCP clients (gets all tools from all servers)
  const mcpManager = await initializeMCPClients(); // update the inilize client function it have a already initlized client it shoudl return that client instead of another new inilisation 
  
  // Filter to only Notion tools (tools with 'notion-' prefix)
  const notionTools = Object.entries(mcpManager.tools)
    .filter(([name]) => name.startsWith('notion-'))
    .reduce((acc, [name, tool]) => {
      acc[name] = tool;
      return acc;
    }, {} as Record<string, any>);
  
  log.info('✅ Filtered Notion tools for agent', {
    totalTools: Object.keys(mcpManager.tools).length,
    notionTools: Object.keys(notionTools).length,
    tools: Object.keys(notionTools)
  });
  
  // Specific tools we want for this agent:
  const allowedNotionTools = [
    'notion-create-pages',
    'notion-update-page',
    'notion-search',
    'notion-fetch',
    'notion-move-pages',
    'notion-duplicate-page'
  ];
  
  // Further filter to only allowed tools
  const filteredTools = Object.entries(notionTools)
    .filter(([name]) => allowedNotionTools.includes(name))
    .reduce((acc, [name, tool]) => {
      acc[name] = tool;
      return acc;
    }, {} as Record<string, any>);
  
  log.info('✅ Final filtered tools for Notion Creator Agent', {
    tools: Object.keys(filteredTools)
  });
  
  return filteredTools;
}

// When initializing the agent's Gemini model
const notionTools = await getNotionTools();

const model = google('gemini-2.5-flash', {
  tools: notionTools,
  // ... other config
});
```

**Key Points**:
- Filter happens at agent initialization, not at MCP client level
- Agent only sees Notion tools, keeping context clean
- Other agents can access different tool subsets
- Similar to how `setupRemoteMode()` filters tools in aiLogic.ts

#### Testing:
- [ ] Agent creates main page successfully
- [ ] Agent creates nested pages with correct parent
- [ ] URLs are returned correctly
- [ ] Error handling works for API failures
- [ ] Rate limiting is handled gracefully
- [ ] Only Notion tools are accessible to agent
- [ ] Tool filtering doesn't break MCP connections
- [ ] Agent can use notion-search for duplicate detection

---

### **PHASE 2: YouTube to Notion Agent (Parent Sub-Agent)**
**Duration**: 5-6 hours  
**Priority**: Critical

#### Why Phase 2?
This agent orchestrates the entire video-to-notes pipeline. It depends on Phase 1 (Notion Creator) being complete.

#### Files to Create:
1. `src/ai/agents/youtubeToNotion/youtubeToNotionAgent.ts`
   - Main agent with large context window
   - Uses @google/genai SDK with provider-aware initialization
   - Calls analyzeYouTubeVideo (gets 50k+ transcript)
   - Video type detection from transcript
   - Template selection logic
   - Structured notes generation
   - Calls notionCreatorAgent (Phase 1)
   - Works with both Google AI and Vertex AI

**Provider-Aware Implementation Example:**
```typescript
import { GoogleGenAI } from '@google/genai';
import { initializeGenAIClient } from '../../core/genAIFactory';
import { executeAnalyzeYouTubeVideo } from '../youtube/youtubeAgentTool';
import { executeNotionCreatorAgent } from '../notion/notionCreatorAgentTool';
import { createLogger } from '../../../logger';

const log = createLogger('YouTubeToNotionAgent');

export async function executeYouTubeToNotionAgent(
  input: YouTubeToNotionInput
): Promise<YouTubeToNotionOutput> {
  try {
    log.info('Initializing YouTube to Notion Agent', input);
    
    // Step 1: Get transcript from YouTube agent
    const transcriptResult = await executeAnalyzeYouTubeVideo({
      youtubeUrl: input.youtubeUrl,
      question: 'Get the full transcript of this video'
    });
    
    const transcript = transcriptResult.analysis;
    log.info('Received transcript', { length: transcript.length });
    
    // Step 2: Initialize provider-aware client
    const client = await initializeGenAIClient();
    
    // Step 3: Analyze transcript and generate structured notes
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [{ text: YOUTUBE_TO_NOTION_SYSTEM_PROMPT }] },
        { 
          role: 'user', 
          parts: [{ 
            text: JSON.stringify({
              transcript,
              videoTitle: input.videoTitle,
              videoUrl: input.youtubeUrl
            }) 
          }] 
        }
      ],
      config: {
        temperature: 0.7,
        responseFormat: 'json'
      }
    });
    
    // Step 4: Parse structured notes
    const notes = JSON.parse(response.text);
    
    // Step 5: Create Notion pages via child agent
    const notionResult = await executeNotionCreatorAgent({
      mainPageTitle: notes.mainPageTitle,
      videoUrl: notes.videoUrl,
      nestedPages: notes.nestedPages
    });
    
    // Step 6: Return compact success response
    return {
      success: true,
      mainPageUrl: notionResult.mainPageUrl,
      pageCount: notionResult.pageCount,
      videoType: notes.videoType,
      message: `Created '${input.videoTitle}' with ${notionResult.pageCount} pages in Notion`
    };
  } catch (error) {
    log.error('YouTube to Notion Agent failed', error);
    throw error;
  }
}
```

2. `src/ai/agents/youtubeToNotion/youtubeToNotionAgentTool.ts`
   - Function declaration for main workflow
   - Execute function wrapper
   - Input/output type definitions

3. `src/ai/agents/youtubeToNotion/templates.ts`
   - Video type enum definitions
   - Template structures for each type
   - Helper functions for template selection

#### Agent Responsibilities:
```typescript
// This agent handles ALL heavy processing
// Keeps large transcript in its own context
// Calls child agents for specific tasks

Input: {
  youtubeUrl: string,
  videoTitle: string
}

Internal Logic:
1. Call analyzeYouTubeVideo → get 50k+ char transcript
2. Analyze transcript to detect video type
3. Select appropriate template based on type
4. Generate structured notes (4-10 pages)
5. Call notionCreatorAgent with structured data
6. Wait for success response with URLs
7. Return compact response to main workflow

Output: {
  success: boolean,
  mainPageUrl: string,
  pageCount: number,
  videoType: string,
  message: string
}

Internal Tools:
- analyzeYouTubeVideo (existing)
- notionCreatorAgent (Phase 1)
```

#### Agent System Prompt Structure:
```typescript
const systemPrompt = `You are a YouTube to Notion Agent - the orchestrator of video-to-notes conversion.

Your MISSION: Convert YouTube videos into structured Notion notes by:
1. Getting video transcript
2. Analyzing and generating notes
3. Creating Notion pages via child agent

TOOLS AVAILABLE:
- analyzeYouTubeVideo: Get video transcript (may return 50k+ chars)
- notionCreatorAgent: Create Notion pages (child agent)

WORKFLOW STEPS:

1. GET TRANSCRIPT
   → Call analyzeYouTubeVideo({ youtubeUrl, question: "Get full transcript" })
   → You will receive large transcript (50k+ chars)
   → KEEP transcript in your context (don't pass to main workflow)

2. DETECT VIDEO TYPE
   Analyze transcript patterns:
   - Tutorial: "step", "how to", "let's build", code examples
   - Lecture: "theory", "concept", "definition", academic tone
   - Podcast: conversational, "interview", "guest", Q&A format
   - Documentary: narrative, "explore", "discover", storytelling
   - Presentation: "slide", "agenda", "roadmap", business context
   - Webinar: "training", "demonstration", professional dev
   - Course: "lesson", "module", "assignment", curriculum
   - Review: "pros", "cons", "comparison", evaluation
   - Generic: fallback for other types

3. SELECT TEMPLATE
   Based on video type:
   - Lecture → Q&A format (questions as page titles)
   - Tutorial → Step-by-step sections (sequential)
   - Podcast → Key insights and takeaways (topic-based)
   - Course → Lessons and practice problems
   - Review → Analysis sections (pros, cons, verdict)

4. GENERATE STRUCTURED NOTES
   - Extract 4-10 key questions/topics from transcript
   - Create detailed content for each (2-4 paragraphs)
   - Use actual information from transcript
   - Format appropriately for video type
   - No timestamps (transcript doesn't have them)

5. CREATE NOTION PAGES
   → Call notionCreatorAgent({
       mainPageTitle: "[Video Title] Notes [Cognito AI]",
       videoUrl: youtubeUrl,
       nestedPages: [
         { title: "Question 1", content: "Detailed answer..." },
         { title: "Question 2", content: "Detailed answer..." }
       ]
     })
   → Wait for success response with URLs

6. RETURN TO MAIN WORKFLOW
   → Return compact response (NO transcript, NO large context)
   → Include Notion URLs for user

INPUT FORMAT:
{
  youtubeUrl: "https://youtube.com/watch?v=...",
  videoTitle: "Video Title"
}

OUTPUT FORMAT:
{
  success: true,
  mainPageUrl: "https://notion.so/page-id",
  pageCount: 6,
  videoType: "lecture",
  message: "Created 'Video Title Notes' with 6 pages in Notion"
}

CRITICAL RULES:
- ALWAYS output valid JSON
- Create 4-10 nested pages minimum
- Each page title should be a clear question or topic
- Content must be detailed (2-4 paragraphs minimum)
- No timestamps (transcript doesn't have them)
- Smart formatting based on video type
`;
```

#### Implementation Steps:
1. Create agent with system prompt
2. Implement video type detection algorithm
3. Implement template selection logic
4. Implement notes generation with Gemini
5. Add JSON output validation
6. Add error handling for:
   - Invalid transcript
   - API failures
   - Malformed output

#### Testing:
- [ ] Agent detects video types correctly (80%+ accuracy)
- [ ] Generates valid JSON output
- [ ] Creates 4-10 nested pages consistently
- [ ] Handles long transcripts (>50k characters)
- [ ] Error handling works for edge cases

---

---

### **PHASE 3: Main Workflow Definition**
**Duration**: 2-3 hours  
**Priority**: High

#### Why Phase 3?
The workflow is now minimal - just orchestration. It depends on Phase 2 (YouTube to Notion Agent) being complete.

#### Files to Create:
1. `src/workflows/definitions/youtubeToNotionWorkflow.ts`
   - Minimal workflow definition
   - Lightweight system prompt
   - Simple tool allowlist
   - Validation logic

2. Update `src/workflows/registerAll.ts`
   - Register new workflow

#### Validation Function:
```typescript
/**
 * Validates prerequisites for YouTube to Notion workflow
 * Called before workflow starts
 */
export async function validateYouTubeToNotionPrerequisites(): Promise<{
  valid: boolean;
  error?: string;
}> {
  try {
    // 1. Check YouTube page
    const tabs = await chrome.tabs.query({ 
      active: true, 
      currentWindow: true 
    });
    
    if (!tabs[0]?.url?.includes('youtube.com/watch')) {
      return {
        valid: false,
        error: 'You must be on a YouTube video page to use this workflow.'
      };
    }

    // 2. Check Notion MCP status
    const notionState = getServerState('notion');
    
    if (!notionState) {
      return {
        valid: false,
        error: 'Notion MCP server not found. Please check settings.'
      };
    }

    if (notionState.state !== 'connected') {
      return {
        valid: false,
        error: 'Notion MCP is not connected. Please connect in Settings > MCP.'
      };
    }

    if (!notionState.isEnabled) {
      return {
        valid: false,
        error: 'Notion MCP is not enabled. Please enable it in Settings > MCP.'
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: `Validation error: ${error.message}`
    };
  }
}
```

#### Workflow Configuration (Minimal):
```typescript
export const youtubeToNotionWorkflow: WorkflowDefinition = {
  id: 'youtube-to-notion',
  name: 'YouTube to Notion Notes',
  description: 'Create structured notes from YouTube videos in Notion',
  icon: 'youtube', // Will need to add icon
  color: '#FF0000',
  stepCount: 10, // Reduced from 15 (simpler workflow)
  
  allowedTools: [
    // Only 2 tools needed!
    'getActiveTab',
    'youtubeToNotionAgent'  // Does everything else
  ],
  
  systemPrompt: `[Minimal system prompt - see below]`
};
```

#### Workflow System Prompt (Minimal):
```typescript
systemPrompt: `You are a YouTube to Notion Notes Workflow Agent.

Your MISSION: Convert YouTube videos into beautifully structured Notion notes.

WORKFLOW SEQUENCE:
1. Get video metadata (title, URL) from active tab
2. Analyze video and get transcript using analyzeYouTubeVideo tool
3. Generate structured notes using videoNotesAgent tool
4. Create main Notion page with video title
5. Create nested pages for each question/topic
6. Confirm success to user

AVAILABLE TOOLS:
- getActiveTab: Get current YouTube video info
- readPageContent: Extract additional page data if needed
- analyzeYouTubeVideo: Get video transcript and analysis
- videoNotesAgent: Generate structured notes from transcript
- notion-create-pages: Create pages in Notion
- notion-fetch: Retrieve page content
- notion-update-page: Update page properties

EXECUTION STEPS:

1. EXTRACT VIDEO INFO
   → getActiveTab()
   → Extract video URL and title

2. GET TRANSCRIPT & ANALYZE
   → analyzeYouTubeVideo({ 
       youtubeUrl: url, 
       question: "Get the full transcript of this video" 
     })
   → Extract transcript from response

3. GENERATE STRUCTURED NOTES
   → videoNotesAgent({
       transcript: transcript,
       videoTitle: title,
       videoUrl: url
     })
   → Receive structured notes in JSON format

4. CREATE MAIN NOTION PAGE
   → notion-create-pages({
       title: notes.mainPageTitle,
       properties: { "Video URL": notes.videoUrl },
       content: "Intro paragraph about the video..."
     })
   → Save main page_id

5. CREATE NESTED PAGES (loop through notes.nestedPages)
   → For each page in notes.nestedPages:
     notion-create-pages({
       title: page.title,
       parent_page_id: main_page_id,
       content: page.content
     })

6. CONFIRM SUCCESS
   → Show user: "✅ Created [Video Title] with X nested pages in Notion"
   → Provide Notion page link if available
   → Add [WORKFLOW_COMPLETE]

CRITICAL RULES:
- ALWAYS create main page first, then nested pages
- Each nested page must have parent_page_id = main page ID
- Show progress: "📹 Analyzing...", "📝 Generating notes...", "✅ Created pages"
- Handle errors gracefully with clear messages
- If transcript unavailable, inform user clearly

EXAMPLE EXECUTION:
User on: "React Hooks Tutorial" video

Step 1: Get URL → https://youtube.com/watch?v=abc123
Step 2: Get transcript → analyzeYouTubeVideo()
Step 3: Generate notes → videoNotesAgent() returns 5 pages
Step 4: Create main page → "React Hooks Tutorial Notes [Cognito AI]"
Step 5: Create 5 nested pages:
  - "What are React Hooks?"
  - "useState - Managing State"
  - "useEffect - Side Effects"
  - "Custom Hooks"
  - "Best Practices"
Step 6: ✅ Success message

Remember: Be efficient, provide progress updates, and create clean Notion structure.`
};
```

#### Testing:
- [ ] Workflow registers successfully
- [ ] Validation catches missing prerequisites
- [ ] System prompt guides agent correctly
- [ ] Tools are accessible to workflow agent
- [ ] Error messages are clear and actionable

---

### **PHASE 4: UI Integration**
**Duration**: 2-3 hours  
**Priority**: Medium

#### Files to Modify:
1. `src/components/SlashCommandDropdown.tsx` (or equivalent)
   - Add YouTube to Notion workflow option
   - Add icon (YouTube logo or video icon)
   - Wire up validation

2. `assets/youtube.tsx` (if needed)
   - Create YouTube icon component

3. Toast/Error handling components
   - Ensure error toasts display validation errors

#### UI Updates:
```typescript
// Add to workflow dropdown
const workflows = [
  // ... existing workflows
  {
    id: 'youtube-to-notion',
    name: 'YouTube to Notion Notes',
    icon: <YouTubeIcon />,
    description: 'Create structured notes in Notion',
    color: '#FF0000'
  }
];

// Add validation on selection
const handleWorkflowSelect = async (workflowId: string) => {
  if (workflowId === 'youtube-to-notion') {
    const validation = await validateYouTubeToNotionPrerequisites();
    
    if (!validation.valid) {
      showErrorToast(validation.error);
      return;
    }
  }
  
  // Start workflow...
};
```

#### Testing:
- [ ] Workflow appears in dropdown
- [ ] Icon displays correctly
- [ ] Validation errors show as toasts
- [ ] Workflow starts only after validation passes

---

### **PHASE 5: Tool Registration & Integration**
**Duration**: 2-3 hours  
**Priority**: High

#### Files to Modify:
1. `src/actions/registerAll.ts` or `src/ai/tools/registry.ts`
   - Register videoNotesAgent tool

2. `src/actions/videoNotes/useVideoNotesAgent.tsx` (create)
   - React hook to register the tool
   - UI rendering component

#### Tool Registration:
```typescript
// src/actions/videoNotes/useVideoNotesAgent.tsx
export function useVideoNotesAgent() {
  const { registerToolUI, unregisterToolUI } = useToolUI();

  useEffect(() => {
    log.info('🔧 Registering videoNotesAgent tool...');

    registerTool({
      name: 'videoNotesAgent',
      description: videoNotesAgentDeclaration.description,
      parameters: videoNotesAgentParametersSchema,
      execute: executeVideoNotesAgent,
    });

    registerToolUI('videoNotesAgent', (state: ToolUIState) => {
      return <CompactToolRenderer state={state} />;
    });

    log.info('✅ videoNotesAgent tool registration complete');

    return () => {
      log.info('🧹 Cleaning up videoNotesAgent tool');
      unregisterToolUI('videoNotesAgent');
    };
  }, []);
}
```

#### Testing:
- [ ] Tool registers without errors
- [ ] Tool appears in available tools list
- [ ] Tool executes successfully when called
- [ ] UI rendering works correctly

---

### **PHASE 6: Notion MCP Integration**
**Duration**: 2-3 hours  
**Priority**: Critical

#### Implementation:
1. Verify Notion MCP tools are accessible
2. Test `notion-create-pages` with parent_page_id
3. Handle Notion API errors gracefully
4. Test rate limiting (180 req/min, 30 search/min)

#### Notion Page Creation Logic:
```typescript
// Create main page
const mainPageResponse = await callNotionMcpTool('notion-create-pages', {
  title: mainPageTitle,
  properties: {
    'Video URL': {
      url: videoUrl
    }
  },
  children: [
    {
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{
          type: 'text',
          text: { content: 'Notes generated from YouTube video...' }
        }]
      }
    }
  ]
});

const mainPageId = mainPageResponse.id;

// Create nested pages
for (const page of nestedPages) {
  await callNotionMcpTool('notion-create-pages', {
    title: page.title,
    parent: {
      type: 'page_id',
      page_id: mainPageId
    },
    children: [
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{
            type: 'text',
            text: { content: page.content }
          }]
        }
      }
    ]
  });
}
```

#### Error Handling:
```typescript
try {
  // Create pages...
} catch (error) {
  if (error.code === 'rate_limited') {
    return {
      error: 'Notion rate limit reached. Please wait a moment and try again.'
    };
  }
  
  if (error.code === 'unauthorized') {
    return {
      error: 'Notion authorization expired. Please reconnect in Settings > MCP.'
    };
  }
  
  throw error;
}
```

#### Testing:
- [ ] Main page creates successfully
- [ ] Nested pages create with correct parent
- [ ] Video URL appears in page properties
- [ ] Content formats correctly in Notion
- [ ] Error handling catches API errors
- [ ] Rate limiting doesn't break workflow

---

### **PHASE 7: Testing & Refinement**
**Duration**: 3-4 hours  
**Priority**: High

#### Test Scenarios:

1. **Happy Path Tests**
   - [ ] Short video (5 min) - Lecture format
   - [ ] Medium video (15 min) - Tutorial format
   - [ ] Long video (45 min) - Podcast format
   - [ ] Video with transcript available
   - [ ] Video without transcript

2. **Edge Cases**
   - [ ] Very long transcript (>100k chars)
   - [ ] Video with no clear type (falls back to generic)
   - [ ] Notion page creation fails mid-process
   - [ ] User not on YouTube page
   - [ ] Notion MCP disconnected
   - [ ] Invalid video URL

3. **Error Scenarios**
   - [ ] Transcript API fails
   - [ ] Video analysis fails
   - [ ] videoNotesAgent returns invalid JSON
   - [ ] Notion rate limit hit
   - [ ] Network timeout

4. **User Experience**
   - [ ] Progress messages are clear
   - [ ] Validation errors are helpful
   - [ ] Success message includes link
   - [ ] Workflow completes cleanly
   - [ ] [WORKFLOW_COMPLETE] marker added

#### Performance Tests:
- [ ] Workflow completes in <60 seconds for typical video
- [ ] Agent handles 50k+ character transcripts
- [ ] No memory leaks during execution
- [ ] Multiple runs don't degrade performance

#### Refinement Areas:
1. Improve video type detection accuracy
2. Optimize note generation prompts
3. Fine-tune template structures
4. Improve error messages
5. Add more detailed progress indicators

---

### **PHASE 8: Documentation & Polish**
**Duration**: 1-2 hours  
**Priority**: Medium

#### Documentation to Create:
1. User guide in README or FEATURES.md
2. Developer documentation for agent architecture
3. Template customization guide
4. Troubleshooting guide

#### User Documentation:
```markdown
## YouTube to Notion Notes Workflow

### How to Use:
1. Navigate to a YouTube video
2. Open Cognito AI extension
3. Select "YouTube to Notion Notes" from workflows
4. Wait for processing (30-60 seconds)
5. Check Notion for your new notes!

### Requirements:
- Active YouTube video page
- Notion MCP connected and enabled
- Internet connection

### What You Get:
- Main page: "[Video Title] Notes [Cognito AI]"
- 4-10 nested pages based on video content
- Smart formatting based on video type
- Video URL reference

### Video Types Supported:
- Lectures → Q&A format
- Tutorials → Step-by-step guides
- Podcasts → Key insights
- And more!
```

#### Code Documentation:
- Add JSDoc comments to all functions
- Document agent system prompts
- Explain template structures
- Add inline comments for complex logic

---

## 🔄 Provider Support & Testing

### Provider Selection Propagation

All agents in the nested agent hierarchy automatically respect the user's provider selection:

```
┌────────────────────────────────────────────────────────┐
│          USER SELECTS PROVIDER IN SETTINGS             │
│          (Google AI or Vertex AI)                      │
└───────────────────────┬────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────┐
│          providerCredentials.ts                        │
│          • getActiveProvider()                         │
│          • Returns: 'google' or 'vertex'               │
└───────────────────────┬────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────┐
│          genAIFactory.ts                               │
│          • initializeGenAIClient()                     │
│          • Returns provider-specific GoogleGenAI       │
└───────────────────────┬────────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
        ▼                               ▼
┌──────────────────┐          ┌──────────────────┐
│ Main Workflow    │          │ YouTube to       │
│ Agent            │──────────│ Notion Agent     │
│ (uses client)    │          │ (uses client)    │
└──────────────────┘          └────────┬─────────┘
                                       │
                                       ▼
                              ┌──────────────────┐
                              │ Notion Creator   │
                              │ Agent            │
                              │ (uses client)    │
                              └──────────────────┘
```

**Testing Both Providers:**

```typescript
// Test 1: Google AI Provider
// 1. Set provider to 'google' in settings
// 2. Configure Google AI API key
// 3. Run workflow on YouTube video
// 4. Verify all agents use Google AI
// 5. Check Notion pages created successfully

// Test 2: Vertex AI Provider
// 1. Set provider to 'vertex' in settings
// 2. Configure Vertex AI credentials (project, location)
// 3. Run workflow on same YouTube video
// 4. Verify all agents use Vertex AI
// 5. Check Notion pages created successfully
// 6. Compare output quality with Google AI

// Test 3: Provider Switching
// 1. Start with Google AI, run workflow
// 2. Switch to Vertex AI in settings
// 3. Run workflow again on different video
// 4. Verify new workflow uses Vertex AI
// 5. Check both sets of notes in Notion
```

### Model Name Considerations

**Current Implementation:**
- All agents use `gemini-2.5-flash` model
- Model name is consistent across Google AI and Vertex AI
- No model name switching needed

**If Using Different Models:**
```typescript
// For agents that might use provider-specific models
import { getActiveProvider } from '@/utils/providerCredentials';

const activeProvider = await getActiveProvider();
const model = activeProvider === 'vertex'
  ? 'gemini-2.5-flash'  // Vertex AI model name
  : 'gemini-2.5-flash'; // Google AI model name

// Both providers support same model names for Gemini 2.0 Flash
// Only Live API requires different model names:
// - Google AI: 'gemini-live-2.5-flash-preview'
// - Vertex AI: 'gemini-2.0-flash-live-preview-04-09'
```

### Troubleshooting Provider Issues

**Issue: Agent using wrong provider**
```typescript
// Debug: Add logging in genAIFactory.ts
log.info('Initializing Gen AI client', { 
  provider: activeProvider,
  hasApiKey: !!apiKey,
  hasVertexCreds: !!(projectId && location)
});

// Verify in agent execution logs
log.info('Agent initialized', {
  agentName: 'YouTubeToNotionAgent',
  provider: await getActiveProvider()
});
```

**Issue: Vertex AI authentication fails**
- Check service account JSON is valid
- Verify project ID and location are correct
- Ensure Vertex AI API is enabled in GCP
- Check `google-auth-library` is installed

**Issue: Different output quality between providers**
- Both providers use same models (Gemini 2.5 Flash)
- Output should be identical
- If differences exist, may be due to:
  - Regional model variations
  - Quota/rate limiting differences
  - Network latency affecting streaming

## 📊 System Prompt Examples

### Video Notes Agent System Prompt (Complete)

```typescript
export const VIDEO_NOTES_AGENT_SYSTEM_PROMPT = `You are a specialized Video Notes Generation Agent with expertise in analyzing video transcripts and creating structured, hierarchical notes.

# YOUR ROLE
Convert video transcripts into beautifully structured Notion notes with intelligent formatting based on video type.

# CAPABILITIES

## 1. Video Type Detection
Analyze transcript to determine video type:
- **Tutorial**: Contains "step", "how to", "let's build", "we will create", code examples
- **Lecture**: Academic tone, "theory", "concept", "definition", "explain", structured teaching
- **Podcast**: Conversational, "interview", "guest", Q&A format, multiple speakers
- **Documentary**: Narrative style, "explore", "discover", "history", storytelling
- **Presentation**: "slide", "agenda", "roadmap", "overview", business/conference context
- **Webinar**: "training", "demonstration", "attendees", professional development
- **Course**: "lesson", "module", "assignment", "exercise", curriculum structure
- **Review**: "pros", "cons", "comparison", "verdict", evaluation of products/services
- **Generic**: Fallback for other types

## 2. Template Selection
Based on detected type, select appropriate format:
- **Lecture** → Q&A format (questions as page titles, answers as content)
- **Tutorial** → Step-by-step sections (sequential progression)
- **Podcast** → Key insights and takeaways (topic-based)
- **Course** → Lessons and practice problems (educational structure)
- **Review** → Analysis sections (pros, cons, verdict)

## 3. Note Generation Rules
- Create 4-10 nested pages (NEVER less than 4, even for short videos)
- Each page = one focused topic, question, or concept
- Page titles should be clear, concise questions or topic names
- Content should be detailed (minimum 2-4 paragraphs per page)
- Use examples from transcript when available
- No timestamps (transcript doesn't include them)
- Smart formatting: bullet points, numbered steps, paragraphs as appropriate

# INPUT FORMAT
You will receive:
{
  "transcript": "Full video transcript text...",
  "videoTitle": "Title of the YouTube video",
  "videoUrl": "https://youtube.com/watch?v=...",
  "videoDuration": 1200  // Optional, in seconds
}

# OUTPUT FORMAT (STRICT JSON)
You MUST respond with valid JSON in exactly this structure:
{
  "success": true,
  "videoType": "lecture",  // One of the types listed above
  "mainPageTitle": "[Video Title] Notes [Cognito AI]",
  "videoUrl": "https://youtube.com/watch?v=...",
  "nestedPages": [
    {
      "title": "Clear question or topic title",
      "content": "Detailed answer or explanation with examples. Multiple paragraphs. Comprehensive information extracted from transcript."
    },
    {
      "title": "Another question or topic",
      "content": "More detailed content..."
    }
    // Minimum 4 pages, maximum 10
  ]
}

# EXAMPLES

## Example 1: Academic Lecture
Input: Video about "Operating System Disk Scheduling"
Output:
{
  "success": true,
  "videoType": "lecture",
  "mainPageTitle": "Operating System Disk Scheduling Notes [Cognito AI]",
  "videoUrl": "https://youtube.com/watch?v=xyz",
  "nestedPages": [
    {
      "title": "What is Disk Scheduling?",
      "content": "Disk scheduling is the process by which the operating system determines the order in which disk I/O requests are processed. When multiple processes request disk access simultaneously, the OS must decide which request to service first to optimize performance.\\n\\nThe main goals of disk scheduling are:\\n• Minimize seek time (time for disk head to move to track)\\n• Maximize throughput (number of requests processed per unit time)\\n• Ensure fairness (prevent starvation of requests)\\n• Reduce average response time\\n\\nDifferent algorithms achieve these goals with various trade-offs."
    },
    {
      "title": "FCFS Algorithm - How It Works",
      "content": "First-Come-First-Serve (FCFS) is the simplest disk scheduling algorithm. It processes requests in the exact order they arrive, similar to a queue.\\n\\nHow it works:\\n1. Requests are placed in a queue as they arrive\\n2. Disk head moves to service each request in order\\n3. No reordering or optimization occurs\\n\\nAdvantages:\\n• Simple to implement\\n• Fair (no starvation)\\n• Predictable\\n\\nDisadvantages:\\n• High average seek time\\n• No optimization\\n• Not suitable for systems with heavy disk I/O"
    },
    {
      "title": "SSTF vs SCAN - Key Differences",
      "content": "Shortest Seek Time First (SSTF) and SCAN are two optimization-focused algorithms with different approaches.\\n\\nSSTF Algorithm:\\n• Selects request closest to current head position\\n• Minimizes seek time for each individual request\\n• Can cause starvation of distant requests\\n• Greedy approach\\n\\nSCAN Algorithm (Elevator Algorithm):\\n• Head moves in one direction, servicing all requests\\n• Reverses direction at end of disk\\n• No starvation\\n• More predictable than SSTF\\n\\nKey Difference: SSTF optimizes locally (next closest), while SCAN optimizes globally (sweep pattern)."
    },
    {
      "title": "C-LOOK Algorithm Explained",
      "content": "Circular LOOK (C-LOOK) is a variant of SCAN that improves efficiency by eliminating unnecessary head movement.\\n\\nHow it differs from SCAN:\\n• Head moves in one direction to last request (not end of disk)\\n• Immediately returns to first request in other direction\\n• Only services requests in one direction per pass\\n\\nAdvantages over SCAN:\\n• Reduces unnecessary movement to disk edges\\n• More uniform wait times\\n• Better for systems with requests concentrated in middle\\n\\nExample: If requests are at tracks [20, 40, 60, 80] and head is at 30:\\n1. Move forward: service 40, 60, 80\\n2. Jump back to 20 (don't service on return)\\n3. Repeat"
    },
    {
      "title": "Practice Problems and Solutions",
      "content": "Problem 1: Given requests at tracks [98, 183, 37, 122, 14, 124, 65, 67] with head at 53, calculate total seek time for FCFS.\\n\\nSolution:\\n• 53→98: 45\\n• 98→183: 85\\n• 183→37: 146\\n• 37→122: 85\\n• 122→14: 108\\n• 14→124: 110\\n• 124→65: 59\\n• 65→67: 2\\nTotal: 640 tracks\\n\\nProblem 2: For same requests, which algorithm gives minimum seek time?\\n\\nAnswer: SSTF typically gives minimum, but SCAN provides better fairness. Analysis would require calculating each algorithm's total movement."
    }
  ]
}

## Example 2: Tutorial Video
Input: Video about "Building a React Authentication System"
Output:
{
  "success": true,
  "videoType": "tutorial",
  "mainPageTitle": "Building a React Authentication System Notes [Cognito AI]",
  "videoUrl": "https://youtube.com/watch?v=abc",
  "nestedPages": [
    {
      "title": "Prerequisites and Project Setup",
      "content": "Before starting this tutorial, you need:\\n\\nRequired Knowledge:\\n• Basic React (hooks, components)\\n• JavaScript ES6+ features\\n• Understanding of HTTP requests\\n• Basic authentication concepts\\n\\nTools & Packages:\\n• Node.js v16+ installed\\n• npm or yarn\\n• Code editor (VS Code recommended)\\n\\nProject Setup Steps:\\n1. Create React app: npx create-react-app auth-app\\n2. Install dependencies: npm install axios react-router-dom\\n3. Install backend packages: npm install express jsonwebtoken bcrypt\\n4. Set up folder structure: /client, /server, /shared"
    },
    {
      "title": "Step 1: Setting Up Express Backend",
      "content": "[Detailed step-by-step content extracted from tutorial...]"
    }
    // ... more steps
  ]
}

# CRITICAL RULES
1. ALWAYS output valid, parseable JSON
2. ALWAYS create minimum 4 nested pages, maximum 10
3. Each page title must be clear and focused
4. Content must be detailed (minimum 2-4 paragraphs)
5. Extract actual information from transcript (don't make up content)
6. Use appropriate formatting (bullet points, numbers, paragraphs)
7. No timestamps or time references
8. If transcript is unclear, still create best possible structure
9. Main page title must end with "Notes [Cognito AI]"
10. Video URL must be included in output

# ERROR HANDLING
If transcript is insufficient or unclear:
- Still create minimum 4 pages with general content
- Use video title to infer likely topics
- Mark as generic type
- Provide helpful structure even with limited info

Remember: Your output will be directly used to create Notion pages. Make it excellent!`;
```

---

---

## 🎯 Success Criteria

### Phase 1-2 Success:
- [ ] Video type detection 80%+ accurate
- [ ] Agent generates 4-10 pages consistently
- [ ] Output is valid JSON every time
- [ ] Templates cover all video types
- [ ] ✅ **Provider-aware**: Agents use `initializeGenAIClient()` from genAIFactory
- [ ] ✅ **Both providers work**: Tested with Google AI and Vertex AI

### Phase 3-4 Success:
- [ ] Workflow validates prerequisites correctly
- [ ] Validation errors display as toasts
- [ ] Workflow appears in UI dropdown
- [ ] System prompt guides execution properly
- [ ] ✅ **Provider selection respected**: Main workflow uses correct provider

### Phase 5-6 Success:
- [ ] Tool registration works without errors
- [ ] Notion pages create successfully
- [ ] Nested pages have correct parent relationships
- [ ] Video URL appears in Notion
- [ ] ✅ **Provider switching works**: Can switch providers and re-run

### Phase 7-8 Success:
- [ ] All test scenarios pass
- [ ] Edge cases handled gracefully
- [ ] Performance meets targets (<60s)
- [ ] Documentation is complete
- [ ] ✅ **Provider parity**: Output quality identical across providers
- [ ] ✅ **Migration complete**: Uses @google/genai (not deprecated SDK)

---

## 🚀 Deployment Checklist

Before releasing:
- [ ] All phases completed
- [ ] Tests passing
- [ ] Documentation written
- [ ] Error handling tested
- [ ] User experience validated
- [ ] Performance benchmarked
- [ ] Code reviewed
- [ ] Notion MCP integration verified
- [ ] YouTube agent integration verified
- [ ] Workflow registered properly
- [ ] ✅ **SDK Migration**: All agents use @google/genai (not @google/generative-ai)
- [ ] ✅ **Provider Support**: Tested with both Google AI and Vertex AI
- [ ] ✅ **genAIFactory**: All agents use initializeGenAIClient()
- [ ] ✅ **No deprecated SDKs**: Removed @google/generative-ai dependency
- [ ] ✅ **Provider switching**: Verified behavior when switching providers

---

## 📈 Future Enhancements

### Phase 9 (Future):
- Custom template creation by users
- Video summary preview before creating pages
- Option to specify parent page in Notion
- Support for playlists (batch processing)
- Notion database integration (vs pages)
- Export notes as Markdown
- Support for other video platforms
- AI-powered related content suggestions

---

## 🔗 Dependencies

### Existing Components:
- YouTube Agent Tool (`youtubeAgentTool.ts`) - **Uses @google/genai after migration**
- Notion MCP Integration (`src/mcp/`)
- Workflow System (`src/workflows/`)
- Tool Registry (`src/ai/tools/`)
- **Gen AI Factory** (`src/ai/core/genAIFactory.ts`) - Provider-aware initialization
- **Model Factory** (`src/ai/core/modelFactory.ts`) - For AI SDK agents (PDF, Suggestions)
- Provider Credentials (`src/utils/providerCredentials.ts`)

### SDK Requirements:
- `@google/genai` v1.29.0+ - Modern Gen AI SDK (used by all agents)
- `@ai-sdk/google` v2.0.28+ - AI SDK for Google AI (used by PDF agent)
- `@ai-sdk/google-vertex` v3.0.59+ - AI SDK for Vertex AI (used by PDF agent)
- ❌ `@google/generative-ai` - **DEPRECATED** - Do not use (removed after migration)

### New Components:
- Video Notes Agent Tool (uses @google/genai)
- Video Notes Templates
- Workflow Definition (uses provider-aware agents)
- UI Integration

### Migration Status:
- ✅ YouTube Agent: Migrated to @google/genai
- ✅ Browser Agent: Migrated to @google/genai  
- ✅ PDF Agent: Uses AI SDK with modelFactory
- ✅ Suggestions: Uses AI SDK with modelFactory
- ✅ Live API: Uses @google/genai with genAIFactory

---

## 📝 Notes

### Architecture Notes:
- Large transcripts (50k+ chars) will be handled efficiently by the agent tool architecture
- Gemini 2.5 Flash model supports large context windows
- Notion rate limits: 180 req/min, 30 search/min
- Each nested page = separate API call to Notion
- Error recovery: if page creation fails, workflow should save progress
- User can always retry if something fails

### SDK & Provider Notes:
- **All agents use @google/genai** (modern Gen AI SDK, not deprecated)
- **Provider selection is centralized** via `genAIFactory.ts`
- **Nested agents inherit provider** automatically (no per-agent configuration)
- **Both Google AI and Vertex AI supported** with identical functionality
- **Model names consistent** across providers for Gemini 2.0 Flash
- **No breaking changes** when switching providers (transparent to user)
- **YouTube agent already migrated** from deprecated SDK
- **PDF agent uses AI SDK** (`@ai-sdk/google` + `@ai-sdk/google-vertex` via modelFactory)

### Testing Recommendations:
- Test each agent individually with both providers before integration
- Verify provider switching doesn't break mid-workflow
- Compare output quality between Google AI and Vertex AI
- Monitor API costs for both providers (may differ)
- Test with Vertex AI regional quotas (some regions have limits)

### Future SDK Considerations:
- If using Live API in agents, use `getLiveModelName()` from genAIFactory
- New Gen AI SDK features (streaming, caching) available to all agents
- Vertex AI specific features (tuned models) can be enabled per-provider
- Monitor SDK updates: @google/genai releases frequently

---

**Total Estimated Time**: 18-24 hours  
**Priority Order**: Phase 2 → Phase 3 → Phase 6 → Phase 1 → Phase 5 → Phase 4 → Phase 7 → Phase 8

**Start with Phase 2** (Video Notes Agent Tool) as it's the most critical and complex component.