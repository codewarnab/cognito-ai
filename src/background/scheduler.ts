/**
 * Scheduler - Main processing loop
 */

import { isModelReady } from './model-ready';
import { isPaused } from './settings';
import { dequeueBatch, markSuccess, markFailure } from './queue';
import { ensureOffscreen, closeOffscreenIfIdle } from './offscreen-lifecycle';
import { isHostBlocked } from '../db/index';
import type { BgMsgToOffscreen, OffscreenMsgToBg, BgQueueRecord } from './types';
import { isWipeInProgress } from './privacy';

// Processing configuration
const PROCESS_BATCH_SIZE = 8;
const PROCESS_BATCH_SIZE_IDLE = 24;
const PROCESS_TIME_BUDGET_MS = 250;

let isProcessing = false;

/**
 * Get batch size based on system state
 */
function getBatchSize(): number {
    // TODO: Check if idle (if API available)
    return PROCESS_BATCH_SIZE;
}

/**
 * Run scheduler tick - main processing loop
 */
export async function runSchedulerTick(): Promise<void> {
    // Prevent concurrent processing
    if (isProcessing) {
        console.log('[Scheduler] Already processing, skipping tick');
        return;
    }

    // Check if wipe is in progress
    if (isWipeInProgress()) {
        console.log('[Scheduler] Wipe in progress, skipping tick');
        return;
    }

    try {
        isProcessing = true;
        const startTime = Date.now();

        // Check gates
        if (await isPaused()) {
            console.log('[Scheduler] Processing paused');
            return;
        }

        if (!(await isModelReady())) {
            console.log('[Scheduler] Model not ready');
            return;
        }

        // Ensure offscreen is available
        await ensureOffscreen();

        // Dequeue batch
        const batchSize = getBatchSize();
        const jobs = await dequeueBatch(Date.now(), batchSize);

        if (jobs.length === 0) {
            console.log('[Scheduler] No jobs to process');
            await closeOffscreenIfIdle();
            return;
        }

        // Filter jobs by privacy settings
        const settings = await chrome.storage.local.get(['paused', 'domainAllowlist', 'domainDenylist']);
        const filteredJobs = jobs.filter(job => !isHostBlocked(job.url, settings));

        if (filteredJobs.length === 0) {
            console.log('[Scheduler] All jobs blocked by privacy settings');
            // Mark blocked jobs as done (skip them)
            for (const job of jobs) {
                await markSuccess(job.id);
            }
            await closeOffscreenIfIdle();
            return;
        }

        console.log(`[Scheduler] Processing ${filteredJobs.length} jobs (${jobs.length - filteredJobs.length} blocked)`);

        // Send batch to offscreen with retry mechanism
        let response: any = null;
        let retries = 0;
        const maxRetries = 3;
        const retryDelay = 200;

        while (retries < maxRetries) {
            try {
                // Check if offscreen exists and is ready
                if (!chrome.runtime.lastError) {
                    response = await chrome.runtime.sendMessage({
                        type: 'ProcessBatch',
                        jobs: filteredJobs.map((job) => ({
                            url: job.url,
                            title: job.title,
                            description: job.description,
                            payload: job.payload,
                        })),
                    } as BgMsgToOffscreen);

                    // If we got a response, break out of retry loop
                    if (response) {
                        break;
                    }
                }
            } catch (error: any) {
                const errorMsg = error?.message || String(error);

                if (errorMsg.includes('Could not establish connection') ||
                    errorMsg.includes('Receiving end does not exist')) {
                    retries++;

                    if (retries < maxRetries) {
                        console.log(`[Scheduler] Connection error, retrying (${retries}/${maxRetries})...`);

                        // Re-ensure offscreen document before retry
                        await closeOffscreenIfIdle();
                        await new Promise(resolve => setTimeout(resolve, retryDelay * retries));
                        await ensureOffscreen();
                    } else {
                        console.error('[Scheduler] Max retries reached, marking jobs as failed');

                        // Mark all jobs as retriable failures
                        for (const job of filteredJobs) {
                            await markFailure(job.id, errorMsg, true);
                        }
                        return;
                    }
                } else {
                    // Non-connection error, don't retry
                    console.error('[Scheduler] Non-retriable error:', error);
                    throw error;
                }
            }
        }

        // Handle response
        if (response && typeof response === 'object') {
            const result = response as OffscreenMsgToBg;

            if (result.type === 'BatchResult') {
                if (result.ok && 'results' in result) {
                    // Mark all as success
                    for (const jobResult of result.results) {
                        const job = filteredJobs.find((j) => j.url === jobResult.url);
                        if (job) {
                            await markSuccess(job.id);
                        }
                    }
                } else if (!result.ok && 'errors' in result) {
                    // Mark all as failure
                    for (const error of result.errors) {
                        const job = filteredJobs.find((j) => j.url === error.url);
                        if (job) {
                            const isRetriable = !error.message.includes('non-retriable');
                            await markFailure(job.id, error.message, isRetriable);
                        }
                    }
                }
            }
        } else if (!response) {
            console.warn('[Scheduler] No response received from offscreen, marking jobs for retry');
            // Mark all jobs as retriable failures if no response
            for (const job of filteredJobs) {
                await markFailure(job.id, 'No response from offscreen', true);
            }
        }

        const elapsed = Date.now() - startTime;
        console.log(`[Scheduler] Tick completed in ${elapsed}ms`);

        // Check if we should continue processing (respect time budget)
        if (elapsed < PROCESS_TIME_BUDGET_MS && jobs.length === batchSize) {
            // More work might be available, schedule another tick soon
            setTimeout(() => runSchedulerTick(), 100);
        }
    } catch (error) {
        console.error('[Scheduler] Tick error:', error);
    } finally {
        isProcessing = false;
    }
}

/**
 * Check if scheduler is currently processing
 */
export function isSchedulerProcessing(): boolean {
    return isProcessing;
}
