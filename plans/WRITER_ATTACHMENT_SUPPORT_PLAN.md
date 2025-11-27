# Writer Overlay Attachment Support Implementation Plan

## Overview

This plan outlines the implementation of file attachment support (images and PDFs) in the Writer Overlay component (`/write` command), enabling users to attach files that provide context for AI-generated content.

### Goals
- Add minimal, non-intrusive attachment UI to Writer Overlay
- Support images (PNG, JPEG, WEBP, HEIC, HEIF) and PDFs
- Use Gemini's native multimodal capabilities via REST API (inline base64)
- Match existing chat attachment patterns for consistency
- Keep the overlay compact and focused

### Non-Goals
- Video/audio attachments (out of scope for writer)
- Tab attachments (different use case, already in chat)
- Google Files API upload (keep it simple with inline data)
- Multiple attachments in a single request (start with single file)

---

## Current Architecture Analysis

### Writer Flow
```
User types in input → onGenerate() called with prompt + toolSettings
    ↓
WriterOverlay.tsx sends message via chrome.runtime.Port
    ↓
Background: handler.ts receives WRITE_GENERATE request
    ↓
Background: geminiWriter.ts makes REST API call to Gemini
    ↓
SSE streaming response parsed → chunks sent back to overlay
    ↓
UI updates with streaming text
```

### Key Files
| File | Purpose |
|------|---------|
| `src/contents/write-command/WriterOverlay.tsx` | UI component - needs attachment button & preview |
| `src/background/writer/geminiWriter.ts` | API client - needs multimodal content support |
| `src/background/writer/handler.ts` | Message handler - needs to pass attachment data |
| `src/types/writecommand.ts` | Types - needs attachment interfaces |
| `src/utils/files/fileProcessor.ts` | File utilities - reuse for validation/processing |

### Existing Attachment Pattern (Chat)
The chat uses `useFileAttachments` hook which:
1. Validates files (`validateFile()`)
2. Creates base64 previews for images (`createImagePreview()`)
3. Converts to base64 for API (`fileToBase64()`)
4. Stores as `FileAttachmentData` with `{ id, file, preview?, type }`

---

## Gemini Multimodal API Format

### REST API Request with Inline Data
```typescript
// For images
{
  "contents": [{
    "role": "user",
    "parts": [
      {
        "inlineData": {
          "mimeType": "image/jpeg",
          "data": "<base64-encoded-image>"
        }
      },
      {
        "text": "Describe this image and write content based on it"
      }
    ]
  }],
  "systemInstruction": { ... },
  "generationConfig": { ... }
}

// For PDFs
{
  "contents": [{
    "role": "user",
    "parts": [
      {
        "inlineData": {
          "mimeType": "application/pdf",
          "data": "<base64-encoded-pdf>"
        }
      },
      {
        "text": "Summarize this document"
      }
    ]
  }]
}
```

### Supported MIME Types
- **Images**: `image/png`, `image/jpeg`, `image/webp`, `image/heic`, `image/heif`
- **Documents**: `application/pdf`, `text/plain`

### Size Limits
- **Inline data**: Total request < 20MB (text + images + PDFs)
- **Images**: Up to 3,000 per request, 7MB per image
- **PDFs**: Up to 50MB per file, 1000 pages max

---

## Implementation Phases

## Phase 1: Type Definitions & Utilities

### 1.1 Update Write Command Types
**File**: `src/types/writecommand.ts`

```typescript
// Add to existing types

/**
 * Attachment data for write command
 * Simplified version of chat attachments - single file focus
 */
export interface WriteAttachment {
  id: string;
  file: File;
  preview?: string;  // Base64 preview for images
  type: 'image' | 'document';
  base64Data?: string;  // Cached base64 for API call
  mimeType: string;
}

/**
 * Supported attachment MIME types for writer
 */
export const WRITER_SUPPORTED_MIME_TYPES = {
  images: ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'],
  documents: ['application/pdf', 'text/plain'],
} as const;

/**
 * Maximum file sizes
 */
export const WRITER_FILE_LIMITS = {
  image: 7 * 1024 * 1024,    // 7MB
  document: 20 * 1024 * 1024, // 20MB (keeping under 20MB total request limit)
} as const;

// Update WriteGenerateRequest.payload
export interface WriteGenerateRequest {
  action: 'WRITE_GENERATE';
  payload: {
    prompt: string;
    pageContext?: WritePageContext;
    settings?: {
      tone?: WriteTone;
      maxTokens?: number;
      enableUrlContext?: boolean;
      enableGoogleSearch?: boolean;
      enableSupermemorySearch?: boolean;
    };
    // NEW: Attachment data (serialized for messaging)
    attachment?: {
      base64Data: string;
      mimeType: string;
      fileName: string;
      fileSize: number;
    };
  };
}
```

