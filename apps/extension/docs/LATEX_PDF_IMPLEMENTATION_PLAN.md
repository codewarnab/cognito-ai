# LaTeX PDF Generation Implementation Plan

> **Goal:** Replace jsPDF-based PDF generation with LaTeX Online API to produce professional, high-quality PDF reports with proper typography and formatting.

## Architecture

```
┌─────────────┐    LaTeX     ┌─────────────────┐    PDF
│   AI/LLM    │──────────────▶│ LaTeX Online API │──────────▶ Download
└─────────────┘              └─────────────────┘
                                      │
                             (If API fails)
                                      ▼
                              ┌───────────────┐  
                              │ Error Message │
                              │  + Retry      │
                              └───────────────┘
```

**Key Design Decision:** The LLM generates LaTeX directly (not markdown). This gives full LaTeX power without lossy markdown→LaTeX conversion.

## User Review Required

> [!IMPORTANT]  
> **Phase 1 (Frontend-Direct)** will call the LaTeX Online API directly from the extension. This exposes the API endpoint in client-side code. Is this acceptable for the initial phase?

> [!WARNING]  
> **LaTeX Online API Limitations** discovered from GitHub issues:
> - `#93` - **414 Request-URI Too Large**: Long LaTeX content may exceed URL length limits (affects `?text=` endpoint)
> - `#102/#98` - **FontAwesome not available**: Avoid `\usepackage{fontawesome}` in templates
> - `#50` - **Includes not working**: `\include{}` and `\input{}` are ignored for text compilation
> - `#62` - **No BibTeX support**: Bibliography must be embedded directly
> - Service has occasional downtime (multiple "server down" issues)

---

## Proposed Changes

### Phase 1: Frontend Direct API Call (MVP)

---

### Extension - Core PDF Generation

#### [MODIFY] [generatePDF.tsx](file:///c:/Users/User/code/hackathons/chrome-ai/apps/extension/src/actions/reports/generatePDF.tsx)

**Current State:** Uses jsPDF to convert markdown to PDF with manual text rendering.

**Changes:**
1. **Replace `generatePDF` function** - Take LaTeX content directly, call LaTeX Online API
2. **Remove markdown parsing** - LLM now generates LaTeX directly
3. **Add API call logic** - Use `fetch()` to call `https://latexonline.cc/compile?text=<encoded_latex>`
4. **Update tool description** - Specify LaTeX input format and limitations
5. **Add error handling** - Show helpful error message if API fails (no jsPDF fallback needed)
6. **Handle known issues** - Content length validation, sanitization for unsupported packages

```typescript
// Simplified function signature
async function generatePDFFromLatex(latexContent: string): Promise<Blob>;
```

**LaTeX Document Template (wrapped automatically):**
```latex
\documentclass[11pt,a4paper]{article}
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage{lmodern}
\usepackage{geometry}
\usepackage{hyperref}
\usepackage{enumitem}

\geometry{margin=1in}

\begin{document}
% LLM-generated content here
\end{document}
```

---

#### [NEW] [latexUtils.ts](file:///c:/Users/User/code/hackathons/chrome-ai/apps/extension/src/actions/reports/latexUtils.ts)

**Purpose:** Utility functions for LaTeX generation and API interaction.

```typescript
// Escape special LaTeX characters (for any user-provided text)
export function escapeLatex(text: string): string;

// Wrap LLM content in full LaTeX document
export function wrapInLatexDocument(content: string, title?: string): string;

// Call LaTeX Online API and return PDF blob
export function compileLatexToPDF(latex: string): Promise<Blob>;

// Validate content length (avoid 414 errors)
export function validateLatexLength(latex: string): { valid: boolean; error?: string };

// Sanitize for known issues (remove unsupported packages)
export function sanitizeForLatexOnline(latex: string): string;
```

> [!NOTE]
> No `markdownToLatex()` function needed - LLM generates LaTeX directly.

---

### Extension - Template Updates

#### [MODIFY] [templates.ts](file:///c:/Users/User/code/hackathons/chrome-ai/apps/extension/src/actions/reports/templates.ts)

**Current State:** Templates define markdown structure with sections and bullet items.

**Changes:**
1. **Convert template definitions to LaTeX format** - Replace markdown section hints with LaTeX equivalents
2. **Add `latexPreamble` property** - Optional custom LaTeX packages/styling per template type
3. **Templates now guide LaTeX output** - AI uses template structure to generate proper LaTeX sections

> [!NOTE]  
> Templates now serve as LaTeX structure guides. The LLM generates LaTeX directly following these templates.

