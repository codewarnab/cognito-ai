/**
 * Stream Parser for AI SDK v6 UI Message Stream
 * 
 * Parses SSE (Server-Sent Events) chunks from the backend
 * and converts them to normalized event types.
 */

import { createLogger } from '~logger';
import type { ParsedStreamEvent } from './types';

const log = createLogger('StreamParser', 'AI_CHAT_BACKEND');

/**
 * Parse AI SDK v6 UI Message Stream format (SSE only)
 * 
 * Format: data: {"type":"...", ...}
 * 
 * Supported types:
 * - start: Message start with messageId
 * - text-start/text-delta/text-end: Text streaming
 * - tool-input-available: Complete tool call ready for execution
 * - tool-output-available: Tool result
 * - finish/finish-step: Stream completion
 * - error: Stream error
 */
export function parseStreamChunk(chunk: string): ParsedStreamEvent[] {
    const events: ParsedStreamEvent[] = [];

    // SSE streams are newline-delimited; split into individual lines for processing
    const lines = chunk.split('\n');

    for (const line of lines) {
        // Skip empty lines (SSE uses blank lines as event separators)
        if (!line.trim()) continue;

        // AI SDK v6 SSE format: each event is prefixed with "data: " followed by JSON payload
        // Example: data: {"type":"text-delta","delta":"Hello"}
        if (line.startsWith('data: ')) {
            // Extract the JSON payload after "data: " prefix (6 characters)
            const dataContent = line.slice(6);

            // Handle stream termination marker - "[DONE]" signals end of stream
            if (dataContent === '[DONE]') {
                events.push({ type: 'finish', data: { done: true } });
                continue;
            }

            try {
                const parsed = JSON.parse(dataContent);
                const eventType = parsed.type;

                // Map AI SDK v6 event types to our internal normalized event types
                // This normalization allows the rest of the code to work with consistent types
                switch (eventType) {
                    // Text streaming events - track start/content/end for proper message assembly
                    case 'text-start':
                        events.push({ type: 'text_start', data: { id: parsed.id } });
                        break;

                    case 'text-delta':
                        // Text content chunk - the core streaming payload
                        events.push({ type: 'text', data: parsed.delta });
                        break;

                    case 'text-end':
                        events.push({ type: 'text_end', data: { id: parsed.id } });
                        break;

                    // Tool execution events - handle tool calls and their results
                    case 'tool-input-available':
                        // AI model is requesting a tool to be executed
                        // Contains toolCallId (for correlation), toolName, and input arguments
                        events.push({
                            type: 'tool_call',
                            data: {
                                id: parsed.toolCallId,
                                name: parsed.toolName,
                                arguments: parsed.input,
                            },
                        });
                        break;

                    case 'tool-output-available':
                        // Result from a server-executed tool (e.g., webSearch, YouTube transcript)
                        events.push({ type: 'tool_result', data: parsed });
                        break;

                    case 'tool-input-error':
                        // Backend couldn't find or validate the requested tool
                        // This happens when AI hallucinates a tool name or uses wrong format
                        events.push({
                            type: 'tool_error',
                            data: {
                                id: parsed.toolCallId,
                                name: parsed.toolName,
                                input: parsed.input,
                                errorText: parsed.errorText,
                            },
                        });
                        break;

                    case 'tool-output-error':
                        // Accompanies tool-input-error with same info - we already captured
                        // the error from tool-input-error, so skip to avoid duplicates
                        break;

                    // Error and completion events
                    case 'error':
                        log.error('Stream error:', parsed);
                        events.push({ type: 'error', data: { message: parsed.errorText || 'Unknown error' } });
                        break;

                    case 'finish':
                    case 'finish-step':
                        // Generation complete - finish signals end of entire response,
                        // finish-step signals end of one step in multi-step generation
                        events.push({ type: 'finish', data: parsed });
                        break;

                    // Silently ignore other event types that we don't need to process:
                    // - start, start-step: Session initialization (handled implicitly)
                    // - reasoning-*: Chain-of-thought events (not displayed to user)
                    // - source-*: Attribution/citation events (not currently used)
                    // - file: File attachment events (handled separately)
                    default:
                        break;
                }
            } catch (e) {
                // Non-JSON lines or malformed JSON - skip silently
                // This can happen with partial chunks or SSE keep-alive messages
            }
        }
        // Lines starting with ":" are SSE comments/keep-alive pings - ignore them
    }

    return events;
}