### 1.2 Create Writer Attachment Utilities
**File**: `src/contents/write-command/writerAttachmentUtils.ts` (NEW)

```typescript
/**
 * Writer Attachment Utilities
 * File validation and processing specific to the writer overlay
 */

import { WRITER_SUPPORTED_MIME_TYPES, WRITER_FILE_LIMITS } from '@/types';

export interface AttachmentValidation {
  valid: boolean;
  error?: string;
}

/**
 * Validate file for writer attachment
 */
export function validateWriterAttachment(file: File): AttachmentValidation {
  const isImage = WRITER_SUPPORTED_MIME_TYPES.images.includes(file.type as any);
  const isDocument = WRITER_SUPPORTED_MIME_TYPES.documents.includes(file.type as any);

  if (!isImage && !isDocument) {
    return {
      valid: false,
      error: `Unsupported file type. Use: PNG, JPEG, WebP, HEIC, HEIF, or PDF`,
    };
  }

  const maxSize = isImage ? WRITER_FILE_LIMITS.image : WRITER_FILE_LIMITS.document;
  if (file.size > maxSize) {
    const maxMB = Math.round(maxSize / 1024 / 1024);
    return {
      valid: false,
      error: `File too large. Max ${maxMB}MB for ${isImage ? 'images' : 'documents'}`,
    };
  }

  return { valid: true };
}

/**
 * Convert file to base64
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Extract base64 portion (remove data URL prefix)
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Create image preview URL
 */
export function createPreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to create preview'));
    reader.readAsDataURL(file);
  });
}

/**
 * Determine attachment type from MIME
 */
export function getAttachmentType(mimeType: string): 'image' | 'document' {
  return WRITER_SUPPORTED_MIME_TYPES.images.includes(mimeType as any)
    ? 'image'
    : 'document';
}
```

### 1.3 Create useWriterAttachment Hook
**File**: `src/contents/write-command/useWriterAttachment.ts` (NEW)

```typescript
/**
 * Writer Attachment Hook
 * Manages single file attachment for the writer overlay
 */

import { useState, useCallback, useRef } from 'react';
import type { WriteAttachment } from '@/types';
import {
  validateWriterAttachment,
  fileToBase64,
  createPreview,
  getAttachmentType,
} from './writerAttachmentUtils';

interface UseWriterAttachmentOptions {
  onError?: (message: string) => void;
}

export function useWriterAttachment({ onError }: UseWriterAttachmentOptions = {}) {
  const [attachment, setAttachment] = useState<WriteAttachment | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Process and set a file as attachment
   */
  const processFile = useCallback(async (file: File) => {
    // Validate
    const validation = validateWriterAttachment(file);
    if (!validation.valid) {
      onError?.(validation.error || 'Invalid file');
      return false;
    }

    setIsProcessing(true);

    try {
      const type = getAttachmentType(file.type);
      const base64Data = await fileToBase64(file);
      
      let preview: string | undefined;
      if (type === 'image') {
        preview = await createPreview(file);
      }

      const newAttachment: WriteAttachment = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        preview,
        type,
        base64Data,
        mimeType: file.type,
      };

      setAttachment(newAttachment);
      return true;
    } catch (error) {
      onError?.('Failed to process file');
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [onError]);

  /**
   * Handle file input change
   */
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processFile(file);
    }
    // Reset input to allow re-selecting same file
    e.target.value = '';
  }, [processFile]);

  /**
   * Handle file drop
   */
  const handleFileDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processFile(file);
    }
  }, [processFile]);

  /**
   * Handle paste event
   */
  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    const file = e.clipboardData?.files?.[0];
    if (file) {
      e.preventDefault();
      await processFile(file);
    }
  }, [processFile]);

  /**
   * Clear attachment
   */
  const clearAttachment = useCallback(() => {
    setAttachment(null);
  }, []);

  /**
   * Open file picker
   */
  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /**
   * Get attachment data for API (serializable)
   */
  const getAttachmentForApi = useCallback(() => {
    if (!attachment || !attachment.base64Data) return undefined;
    
    return {
      base64Data: attachment.base64Data,
      mimeType: attachment.mimeType,
      fileName: attachment.file.name,
      fileSize: attachment.file.size,
    };
  }, [attachment]);

  return {
    attachment,
    isProcessing,
    fileInputRef,
    processFile,
    handleFileChange,
    handleFileDrop,
    handlePaste,
    clearAttachment,
    openFilePicker,
    getAttachmentForApi,
  };
}
```