---

### Extension - Research Workflow Updates

#### [MODIFY] [researchWorkflow.ts](file:///c:/Users/User/code/hackathons/chrome-ai/apps/extension/src/workflows/definitions/researchWorkflow.ts)

**Current State:** System prompt instructs AI to generate markdown content for PDF.

**Changes to prompt (~lines 127-145):**
1. **Update OUTPUT FORMAT section** - Instruct AI to generate LaTeX-formatted content instead of markdown
2. **Add LaTeX best practices** - Guidelines for proper LaTeX syntax
3. **Add known limitations** - Warn about unsupported packages and features
4. **Update emoji/Unicode warning** - LaTeX has different character restrictions

**New prompt section:**
```
⚠️ CRITICAL FOR LATEX REPORT GENERATION:
- Use LaTeX formatting: \\section{}, \\subsection{}, \\textbf{}, \\begin{itemize}
- DO NOT use emojis, special Unicode characters, or symbols
- DO NOT use \\include{} or \\input{} - all content must be inline
- DO NOT use \\usepackage{fontawesome} - not available
- Use plain ASCII text only: letters, numbers, basic punctuation
- Escape special characters: # $ % & _ { } ~ ^
- For bullets use: \\begin{itemize} \\item ... \\end{itemize}
- For numbered lists use: \\begin{enumerate} \\item ... \\end{enumerate}
```

---

#### [MODIFY] [generatePDF tool description](file:///c:/Users/User/code/hackathons/chrome-ai/apps/extension/src/actions/reports/generatePDF.tsx#L262-L271)

**Current description:**
```
Generate a PDF file and display it as an interactive attachment in chat with Open/Download buttons. Uses jsPDF library for reliable PDF generation.
```

**New description:**
```
Generate a professional PDF report using LaTeX formatting and display it as an interactive attachment in chat with Open/Download buttons.

INPUT: LaTeX-formatted content (not markdown). Use LaTeX commands:
- \\section{Title}, \\subsection{Title} for headers
- \\textbf{text} for bold
- \\begin{itemize} \\item ... \\end{itemize} for bullets
- \\begin{enumerate} \\item ... \\end{enumerate} for numbered lists
- Standard paragraphs as plain text

LIMITATIONS (LaTeX Online API):
- No \\include{} or \\input{} - all content must be inline
- No fontawesome package - use standard symbols
- No BibTeX - embed citations directly
- Max ~8000 characters recommended (URL length limits)
- Escape special chars: # $ % & _ { } ~ ^

Shows error with retry option if LaTeX compilation fails.
```

---

### Extension - Adaptive Mode Prompt Updates

#### [MODIFY] [adaptivePrompt.ts](file:///c:/Users/User/code/hackathons/chrome-ai/apps/extension/src/ai/prompts/templates/adaptivePrompt.ts)

**Changes:**
- No changes needed for Phase 1 - `generatePDF` is workflow-only tool (not available in adaptive mode)

---

### Phase 2: Vercel Backend Proxy (Future)

---

### Backend Vercel - New Endpoint

#### [NEW] [latex-compile endpoint](file:///c:/Users/User/code/hackathons/chrome-ai/packages/backend-vercel/index.js)

**Add new endpoint after `/retrieve`:**

