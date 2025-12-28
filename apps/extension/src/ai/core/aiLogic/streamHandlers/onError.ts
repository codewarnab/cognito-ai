/**
 * Stream onError Handler
 * Handles various error types during AI streaming
 */

import { generateId } from 'ai';
import { createLogger } from '~logger';

import {
    EmptyResponseError,
    isEmptyResponseError,
} from '../../../../errors/errorTypes';
import { parseProviderError } from '../../../errors/handlers';
import { writeErrorToStream } from '../../../stream/streamHelpers';

import type { AIProvider } from '../types';

const log = createLogger('AI-StreamError', 'AI_CHAT');

interface OnErrorContext {
    /** Writer for the UI message stream */
    writer: any;
    /** Current AI provider */
    provider: AIProvider;
    /** All available tools */
    tools: Record<string, any>;
    /** Initial active tools (reflects actual mode) */
    initialActiveTools?: string[];
    /** User's error callback */
    onError?: (error: Error) => void;
}

/**
 * Handle tool-not-found errors
 * Returns feedback message for AI to retry with correct tool
 */
function handleToolNotFoundError(
    errorMessage: string,
    tools: Record<string, any>,
    initialActiveTools?: string[]
): string | null {
    if (!errorMessage.includes('Model tried to call unavailable tool') &&
        !errorMessage.includes('unavailable tool') &&
        !errorMessage.includes('AI_NoSuchToolError')) {
        return null;
    }

    log.warn('🔧 TOOL NOT FOUND - Providing feedback to AI:', { errorMessage });

    // Extract tool name from error message
    const toolNameMatch = errorMessage.match(/tool ['"]([^'"]+)['"]/);
    const attemptedTool = toolNameMatch ? toolNameMatch[1] : 'unknown';

    // Get available tool names
    const availableTools = initialActiveTools || Object.keys(tools);

    // Check if we're in adaptive mode
    const isAdaptiveMode = availableTools.includes('executeTools') &&
        availableTools.includes('discoverTools') &&
        availableTools.length < 10;

    if (isAdaptiveMode) {
        log.info('📝 Sending adaptive-mode feedback to AI:', { attemptedTool, isAdaptiveMode: true });
        return `**Adaptive Mode Notice**\n\n` +
            `You tried to call "${attemptedTool}" directly, but in Adaptive mode you cannot call tools directly.\n\n` +
            `**In Adaptive Mode, follow this workflow:**\n` +
            `1. First use \`discoverTools\` to find available tools for your task\n` +
            `2. Then use \`executeTools\` to execute the discovered tool with the required parameters\n\n` +
            `**Your current pre-loaded tools (can call directly):** ${availableTools.join(', ')}`;
    }

    log.info('📝 Sending tool-not-found feedback to AI:', { attemptedTool, availableToolsCount: availableTools.length });
    return `Tool "${attemptedTool}" is not available.\n\n` +
        `**Available tools:** ${availableTools.slice(0, 15).join(', ')}${availableTools.length > 15 ? ', ...' : ''}\n\n` +
        `Please choose from the available tools and try again. Make sure the tool name is spelled correctly.`;
}

/**
 * Handle invalid tool arguments errors (Zod validation failed)
 * Returns feedback message for AI to fix parameters
 */
function handleInvalidArgumentsError(errorMessage: string): string | null {
    if (!errorMessage.includes('Invalid input for tool') &&
        !errorMessage.includes('Type validation failed') &&
        !errorMessage.includes('invalid_type')) {
        return null;
    }

    log.warn('🔧 INVALID TOOL ARGUMENTS - Providing feedback to AI:', { errorMessage });

    // Extract tool name
    const toolNameMatch = errorMessage.match(/Invalid input for tool ([^:]+):/);
    const attemptedTool = toolNameMatch?.[1]?.trim() ?? 'unknown';

    // Parse validation details
    let validationDetails = '';
    try {
        const jsonMatch = errorMessage.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            const errors = JSON.parse(jsonMatch[0]);
            if (Array.isArray(errors)) {
                validationDetails = errors.map((err: any) =>
                    `- Parameter "${err.path?.join('.')}" : expected ${err.expected}, received ${err.received || 'invalid value'}`
                ).join('\n');
            }
        }
    } catch {
        validationDetails = errorMessage;
    }

    log.info('📝 Sending invalid-arguments feedback to AI:', { attemptedTool, validationDetails });

    return `Invalid arguments for tool "${attemptedTool}".\n\n` +
        `**Validation errors:**\n${validationDetails || 'Check parameter types'}\n\n` +
        `Please fix the parameter types and try again. Make sure:\n` +
        `- String parameters are quoted strings (e.g., "5" not 5)\n` +
        `- Number parameters are unquoted numbers (e.g., 5 not "5")\n` +
        `- Boolean parameters are true/false (not "true"/"false")\n` +
        `- Array parameters are proper arrays (e.g., ["a", "b"])`;
}