---

## Phase 2: Backend API Support

### 2.1 Update GeminiWriter for Multimodal
**File**: `src/background/writer/geminiWriter.ts`

```typescript
// Update WriterOptions interface
export interface WriterOptions {
  tone?: WriteTone;
  maxTokens?: number;
  pageContext?: WritePageContext;
  enableUrlContext?: boolean;
  enableGoogleSearch?: boolean;
  // NEW: Attachment support
  attachment?: {
    base64Data: string;
    mimeType: string;
    fileName: string;
    fileSize: number;
  };
}

// Update buildRequestBody method (add new private method)
private buildRequestParts(prompt: string, options?: WriterOptions): Array<any> {
  const parts: Array<any> = [];

  // Add attachment first (before text, per Gemini best practices)
  if (options?.attachment) {
    parts.push({
      inlineData: {
        mimeType: options.attachment.mimeType,
        data: options.attachment.base64Data,
      },
    });
  }

  // Add text prompt
  parts.push({ text: prompt });

  return parts;
}

// Update generate() method - modify body construction
async generate(prompt: string, options?: WriterOptions): Promise<string> {
  const provider = await this.getProviderInfo(false);
  const systemPrompt = this.buildSystemPrompt(options);
  const maxTokens = options?.maxTokens || 1024;

  // Build tools array
  const tools: Array<Record<string, unknown>> = [];
  if (options?.enableUrlContext) tools.push({ url_context: {} });
  if (options?.enableGoogleSearch) tools.push({ google_search: {} });

  // Build content parts (multimodal support)
  const parts = this.buildRequestParts(prompt, options);

  const body = {
    contents: [{
      role: 'user',
      parts,
    }],
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: maxTokens,
      topP: 0.95,
    },
    ...(tools.length > 0 && { tools }),
  };

  log.info('Making multimodal API call', {
    promptLength: prompt.length,
    provider: provider.type,
    hasAttachment: !!options?.attachment,
    attachmentType: options?.attachment?.mimeType,
    tools: tools.length > 0 ? tools.map(t => Object.keys(t)[0]) : undefined,
  });

  // ... rest of fetch logic
}

// Similarly update generateStream() method
```

### 2.2 Update Handler to Pass Attachment
**File**: `src/background/writer/handler.ts`

```typescript
export async function handleWriteGenerate(
  request: WriteGenerateRequest,
  port: chrome.runtime.Port
): Promise<void> {
  const { prompt, pageContext, settings, attachment } = request.payload;

  log.info('Processing write request', {
    promptLength: prompt.length,
    platform: pageContext?.platform,
    hasAttachment: !!attachment,
    attachmentType: attachment?.mimeType,
    attachmentSize: attachment?.fileSize,
  });

  const options: WriterOptions = {
    tone: settings?.tone,
    maxTokens: settings?.maxTokens,
    pageContext,
    enableUrlContext: settings?.enableUrlContext ?? false,
    enableGoogleSearch: settings?.enableGoogleSearch ?? false,
    // NEW: Pass attachment
    attachment: attachment,
  };

  // ... rest of handler logic
}
```

---

## Phase 3: UI Implementation

### 3.1 Create Writer Attachment Preview Component
**File**: `src/contents/write-command/WriterAttachmentPreview.tsx` (NEW)

