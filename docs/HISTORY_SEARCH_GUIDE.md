# Chrome History Search Feature

## Overview

The Chrome AI assistant now has full conversational access to your browser history. The AI will automatically search your history when you ask questions about previously visited pages, without you needing to explicitly request it.

## Features

### 1. Search History by Text
Search through your browser history by keywords, matching against page titles and URLs.

### 2. Get Recent History
Quickly retrieve pages you've visited in the last few hours or days.

### 3. Detailed Visit Information
Get detailed information about specific URLs including visit timestamps and how you navigated to them.

## Example Prompts

### Finding Previously Visited Pages
- "What was that React hooks article I read yesterday?"
- "Find that GitHub repo I visited last week"
- "Show me all the YouTube videos I watched today"
- "Find that LinkedIn profile I looked at this morning"
- "What was that Python tutorial I saw recently?"

### Time-Based Queries
- "Show my browsing history from 2 hours ago"
- "What sites did I visit this morning?"
- "Show me everything I browsed yesterday"
- "What pages did I look at in the last week?"

### Topic-Based Searches
- "What sites have I visited about machine learning?"
- "Find all the documentation pages I've looked at"
- "Show me React-related pages I've visited"
- "What shopping sites did I check out recently?"

### Specific URL Queries
- "When did I last visit stackoverflow.com?"
- "How many times have I visited GitHub today?"
- "Show me all visits to reddit.com"

## How It Works

The AI automatically detects when your question is about past browsing and:

1. **Understands Time Context**: Converts natural language time references into specific time ranges
   - "yesterday" → last 24 hours
   - "last week" → last 7 days (168 hours)
   - "recently" → last 48 hours
   - "this morning" → last 12 hours
   - "today" → current day

2. **Searches Intelligently**: Uses relevant keywords from your question to search history

3. **Provides Results**: Shows you matching pages with titles, URLs, visit counts, and timestamps

4. **Takes Action**: Can navigate to found pages or provide you with the information directly

## Privacy

- All history searches happen **locally** in your browser
- No history data is sent to external servers
- The AI only accesses history when relevant to your queries
- You maintain full control over your browser history through Chrome's settings

## Technical Details

### Available Tools

#### `searchHistory`
- Search by text query with optional time filters
- Returns up to 20 results by default (configurable)
- Matches against page titles and URLs

#### `getRecentHistory`
- Quick access to recent browsing
- Default: last 24 hours
- Returns up to 50 results

#### `getUrlVisits`
- Detailed information for specific URLs
- Shows all visit timestamps
- Includes navigation transition types (link, typed, reload, etc.)

### Permissions

The extension requires the `history` permission to access your browsing history. This is declared in the manifest and must be approved when you install or update the extension.

## Tips for Best Results

1. **Be Specific with Time**: "yesterday" works better than "a while ago"
2. **Use Keywords**: Include memorable words from page titles or domains
3. **Try Broader Searches**: If specific terms don't work, try more general keywords
4. **Combine Context**: "that React article from GitHub last week" is better than just "article"

## Conversational Integration

The history search is naturally integrated into the AI's workflow:

- The AI checks current page context first
- Then searches history if the question is about past browsing
- Falls back to web search only if not found in history
- Never needs explicit commands like "search my history" (but you can still say that if you want!)

## Example Conversations

**User:** "What was that article about Next.js routing I read yesterday?"

**AI:** *Searches history for "Next.js routing" in the last 24 hours, finds the article, and shows you the title, URL, and can navigate to it*

---

**User:** "Find that GitHub repo about state management"

**AI:** *Searches history for "state management" filtering for github.com, shows matching repositories you've visited*

---

**User:** "Show me what I browsed this morning"

**AI:** *Uses getRecentHistory with 12-hour window, displays chronological list of pages*

---

Enjoy seamless access to your browsing history through natural conversation!

