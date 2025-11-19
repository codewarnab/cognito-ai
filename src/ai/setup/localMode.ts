/**
 * Local Mode Setup
 * Handles Gemini Nano model initialization and downloads
 */

import { generateId } from 'ai';
import { builtInAI } from '@built-in-ai/core';
import { createLogger } from '~logger';
import { getToolsForMode } from '../tools/registry';
import { downloadLanguageModel, downloadSummarizer, type DownloadProgressEvent } from '../models/downloader';
import { BrowserAPIError, ErrorType } from '../../errors/errorTypes';
import { writeErrorToStream } from '../stream/streamHelpers';
import type { WorkflowDefinition } from '../../workflows/types';

const log = createLogger('LocalMode', 'AI_CHAT');

export interface LocalModeSetup {
    model: any;
    tools: Record<string, any>;
    systemPrompt: string;
}

/**
 * Setup local mode (Gemini Nano) with model downloads
 * @throws {BrowserAPIError} If storage is insufficient
 * @throws {Error} If model download fails
 */
export async function setupLocalMode(
    writer: any,
    workflowConfig: WorkflowDefinition | null,
    localSystemPrompt: string,
    onError?: (error: Error) => void
): Promise<LocalModeSetup> {
    log.info('🔧 Using LOCAL Gemini Nano');

    // Download Language Model with progress tracking
    try {
        await downloadLanguageModel((progress: DownloadProgressEvent) => {
            const percentage = Math.round(progress.loaded * 100);
            log.info(`📥 Language Model download: ${percentage}%`);

            // Send download progress status to UI (shown as toast)
            writer.write({
                type: 'data-status',
                id: 'language-model-download-' + generateId(),
                data: {
                    status: 'downloading',
                    model: 'language',
                    progress: percentage,
                    message: `Downloading Language Model... ${percentage}%`,
                    timestamp: Date.now(),
                },
                transient: true,
            });
        });

        log.info('✅ Language Model ready');
    } catch (error) {
        log.error('❌ Failed to download Language Model:', error);

        // Check if it's our storage error
        if (error instanceof BrowserAPIError &&
            error.errorCode === ErrorType.BROWSER_AI_MODEL_STORAGE_ERROR) {
            // Write storage error to chat stream
            writeErrorToStream(writer, error, 'Model download - insufficient storage');

            // Call onError callback to potentially show toast
            onError?.(error);

            // Throw the error instead of returning null
            // This ensures the error is properly propagated through the stream
            throw error;
        }

        // For other errors, wrap in generic error message
        throw new Error(`Language Model unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Download Summarizer Model with progress tracking
    try {
        await downloadSummarizer((progress: DownloadProgressEvent) => {
            const percentage = Math.round(progress.loaded * 100);
            log.info(`📥 Summarizer download: ${percentage}%`);

            // Send download progress status to UI (shown as toast)
            writer.write({
                type: 'data-status',
                id: 'summarizer-download-' + generateId(),
                data: {
                    status: 'downloading',
                    model: 'summarizer',
                    progress: percentage,
                    message: `Downloading Summarizer... ${percentage}%`,
                    timestamp: Date.now(),
                },
                transient: true,
            });
        });

        log.info('✅ Summarizer ready');
    } catch (error) {
        // Summarizer is optional, just log warning
        log.warn('⚠️ Summarizer unavailable:', error);
    }

    // Get local model using the downloaded language model session
    const model = builtInAI();

    // Get limited tool set (basic tools only) from tool registry
    const localTools = getToolsForMode('local');

    // In workflow mode, filter to only allowed tools
    let tools: Record<string, any>;
    if (workflowConfig) {
        tools = Object.fromEntries(
            Object.entries(localTools).filter(([name]) =>
                workflowConfig.allowedTools.includes(name)
            )
        );
        log.info('🔧 Filtered local tools for workflow:', {
            workflow: workflowConfig.name,
            allowed: workflowConfig.allowedTools,
            filtered: Object.keys(tools)
        });
    } else {
        tools = localTools;
    }

    log.info('🔧 Local tools available:', {
        count: Object.keys(tools).length,
        names: Object.keys(tools)
    });

    // Use local or workflow-specific prompt
    const systemPrompt = workflowConfig ? workflowConfig.systemPrompt : localSystemPrompt;

    return { model, tools, systemPrompt };
}