```tsx
/**
 * Writer Attachment Preview
 * Compact preview for attached file in writer overlay
 */
import React from 'react';
import type { WriteAttachment } from '@/types';

interface WriterAttachmentPreviewProps {
  attachment: WriteAttachment;
  onRemove: () => void;
  disabled?: boolean;
}

// Compact icons
const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const FileIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
  </svg>
);

export function WriterAttachmentPreview({
  attachment,
  onRemove,
  disabled,
}: WriterAttachmentPreviewProps) {
  const truncateName = (name: string, maxLength = 20) => {
    if (name.length <= maxLength) return name;
    const ext = name.split('.').pop() || '';
    const base = name.substring(0, name.lastIndexOf('.'));
    const truncated = base.substring(0, maxLength - ext.length - 3);
    return `${truncated}...${ext}`;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  };

  return (
    <div className="writer-attachment-preview">
      {attachment.type === 'image' && attachment.preview ? (
        <div className="writer-attachment-image">
          <img src={attachment.preview} alt={attachment.file.name} />
          <div className="writer-attachment-image-overlay">
            <span className="writer-attachment-name" title={attachment.file.name}>
              {truncateName(attachment.file.name)}
            </span>
          </div>
        </div>
      ) : (
        <div className="writer-attachment-document">
          <span className="writer-attachment-icon"><FileIcon /></span>
          <span className="writer-attachment-name" title={attachment.file.name}>
            {truncateName(attachment.file.name)}
          </span>
          <span className="writer-attachment-size">
            {formatSize(attachment.file.size)}
          </span>
        </div>
      )}
      <button
        type="button"
        className="writer-attachment-remove"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemove();
        }}
        disabled={disabled}
        title="Remove attachment"
        aria-label="Remove attachment"
      >
        <XIcon />
      </button>
    </div>
  );
}
```

### 3.2 Update Writer Overlay with Attachment Support
**File**: `src/contents/write-command/WriterOverlay.tsx`

Key changes:
1. Add hidden file input
2. Add attachment button (paperclip icon) next to send button
3. Show attachment preview when file is attached
4. Update onGenerate to include attachment data
5. Add paste handler for images
6. Add drag-drop support

```tsx
// Add imports
import { useWriterAttachment } from './useWriterAttachment';
import { WriterAttachmentPreview } from './WriterAttachmentPreview';

// Add PaperclipIcon
const PaperclipIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" 
          strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Update component props
interface WriterOverlayProps {
  // ... existing props
  onGenerate: (
    prompt: string, 
    toolSettings?: { enableUrlContext: boolean; enableGoogleSearch: boolean },
    attachment?: { base64Data: string; mimeType: string; fileName: string; fileSize: number }
  ) => void;
}

// Inside component
export function WriterOverlay({ ... }) {
  // Add attachment hook
  const {
    attachment,
    isProcessing,
    fileInputRef,
    handleFileChange,
    handlePaste,
    clearAttachment,
    openFilePicker,
    getAttachmentForApi,
  } = useWriterAttachment({
    onError: (message) => {
      // Could show inline error or use existing error state
      console.error('[WriterOverlay] Attachment error:', message);
    },
  });

  // Add paste listener effect
  useEffect(() => {
    const inputEl = inputRef.current;
    if (!inputEl) return;
    
    const handlePasteEvent = (e: ClipboardEvent) => {
      // Check if there are files in clipboard
      if (e.clipboardData?.files?.length) {
        handlePaste(e);
      }
    };
    
    inputEl.addEventListener('paste', handlePasteEvent);
    return () => inputEl.removeEventListener('paste', handlePasteEvent);
  }, [handlePaste]);

  // Update generate handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if ((prompt.trim() || attachment) && !isGenerating) {
      onGenerate(
        prompt, 
        { enableUrlContext, enableGoogleSearch },
        getAttachmentForApi()
      );
      clearAttachment(); // Clear after sending
    }
  };

  // ... in render

  return (
    <div ref={overlayRef} className="writer-overlay" ...>
      {/* Header */}
      ...

      {/* Attachment Preview (above input) */}
      {attachment && (
        <WriterAttachmentPreview
          attachment={attachment}
          onRemove={clearAttachment}
          disabled={isGenerating}
        />
      )}

      {/* Input Row - add attachment button */}
      <form className="writer-input-row" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          className="writer-input"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={attachment ? "Describe what to write..." : "What would you like me to write?"}
          disabled={isGenerating}
          autoComplete="off"
        />
        {/* Attachment button */}
        <button
          type="button"
          className={`writer-attach-button ${attachment ? 'writer-attach-button--active' : ''}`}
          onClick={openFilePicker}
          disabled={isGenerating || isProcessing}
          title="Attach file (image or PDF)"
        >
          <PaperclipIcon />
        </button>
        {/* Send button */}
        <button
          type="button"
          className="writer-send-button"
          onClick={handleSendClick}
          disabled={(!prompt.trim() && !attachment) || isGenerating}
          title="Generate (Enter)"
        >
          <SendIcon />
        </button>
      </form>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/heic,image/heif,application/pdf,text/plain"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* Processing indicator */}
      {isProcessing && (
        <div className="writer-processing">Processing file...</div>
      )}

      {/* Rest of component */}
      ...
    </div>
  );
}
```