/**
 * Handle empty response errors
 * Returns feedback message to prompt AI for actual response
 */
function handleEmptyResponseError(error: unknown, errorMessage: string, errorName: string): string | null {
    if (!isEmptyResponseError(error) &&
        !errorMessage.includes('empty response') &&
        errorName !== 'EmptyResponseError') {
        return null;
    }

    const emptyError = error as EmptyResponseError;
    const attemptCount = emptyError?.consecutiveCount || 1;

    log.warn('🔄 EMPTY RESPONSE - Providing feedback to AI:', { attemptCount });

    const feedback = emptyError?.getFeedbackMessage?.() ||
        `Your previous response was empty. Please provide a complete response to the user's request. ` +
        `Make sure to either answer with text or use an appropriate tool.`;

    log.info('📝 Sending empty response feedback to AI:', { attemptCount, feedbackLength: feedback.length });

    return feedback;
}

/**
 * Create the onError callback for UI message stream
 */
export function createOnErrorCallback(context: OnErrorContext) {
    const { writer, provider, tools, initialActiveTools, onError } = context;

    return (error: unknown) => {
        // Clone error properties BEFORE logging to avoid frozen object mutation
        const safeError = error instanceof Error
            ? { message: error.message, name: error.name, stack: error.stack }
            : (typeof error === 'object' && error !== null
                ? { ...error }
                : { message: String(error) });

        log.error('🔥 AI stream onError callback - RAW ERROR:', {
            error: safeError,
            errorType: typeof error,
            errorConstructor: (error as any)?.constructor?.name,
            isErrorInstance: error instanceof Error,
        });

        // Safely extract error properties
        const errorObj = error as any;
        const errorMessage = errorObj?.message || (error ? String(error) : 'Unknown error');
        const errorName = errorObj?.name || 'UnknownError';
        const errorStack = errorObj?.stack || 'No stack trace available';

        // Try specialized error handlers first
        const toolNotFoundFeedback = handleToolNotFoundError(errorMessage, tools, initialActiveTools);
        if (toolNotFoundFeedback) return toolNotFoundFeedback;

        const invalidArgsFeedback = handleInvalidArgumentsError(errorMessage);
        if (invalidArgsFeedback) return invalidArgsFeedback;

        const emptyResponseFeedback = handleEmptyResponseError(error, errorMessage, errorName);
        if (emptyResponseFeedback) return emptyResponseFeedback;

        // Generic error handling
        log.error('AI stream onError callback - PARSED', {
            errorName,
            errorMessage,
            fullStack: errorStack,
            hasText: 'text' in errorObj,
            textValue: errorObj?.text,
            textType: typeof errorObj?.text
        });

        try {
            const enhancedError = parseProviderError(error, provider);

            log.info('✓ Error parsed successfully', {
                provider,
                enhancedErrorCode: enhancedError.errorCode,
                enhancedMessage: enhancedError.message,
                enhancedUserMessage: enhancedError.userMessage
            });

            writeErrorToStream(writer, enhancedError, 'Stream processing');
            onError?.(error instanceof Error ? error : new Error(errorMessage));

            return `❌ Error: ${enhancedError.userMessage}`;
        } catch (parseError) {
            log.error('❌ CRITICAL: Failed to parse error in onError callback', {
                parseError,
                parseErrorMessage: parseError instanceof Error ? parseError.message : String(parseError),
                parseErrorStack: parseError instanceof Error ? parseError.stack : 'No stack',
                originalError: error
            });

            const fallbackMessage = `Error processing AI response: ${errorMessage}`;

            writer.write({
                type: 'text-delta',
                id: 'error-msg-' + generateId(),
                delta: `⚠️ ${fallbackMessage}\n`,
            });

            onError?.(new Error(fallbackMessage));

            return `❌ ${fallbackMessage}`;
        }
    };
}