```javascript
/**
 * POST /latex-compile
 * Compiles LaTeX content to PDF using LaTeX Online API.
 * Acts as a proxy to avoid CORS issues and hide API details.
 * 
 * Request Body:
 *   latexContent (string): The LaTeX content to compile
 *   command (string, optional): Compiler - 'pdflatex' (default), 'xelatex', 'lualatex'
 * 
 * Response:
 *   200: PDF binary with Content-Type: application/pdf
 *   400: Invalid request (missing latexContent)
 *   500: Compilation error (returns error log)
 */
app.post('/latex-compile', async (req, res) => {
  try {
    const { latexContent, command = 'pdflatex' } = req.body;
    
    if (!latexContent) {
      return res.status(400).json({ error: 'Missing latexContent' });
    }
    
    const encodedLatex = encodeURIComponent(latexContent);
    const apiUrl = `https://latexonline.cc/compile?text=${encodedLatex}&command=${command}`;
    
    const response = await axios.get(apiUrl, {
      responseType: 'arraybuffer',
      timeout: 30000, // 30 second timeout
    });
    
    if (response.status !== 200) {
      return res.status(response.status).json({
        error: 'LaTeX compilation failed',
        log: response.data.toString('utf-8')
      });
    }
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="report.pdf"',
    });
    
    return res.send(Buffer.from(response.data));
  } catch (error) {
    console.error('[LaTeX] Compilation error:', error.message);
    return res.status(500).json({
      error: 'LaTeX compilation failed',
      details: error.message
    });
  }
});
```

**Environment Variables (add to `.env`):**
- None required for LaTeX Online (no API key)
- Optional: `LATEX_API_URL` for self-hosted instance

---

## Known LaTeX Online Issues & Mitigations

Based on [GitHub Issues](https://github.com/aslushnikov/latex-online/issues):

| Issue | Problem | Mitigation |
|-------|---------|------------|
| [#93](https://github.com/aslushnikov/latex-online/issues/93) | 414 Request-URI Too Large | Validate content length before sending; split large documents; use POST when proxy is ready |
| [#56](https://github.com/aslushnikov/latex-online/issues/56) | CORS blocking | Implement Vercel proxy in Phase 2 |
| [#102](https://github.com/aslushnikov/latex-online/issues/102), [#98](https://github.com/aslushnikov/latex-online/issues/98) | FontAwesome not available | Document in AI prompt; don't use in templates |
| [#50](https://github.com/aslushnikov/latex-online/issues/50) | `\include{}` not working | All content must be inline; document in prompt |
| [#62](https://github.com/aslushnikov/latex-online/issues/62) | No BibTeX support | Embed citations directly |
| [#78](https://github.com/aslushnikov/latex-online/issues/78) | POST not supported for `?text=` | Use GET with encoded URL; implement proxy for large content |
| [#81](https://github.com/aslushnikov/latex-online/issues/81) | Dependencies not supported via API | Keep documents self-contained |
| Multiple | Service downtime | Implement jsPDF fallback; add retry logic |

**AI Prompt Guidelines to Avoid Issues:**

Add to workflow prompt:
```
LATEX ONLINE API LIMITATIONS - AVOID THESE:
1. DO NOT use \usepackage{fontawesome} or \usepackage{fontawesome5} - not installed
2. DO NOT use \include{file} or \input{file} - external files ignored
3. DO NOT use BibTeX (\bibliography{}, \bibliographystyle{}) - not supported
4. DO NOT use tikz with xelatex - known compatibility issue (#96)
5. DO NOT use .eps figures with pdflatex - use .png or .pdf images
6. KEEP content under 8000 characters to avoid URL length errors (#93)
7. ESCAPE these characters: # $ % & _ { } ~ ^ \
8. USE standard LaTeX packages: geometry, hyperref, enumitem, graphicx, amsmath
```

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `generatePDF.tsx` | MODIFY | Replace jsPDF with LaTeX Online API call |
| `latexUtils.ts` | NEW | LaTeX utilities, API wrapper, validators |
| `templates.ts` | MODIFY | Convert templates to LaTeX format |
| `researchWorkflow.ts` | MODIFY | Update system prompt for LaTeX output |
| `backend-vercel/index.js` | NEW (Phase 2) | Add `/latex-compile` proxy endpoint |

---

## Verification Plan

### Automated Tests

```bash
# Run extension build to verify no TypeScript errors
pnpm --filter @cognito/extension build

# Test LaTeX API directly (manual)
# Create test with sample LaTeX → API call → verify PDF
```

### Manual Verification

1. **Basic LaTeX Compilation**
   - Generate simple LaTeX document
   - Call LaTeX Online API directly
   - Verify PDF output

2. **Research Workflow Test**
   - Start research workflow
   - Complete research on a topic
   - Verify PDF is generated with proper formatting

3. **Error Handling Test**
   - Simulate API failure (disconnect network)
   - Verify error message appears with retry option

4. **Edge Cases**
   - Test with special characters (# $ % & _ { } ~ ^)
   - Test with long content (near 8000 char limit)
   - Test with Unicode/emoji (should be rejected by LLM)

5. **Cross-browser**
   - Test in Chrome (primary)
   - Note any CORS issues for Phase 2 prioritization

---

## Implementation Order

1. **Create `latexUtils.ts`** - Core utilities first
2. **Update `templates.ts`** - Convert to LaTeX format
3. **Update `researchWorkflow.ts`** - Update AI prompt to generate LaTeX
4. **Update `generatePDF.tsx`** - Call LaTeX Online API
5. **Test Phase 1** - Verify frontend-direct works
6. **(If CORS issues) Implement Vercel proxy** - Phase 2

---

## Questions for User

1. What's the expected maximum document length for research reports?
2. Do you want custom LaTeX styling per template type (e.g., different fonts for person vs tech reports)?

