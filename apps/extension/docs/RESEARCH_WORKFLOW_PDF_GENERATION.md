# Research Workflow & PDF Generation Documentation

> **Complete documentation for the Cognito AI research workflow system, including PDF generation pipeline, LaTeX templating, and backend API integration.**

## Table of Contents

1. [Overview](#overview)
2. [Research Workflow](#research-workflow)
3. [Report Templates](#report-templates)
4. [PDF Generation Pipeline](#pdf-generation-pipeline)
5. [Backend LaTeX API](#backend-latex-api)
6. [LaTeX Sanitization](#latex-sanitization)
7. [Data Flow](#data-flow)
8. [Configuration](#configuration)
9. [Troubleshooting](#troubleshooting)

---

## Overview

The Research Workflow is a specialized AI agent mode in Cognito that automates deep research with comprehensive tool access. It:

- Searches multiple sources (minimum configurable, default 5)
- Extracts and analyzes information from each source
- Generates a professional PDF report using LaTeX templating
- Stores PDFs in IndexedDB for persistent access

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Research Workflow Flow                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────┐     ┌───────────────┐     ┌─────────────┐     ┌─────────────┐ │
│  │ User    │────▶│ getReport     │────▶│ Research    │────▶│ generatePDF │ │
│  │ Query   │     │ Template      │     │ Phase       │     │ Tool        │ │
│  └─────────┘     └───────────────┘     └─────────────┘     └──────┬──────┘ │
│                         │                    │                      │       │
│                         ▼                    ▼                      │       │
│                 ┌───────────────┐     ┌─────────────┐              │       │
│                 │ Template      │     │ Min 5+      │              │       │
│                 │ Selection     │     │ Sources     │              │       │
│                 │ (person/tech/ │     │ Visited     │              │       │
│                 │  company/etc) │     └─────────────┘              │       │
│                 └───────────────┘                                   │       │
│                                                                     ▼       │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    Extension (latexUtils.ts)                          │  │
│  │   ┌──────────────────────────────────────────────────────────────┐   │  │
│  │   │  generatePDFFromLatex(content, { title, filename })          │   │  │
│  │   │    → POST /latex-compile                                      │   │  │
│  │   └──────────────────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│                                    ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │              Backend Vercel (packages/backend-vercel)                 │  │
│  │                                                                       │  │
│  │   ┌────────────────────────────────────────────────────────────┐     │  │
│  │   │            /latex-compile Endpoint                          │     │  │
│  │   │   ┌──────────┐    ┌───────────────┐    ┌───────────────┐   │     │  │
│  │   │   │ Request  │───▶│ wrapInLatex   │───▶│ needsChunking │   │     │  │
│  │   │   │ Parsing  │    │ Document()    │    │ Check         │   │     │  │
│  │   │   └──────────┘    └───────────────┘    └───────┬───────┘   │     │  │
│  │   │                                                 │           │     │  │
│  │   │                    ┌────────────┴────────────┐              │     │  │
│  │   │                    ▼                         ▼              │     │  │
│  │   │            ┌──────────────┐          ┌──────────────┐       │     │  │
│  │   │            │ Direct Text  │          │ Gist-Based   │       │     │  │
│  │   │            │ (< 2500 ch)  │          │ (> 2500 ch)  │       │     │  │
│  │   │            └──────┬───────┘          └──────┬───────┘       │     │  │
│  │   │                   │                         │               │     │  │
│  │   │                   ▼                         ▼               │     │  │
│  │   │            ┌─────────────────────────────────────────┐      │     │  │
│  │   │            │         sanitizeForLatexOnline()         │      │     │  │
│  │   │            │  (1300+ lines of sanitization logic)     │      │     │  │
│  │   │            └─────────────────────────────────────────┘      │     │  │
│  │   │                            │                                 │     │  │
│  │   │                            ▼                                 │     │  │
│  │   │            ┌─────────────────────────────────────────┐      │     │  │
│  │   │            │       LaTeX Online API                   │      │     │  │
│  │   │            │   https://latexonline.cc/compile         │      │     │  │
│  │   │            └─────────────────────────────────────────┘      │     │  │
│  │   └────────────────────────────────────────────────────────┘     │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│                                    ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      PDF Response → IndexedDB                         │  │
│  │   ┌──────────────────────────────────────────────────────────────┐   │  │
│  │   │  storePDF(blob, filename) → pdfId                             │   │  │
│  │   │  Chat displays interactive attachment (Open/Download)         │   │  │
│  │   └──────────────────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Research Workflow

### Definition File

**Location:** `apps/extension/src/workflows/definitions/researchWorkflow.ts`

The research workflow is defined as a `WorkflowDefinition` with:

| Property | Description |
|----------|-------------|
| `id` | `'research'` |
| `name` | `'Research'` |
| `description` | `'Deep research with ideas and implementation plan'` |
| `stepCount` | Configurable (default: 50) |
| `allowedTools` | See below |
| `systemPrompt` | Dynamic prompt generated based on settings |

### Allowed Tools

```typescript
// Navigation
'navigateTo', 'switchTabs', 'getActiveTab', 'openTab', 'getAllTabs'

// Content extraction
'readPageContent', 'extractText', 'getSearchResults'

// Search
'chromeSearch', 'openSearchResult'

// Interaction
'clickByText', 'typeInField', 'pressKey', 'scrollPage'

// Tab management
'applyTabGroups', 'organizeTabsByContext'

// Report generation (workflow-only tools)
'getReportTemplate', 'generatePDF'
```

### Workflow Execution Sequence

1. **Determine research type** → Call `getReportTemplate({ reportType, topicName })`
2. **Navigate to Google** → Search for the topic
3. **Get search results** → Parse structured data
4. **Open multiple sources** → `openSearchResult({ ranks: [1, 2, 3, 4, 5] })`
5. **Read each source** → `switchTabs()` + `readPageContent()` for each
6. **Synthesize findings** → Following template structure
7. **Generate PDF** → `generatePDF({ content, title, filename })` - **MANDATORY**
8. **Mark complete** → `[WORKFLOW_COMPLETE]` marker

### Settings

The workflow is configurable via `getResearchWorkflowSettings()`:

```typescript
interface ResearchWorkflowSettings {
  minimumSources: number;  // Default: 5
  stepCount: number;       // Default: 50
}
```

---

## Report Templates

### Template Types

**Location:** `apps/extension/src/actions/reports/templates.ts`

| Type | Use Case | Description |
|------|----------|-------------|
| `person` | People, developers, entrepreneurs | Bio, experience, skills, contributions |
| `technology` | Frameworks, libraries, tools | Features, architecture, adoption |
| `company` | Businesses, startups | Overview, products, market position |
| `concept` | Methodologies, best practices | Definition, principles, applications |
| `product` | SaaS, apps, services | Features, pricing, reviews |
| `generic` | Everything else | Flexible template |

### Template Structure

```typescript
interface ReportTemplate {
  name: string;           // Display name
  description: string;    // When to use
  sections: TemplateSection[];
}

interface TemplateSection {
  title: string;          // Section header
  description?: string;   // Helper text
  bullet?: boolean;       // Is it a list?
  items?: string[];       // List items to cover
}
```

### Example: Person Template Sections

1. **Research Summary** - 2-3 sentence intro
2. **Background & Identity** - Name, location, role
3. **Professional Experience** - Work history
4. **Skills & Expertise** - Technical skills
5. **Notable Projects & Contributions** - Major works
6. **Online Presence & Community** - GitHub, social, talks
7. **Sources Visited** - URLs with assessments
8. **Professional Insights** - 5-7 unique insights

### getReportTemplate Tool

**Location:** `apps/extension/src/actions/reports/getReportTemplate.tsx`

```typescript
getReportTemplate({
  reportType: 'person' | 'technology' | 'company' | 'concept' | 'product' | 'generic',
  topicName: string  // e.g., "codewarnab", "React", "OpenAI"
})
```

**Returns:**

```typescript
{
  success: boolean;
  reportType: string;
  templateName: string;
  sections: TemplateSection[];
  sectionCount: number;
  markdownStructure: string;  // Formatted template for AI to follow
  message: string;
}
```

---

## PDF Generation Pipeline

### Extension Side

**Location:** `apps/extension/src/actions/reports/generatePDF.tsx`

#### generatePDF Tool

```typescript
generatePDF({
  content: string;           // LaTeX content (optional if using buffer)
  title?: string;            // Research subject (displayed in header)
  filename?: string;         // Default: 'report'
  compileFromBuffer?: boolean; // Compile from IndexedDB sections
})
```

**Returns:**

```typescript
{
  success: boolean;
  filename: string;
  message: string;
  size: number;
  fileData: {
    type: 'file';
    name: string;
    pdfId: string;      // IndexedDB reference
    mediaType: 'application/pdf';
    size: number;
  }
}
```

### latexUtils.ts

**Location:** `apps/extension/src/actions/reports/latexUtils.ts`

```typescript
// Main function - calls backend API
async function generatePDFFromLatex(
  latexContent: string,
  options: { filename?: string; title?: string }
): Promise<Blob>
```

**Request to Backend:**

```json
{
  "latexContent": "\\section{...}...",
  "command": "pdflatex",
  "filename": "research-topic.pdf",
  "title": "Research Subject Name",
  "date": "December 20, 2025"
}
```

---

## Backend LaTeX API

**Location:** `packages/backend-vercel/src/routes/latex/`

### Endpoint

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/latex-compile` | Compile LaTeX to PDF |

### Request Schema (Zod)

```typescript
{
  latexContent: z.string().min(1),
  command: z.enum(['pdflatex', 'xelatex', 'lualatex']).default('pdflatex'),
  filename: z.string().default('report.pdf'),
  title: z.string().optional(),
  date: z.string().optional()
}
```

### Response

- **Success:** `application/pdf` binary
- **Error:** `{ error: string; message: string }`

### Compilation Methods

#### 1. Direct Text Compilation (< 2500 chars)

```typescript
compileLatexToPDF(latex: string, command: string): Promise<Buffer>
```

Uses `https://latexonline.cc/compile?text=...&command=pdflatex`

#### 2. Gist-Based Compilation (> 2500 chars)

```typescript
compileViaGist(latex: string, command: string): Promise<Buffer>
```

1. Creates temporary private GitHub Gist
2. Compiles via `https://latexonline.cc/compile?url=<gist_raw_url>`
3. Deletes Gist after compilation

**Environment Variable Required:** `GITHUB_GIST_TOKEN`

### Document Wrapping

**Function:** `wrapInLatexDocument(content, options)`

```typescript
interface WrapOptions {
  includeFooter?: boolean;  // "Generated by Cognito AI" footer
  title?: string;           // Styled title header
  date?: string;            // Date below title
}
```

**LaTeX Preamble:**

```latex
\documentclass[11pt,a4paper]{article}
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage{lmodern}
\usepackage{geometry}
\usepackage{hyperref}
\usepackage{enumitem}
\usepackage{graphicx}
\usepackage{amsmath}

\geometry{margin=1in}
\hypersetup{colorlinks=true,linkcolor=blue,urlcolor=blue}
```

**Title Block (when title provided):**

```latex
\begin{center}
{\LARGE \textbf{Research Report}}\\[0.3em]
{\Large <title>}\\[0.3em]
{\small <date>}
\end{center}
\vspace{0.5em}
\hrule
\vspace{1.5em}
```

**Footer:**

```latex
\vfill
\begin{center}
\rule{0.5\textwidth}{0.4pt}\\[0.5em]
\textit{Generated by \href{https://cognito-ai.dev}{Cognito AI}}
\end{center}
```

---

## LaTeX Sanitization

**Location:** `packages/backend-vercel/src/routes/latex/sanitizer.ts`

The sanitizer is a comprehensive 1300+ line module that ensures LaTeX compatibility with the LaTeX Online API.

### Main Functions

```typescript
// Full sanitization with options and warnings
sanitizeLatex(latex: string, options?: SanitizationOptions): SanitizationResult

// Quick sanitization (backward compatible)
sanitizeForLatexOnline(latex: string): string

// Validation
validateLatex(latex: string): ValidationResult
```

### Sanitization Pipeline (13 Steps)

| Step | Function | Description |
|------|----------|-------------|
| 0 | `protectEnvironments` | Protect verbatim/lstlisting from changes |
| 1 | `removeUnsupportedCommands` | Remove fontawesome, tikz, etc. |
| 2 | `removeProblematicUnicode` | Remove emojis and special Unicode |
| 3 | `cleanProblematicCharacters` | Convert symbols to LaTeX equivalents |
| 4 | `convertMarkdownArtifacts` | **bold** → `\textbf{}`, etc. |
| 4b | `convertBareUrlsToLinks` | URLs → `\url{}` |
| 4c | `convertBackticks` | Code blocks → verbatim, inline → texttt |
| 4d | `convertMarkdownHeadings` | `#` → `\section{}` |
| 5 | `escapeUnderscores` | Context-aware underscore escaping |
| 5b | `escapeCarets` | `^` outside math → `\textasciicircum{}` |
| 5c | `escapeSpecialCharsInText` | `$%&#` escaping (math-aware) |
| 5d | `escapeRawBackslashes` | Raw `\` → `\textbackslash{}` |
| 6 | `normalizeQuotes` | Smart quotes → LaTeX quotes |
| 7 | `sanitizeUrls` | Escape `%#` in URLs |
| 8 | `sanitizeLists` | Wrap in itemize/enumerate |
| 9 | `fixStructuralIssues` | Balance braces, close environments |
| 10 | `normalizeWhitespace` | Clean excessive newlines |
| 11 | Fix double-escaping | `\\\\` → `\\` |
| 12 | `restoreEnvironments` | Restore protected content |

### Unsupported Packages

These are automatically removed:

- `fontawesome`, `fontawesome5`
- `tikz`, `pgfplots`
- `minted`, `listings`
- `soul`, `ulem`
- `pdfpages`
- `animate`
- Minted code blocks

### Character Conversions

| Character | LaTeX Equivalent |
|-----------|------------------|
| `–` (en-dash) | `--` |
| `—` (em-dash) | `---` |
| `…` | `\ldots{}` |
| `©` | `\textcopyright{}` |
| `°` | `\textdegree{}` |
| `±` | `$\pm$` |
| `→` | `$\rightarrow$` |
| Greek letters | `$\alpha$`, `$\beta$`, etc. |
| `✓`, `✔` | `\checkmark{}` |
| Emojis | Removed |

### SanitizationOptions

```typescript
interface SanitizationOptions {
  removeUnsupported?: boolean;      // Default: true
  escapeSpecialChars?: boolean;     // Default: true
  convertMarkdown?: boolean;        // Default: true
  fixStructure?: boolean;           // Default: true
  normalizeWhitespace?: boolean;    // Default: true
  removeEmojis?: boolean;           // Default: true
  debug?: boolean;                  // Default: false
}
```

---

## Data Flow

### Complete Request/Response Flow

```
1. User initiates research workflow
                    │
                    ▼
2. AI calls getReportTemplate({reportType: "technology", topicName: "React"})
                    │
                    ▼
3. AI navigates, searches, reads 5+ sources
                    │
                    ▼
4. AI calls generatePDF({
     content: "\\section{Research Summary}...",
     title: "React",
     filename: "research-react"
   })
                    │
                    ▼
5. Extension: generatePDFFromLatex() called
     - Adds current date
     - POST to /latex-compile
                    │
                    ▼
6. Backend receives request
     - Validates with Zod
     - Checks rate limits
     - wrapInLatexDocument() adds preamble, title, footer
     - needsChunking() checks size
                    │
           ┌───────┴───────┐
           ▼               ▼
7a. < 2500 chars     7b. > 2500 chars
    Direct text           Gist-based
    compilation           compilation
           │               │
           └───────┬───────┘
                   ▼
8. sanitizeForLatexOnline() - 13-step sanitization
                   │
                   ▼
9. LaTeX Online API (https://latexonline.cc/compile)
                   │
                   ▼
10. PDF buffer returned to backend
                   │
                   ▼
11. Backend returns application/pdf
                   │
                   ▼
12. Extension receives blob
     - storePDF() saves to IndexedDB
     - Returns fileData with pdfId
                   │
                   ▼
13. Chat displays interactive PDF attachment
     - Open button (new tab)
     - Download button
```

---

## Configuration

### Environment Variables

#### Extension (`apps/extension/.env`)

```bash
WXT_BACKEND_API_URL=https://your-backend.vercel.app
```

#### Backend (`packages/backend-vercel/.env`)

```bash
# Required for large documents
GITHUB_GIST_TOKEN=ghp_xxxxxxxxxxxx

# Rate limiting (optional)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

### Research Workflow Settings

Stored in Chrome storage, configurable via settings UI:

```typescript
{
  minimumSources: 5,   // Min sources before synthesis phase
  stepCount: 50        // Max AI steps
}
```

---

## Troubleshooting

### Common Issues

#### "Document too large" Error

**Cause:** Content > 2500 chars but `GITHUB_GIST_TOKEN` not configured.

**Solution:** Add GitHub token with Gist permissions to backend environment.

#### "LaTeX compilation failed"

**Cause:** Invalid LaTeX syntax that sanitizer couldn't fix.

**Debug:** Enable debug logging:

```typescript
sanitizeLatex(content, { debug: true });
```

**Common fixes:**
- Remove emojis and special Unicode manually
- Ensure all `\begin{}` have matching `\end{}`
- Check for unescaped `#$%&_{}~^`

#### PDF Has Missing Content

**Cause:** Unsupported LaTeX packages used.

**Solution:** Avoid:
- `\usepackage{fontawesome}`
- `\include{}` or `\input{}`
- External resources

#### Rate Limit Exceeded

**Response:** HTTP 429

**Solution:** Wait for rate limit window (default: 1 minute) or configure backend rate limits.

### Debugging Tools

```bash
# Test LaTeX compilation locally
cd packages/backend-vercel
node test-latex-api.js

# View test input
cat test.json
```

### Log Categories

```typescript
// Extension
createLogger('Tool-GeneratePDF', 'TOOLS_EXECUTION');
createLogger('LaTeX-Utils', 'TOOLS_EXECUTION');
createLogger('Tool-GetReportTemplate', 'TOOLS_EXECUTION');

// Backend
console.log('[LaTeX] ...');
```

---

## API Reference

### POST /latex-compile

**Request:**

```json
{
  "latexContent": "\\section{Title}\\n\\nContent here...",
  "command": "pdflatex",
  "filename": "report.pdf",
  "title": "Research Subject",
  "date": "December 20, 2025"
}
```

**Success Response:**

```
HTTP/1.1 200 OK
Content-Type: application/pdf
Content-Disposition: inline; filename="report.pdf"

<PDF binary data>
```

**Error Response:**

```json
{
  "error": "LaTeX compilation failed",
  "message": "Specific error message"
}
```

**Rate Limit Response:**

```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 60
}
```

---

## File References

| Component | Location |
|-----------|----------|
| Research Workflow Definition | `apps/extension/src/workflows/definitions/researchWorkflow.ts` |
| Report Templates | `apps/extension/src/actions/reports/templates.ts` |
| getReportTemplate Tool | `apps/extension/src/actions/reports/getReportTemplate.tsx` |
| generatePDF Tool | `apps/extension/src/actions/reports/generatePDF.tsx` |
| LaTeX Utilities (Extension) | `apps/extension/src/actions/reports/latexUtils.ts` |
| Backend LaTeX Router | `packages/backend-vercel/src/routes/latex/index.ts` |
| Backend Compiler | `packages/backend-vercel/src/routes/latex/compiler.ts` |
| Backend Sanitizer | `packages/backend-vercel/src/routes/latex/sanitizer.ts` |

---

*Last updated: December 20, 2025*
