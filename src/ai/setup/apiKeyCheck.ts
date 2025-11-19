/**
 * API Key Validation
 * Handles missing API key errors and displays instructions
 */

import { generateId } from 'ai';
import { createLogger } from '@logger';

const log = createLogger('AI-APIKeyCheck');

/**
 * Write missing API key error to stream
 */
export function writeMissingApiKeyError(writer: any): void {
    const errorMsg = 'Please configure your Gemini API key to use the AI assistant.';
    const instructionMsg = '\n\n**How to add your API key:**\n1. Click the **⋯** (three dots) menu in the chat header\n2. Select "Gemini API Key Setup"\n3. Enter your Gemini API key\n4. Click "Save API Key"\n\n**Don\'t have an API key?**\nGet a free API key from [Google AI Studio](https://aistudio.google.com/app/apikey)';

    log.error('❌ Missing API key for remote mode');

    // Write error message to the stream
    writer.write({
        type: 'text-delta',
        id: 'api-key-error-' + generateId(),
        delta: `⚠️ **API Key Required**\n\n${errorMsg}${instructionMsg}`,
    });

    // Write completion status
    writer.write({
        type: 'data-status',
        id: 'status-' + generateId(),
        data: { status: 'completed', timestamp: Date.now() },
        transient: true,
    });
}