### 3.3 Add CSS Styles
**File**: `src/contents/write-command/styles.css` (update existing or add)

```css
/* Writer Attachment Styles */
.writer-attachment-preview {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  margin: 0 12px 8px;
  position: relative;
}

.writer-attachment-image {
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
}

.writer-attachment-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.writer-attachment-image-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
  padding: 4px 6px 2px;
}

.writer-attachment-document {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.writer-attachment-icon {
  color: var(--text-secondary, #94a3b8);
  flex-shrink: 0;
}

.writer-attachment-name {
  font-size: 12px;
  color: var(--text-primary, #e2e8f0);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.writer-attachment-size {
  font-size: 11px;
  color: var(--text-tertiary, #64748b);
  flex-shrink: 0;
}

.writer-attachment-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  border: none;
  border-radius: 50%;
  color: var(--text-primary, #e2e8f0);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s;
}

.writer-attachment-preview:hover .writer-attachment-remove {
  opacity: 1;
}

.writer-attachment-remove:hover {
  background: rgba(239, 68, 68, 0.8);
}

/* Attach button styles */
.writer-attach-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--text-tertiary, #64748b);
  cursor: pointer;
  border-radius: 4px;
  transition: color 0.15s, background 0.15s;
}

.writer-attach-button:hover:not(:disabled) {
  color: var(--text-primary, #e2e8f0);
  background: rgba(255, 255, 255, 0.1);
}

.writer-attach-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.writer-attach-button--active {
  color: var(--accent-primary, #3b82f6);
}

/* Processing indicator */
.writer-processing {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  font-size: 12px;
  color: var(--text-secondary, #94a3b8);
}
```

---

## Phase 4: Integration & Testing

### 4.1 Update Exports
**File**: `src/contents/write-command/index.ts`

```typescript
// Add new exports
export { useWriterAttachment } from './useWriterAttachment';
export { WriterAttachmentPreview } from './WriterAttachmentPreview';
export * from './writerAttachmentUtils';
```

### 4.2 Update Write Command Content Script
The content script that mounts WriterOverlay needs to handle the new onGenerate signature:

```typescript
// In the component that uses WriterOverlay
const handleGenerate = async (
  prompt: string,
  toolSettings?: { enableUrlContext: boolean; enableGoogleSearch: boolean },
  attachment?: { base64Data: string; mimeType: string; fileName: string; fileSize: number }
) => {
  const port = chrome.runtime.connect({ name: 'write-command' });
  
  port.postMessage({
    action: 'WRITE_GENERATE',
    payload: {
      prompt,
      pageContext: currentPageContext,
      settings: {
        tone: settings.tone,
        enableUrlContext: toolSettings?.enableUrlContext,
        enableGoogleSearch: toolSettings?.enableGoogleSearch,
        enableSupermemorySearch: settings.enableSupermemorySearch,
      },
      attachment, // NEW: Include attachment
    },
  });
};
```

### 4.3 Testing Checklist

#### Unit Tests
- [ ] `validateWriterAttachment` - valid image types
- [ ] `validateWriterAttachment` - valid PDF
- [ ] `validateWriterAttachment` - reject video
- [ ] `validateWriterAttachment` - reject oversized files
- [ ] `fileToBase64` - correct encoding
- [ ] `getAttachmentType` - correct type detection

