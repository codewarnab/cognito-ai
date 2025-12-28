/**
 * Stream onFinish Handler
 * Handles stream completion, usage tracking, and notifications
 */

import { generateId } from 'ai';
import { createLogger } from '~logger';

import { type AppUsage, getContextLimits } from '../../../types/usage';

const log = createLogger('AI-StreamFinish', 'AI_CHAT');

interface OnFinishContext {
    /** Writer for the UI message stream */
    writer: any;
    /** Stream result object */
    result: any;
    /** Model configuration */
    modelConfig: { remoteModel?: string };
    /** Effective mode (local or remote) */
    effectiveMode: 'local' | 'remote';
    /** Optional usage update callback */
    onUsageUpdate?: (usage: AppUsage) => void;
    /** Optional finish callback for notifications */
    onFinishCallback?: () => void;
}

/**
 * Create the onFinish callback for UI message stream
 */
export function createOnFinishCallback(context: OnFinishContext) {
    const { writer, result, modelConfig, effectiveMode, onFinishCallback } = context;

    return async ({ messages: finalMessages }: { messages: any[] }) => {
        log.info('UI stream completed', { messageCount: finalMessages.length });

        // Attach usage data to the final assistant message (remote mode only)
        if (finalMessages && finalMessages.length > 0 && effectiveMode === 'remote') {
            const finalUsage = await result.usage;

            if (finalUsage) {
                const lastAssistantMsg = finalMessages
                    .slice()
                    .reverse()
                    .find((msg: any) => msg.role === 'assistant');

                if (lastAssistantMsg) {
                    const modelName = modelConfig.remoteModel || 'gemini-3-flash-preview';
                    const contextLimits = getContextLimits(modelName);

                    const appUsage: AppUsage = {
                        ...finalUsage,
                        context: contextLimits,
                        modelId: modelName
                    };

                    // Handle case where message object might be frozen
                    try {
                        (lastAssistantMsg as any).usage = appUsage;
                    } catch (error) {
                        log.warn('Could not attach usage to message (likely frozen)', error);
                    }

                    log.info('✓ Attached final usage to message', {
                        messageId: lastAssistantMsg.id,
                        usage: appUsage
                    });
                }
            }
        }

        // Send completion status
        writer.write({
            type: 'data-status',
            id: 'status-' + generateId(),
            data: { status: 'completed', timestamp: Date.now() },
            transient: true,
        });

        // Call finish callback (for notification sound, etc.)
        if (onFinishCallback) {
            log.info('🔔 Calling onFinishCallback for AI completion notification');
            onFinishCallback();
        }

        // MCP connections are persistent - no cleanup needed
        log.info('✓ MCP tools remain available for next chat');
    };
}