#### Integration Tests
- [ ] Attach image via file picker
- [ ] Attach PDF via file picker
- [ ] Paste image from clipboard
- [ ] Remove attachment
- [ ] Generate with image attachment
- [ ] Generate with PDF attachment
- [ ] Generate with attachment + text prompt
- [ ] Generate with attachment only (no text)
- [ ] Error handling - invalid file type
- [ ] Error handling - file too large
- [ ] UI state during processing

#### E2E Tests
- [ ] Full flow: Attach image → Write prompt → Generate → Insert
- [ ] Full flow: Attach PDF → Write prompt → Generate → Insert
- [ ] Verify streaming works with attachments

---

## Phase 5: Polish & Optimization

### 5.1 Drag & Drop Support (Enhancement)
Add drop zone to the input area:

```tsx
// In WriterOverlay
const [isDragging, setIsDragging] = useState(false);

const handleDragOver = (e: React.DragEvent) => {
  e.preventDefault();
  setIsDragging(true);
};

const handleDragLeave = (e: React.DragEvent) => {
  e.preventDefault();
  setIsDragging(false);
};

const handleDrop = async (e: React.DragEvent) => {
  e.preventDefault();
  setIsDragging(false);
  const file = e.dataTransfer.files?.[0];
  if (file) {
    await processFile(file);
  }
};

// Add to form element
<form
  className={`writer-input-row ${isDragging ? 'writer-input-row--dragover' : ''}`}
  onDragOver={handleDragOver}
  onDragLeave={handleDragLeave}
  onDrop={handleDrop}
  ...
>
```

### 5.2 Image Compression (Optional Enhancement)
For large images, compress before encoding:

```typescript
async function compressImage(file: File, maxWidth = 1920): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Compression failed')),
        'image/jpeg',
        0.85
      );
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
```

### 5.3 System Prompt Update
Update `buildSystemPrompt` in `geminiWriter.ts` to handle attachments:

```typescript
private buildSystemPrompt(options?: WriterOptions): string {
  // ... existing prompt building

  // Add attachment-specific instructions
  let attachmentInstructions = '';
  if (options?.attachment) {
    const isImage = options.attachment.mimeType.startsWith('image/');
    attachmentInstructions = isImage
      ? `\n\nThe user has attached an image. Analyze it carefully and incorporate what you see into your response. Describe relevant visual elements if they relate to the writing request.`
      : `\n\nThe user has attached a document. Read and analyze its contents carefully. Use the information from the document to inform your response. You can reference specific details, summarize sections, or build upon the document's content as needed.`;
  }

  return `${basePrompt}${attachmentInstructions}`;
}
```

---

## File Summary

### New Files
| File | Description |
|------|-------------|
| `src/contents/write-command/writerAttachmentUtils.ts` | Validation & file processing utilities |
| `src/contents/write-command/useWriterAttachment.ts` | React hook for attachment state |
| `src/contents/write-command/WriterAttachmentPreview.tsx` | UI component for preview |

### Modified Files
| File | Changes |
|------|---------|
| `src/types/writecommand.ts` | Add attachment types & limits |
| `src/background/writer/geminiWriter.ts` | Add multimodal request building |
| `src/background/writer/handler.ts` | Pass attachment to writer |
| `src/contents/write-command/WriterOverlay.tsx` | Add attachment UI & handling |
| `src/contents/write-command/index.ts` | Export new modules |

---

## Implementation Order

1. **Phase 1**: Type definitions & utilities (1-2 hours)
2. **Phase 2**: Backend multimodal support (1-2 hours)
3. **Phase 3**: UI implementation (2-3 hours)
4. **Phase 4**: Integration & testing (1-2 hours)
5. **Phase 5**: Polish & optimization (1-2 hours)

**Total Estimated Time**: 6-11 hours

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Large base64 payloads | Compress images, enforce size limits |
| Content script messaging limits | Test with max size files, chunking if needed |
| Shadow DOM isolation | Ensure styles are properly scoped |
| Memory leaks from preview URLs | Clean up object URLs on unmount |
| API rate limits with large files | Add retry logic, error messaging |

---

## Future Enhancements

- [ ] Multiple attachments support
- [ ] Image cropping/annotation
- [ ] URL-based attachments (paste image URL)
- [ ] Drag from external apps
- [ ] Thumbnail generation for PDFs
- [ ] Progress indicator for large files
- [ ] Camera capture for mobile/tablet
