/**
* Scheduler - Main processing loop
*/

import { isModelReady } from './model-ready';
import { isPaused } from './settings';
import { dequeueBatch, markSuccess, markFailure } from './queue';
import { ensureOffscreen, closeOffscreenIfIdle } from './offscreen-lifecycle';
import { isHostBlocked } from '../db/index';
import {
    getProcessingStatus as getProcessingStatusFromState,
    isUrlBeingProcessed,
    isSchedulerProcessing,
    setCurrentBatch,
    setProcessing
} from './processing-state';
import type { BgMsgToOffscreen, OffscreenMsgToBg, BgQueueRecord } from './types';
import { isWipeInProgress } from './privacy';

// Processing configuration
const PROCESS_BATCH_SIZE = 8;
const PROCESS_BATCH_SIZE_IDLE = 24;
const PROCESS_TIME_BUDGET_MS = 250;

/**
 * Get current processing status
 */
export function getProcessingStatus() {
    return getProcessingStatusFromState();
}

/**
 * Check if a URL is currently being processed
 * Re-export from processing-state for backward compatibility
 */
export { isUrlBeingProcessed };

/**
 * Check if scheduler is currently processing
 * Re-export from processing-state for backward compatibility
 */
export { isSchedulerProcessing };

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
    if (isSchedulerProcessing()) {
        console.log('[Scheduler] Already processing, skipping tick');
        return;
    }

    // Check if wipe is in progress
    if (isWipeInProgress()) {
        console.log('[Scheduler] Wipe in progress, skipping tick');
        return;
    }

    try {
        setProcessing(true);
        const startTime = Date.now();

        // Check gates
        if (await isPaused()) {
            console.log('[Scheduler] Processing paused');
            setCurrentBatch([]);
            return;
        }

        if (!(await isModelReady())) {
            console.log('[Scheduler] Model not ready');
            setCurrentBatch([]);
            return;
        }

        // Ensure offscreen is available
        await ensureOffscreen();

        // Verify offscreen is actually ready before proceeding
        console.log('[Scheduler] Verifying offscreen is ready...');
        let offscreenReady = false;
        let readyCheckAttempts = 0;
        const maxReadyChecks = 3;

        while (!offscreenReady && readyCheckAttempts < maxReadyChecks) {
            try {
                const pingResponse = await chrome.runtime.sendMessage({ type: 'Ping' });
                if (pingResponse?.ok) {
                    console.log('[Scheduler] ✓ Offscreen is ready');
                    offscreenReady = true;
                    break;
                }
            } catch (error) {
                readyCheckAttempts++;
                console.warn(`[Scheduler] Offscreen ready check ${readyCheckAttempts}/${maxReadyChecks} failed:`, error);

                if (readyCheckAttempts < maxReadyChecks) {
                    await new Promise(resolve => setTimeout(resolve, 300 * readyCheckAttempts));
                    console.log(`[Scheduler] Re-ensuring offscreen after failed ready check...`);
                    await ensureOffscreen();
                }
            }
        }

        if (!offscreenReady) {
            console.error('[Scheduler] ✗✗✗ Failed to ensure offscreen is ready after retries ✗✗✗');
            setCurrentBatch([]);
            return;
        }

        // Dequeue batch
        const batchSize = getBatchSize();
        console.log(`[Scheduler] Requesting batch of ${batchSize} jobs from queue`);
        const jobs = await dequeueBatch(Date.now(), batchSize);
        console.log(`[Scheduler] Dequeued ${jobs.length} jobs from queue`);
        console.log(`[Scheduler] Jobs array:`, jobs.map(j => ({
            id: j.id,
            url: j.url,
            title: j.title?.substring(0, 50)
        })));

        if (jobs.length === 0) {
            console.log('[Scheduler] No jobs to process');
            setCurrentBatch([]);
            await closeOffscreenIfIdle();
            return;
        }

        // Filter jobs by privacy settings
        const settings = await chrome.storage.local.get(['paused', 'domainAllowlist', 'domainDenylist']);
        console.log(`[Scheduler] Privacy settings:`, {
            hasAllowlist: !!settings.domainAllowlist?.length,
            hasDenylist: !!settings.domainDenylist?.length
        });

        const filteredJobs = jobs.filter(job => !isHostBlocked(job.url, settings));
        console.log(`[Scheduler] After privacy filter: ${filteredJobs.length}/${jobs.length} jobs allowed`);

        if (jobs.length !== filteredJobs.length) {
            const blockedJobs = jobs.filter(job => isHostBlocked(job.url, settings));
            console.log(`[Scheduler] Blocked ${blockedJobs.length} jobs:`,
                blockedJobs.map(j => ({ id: j.id, url: j.url })));
        }

        if (filteredJobs.length === 0) {
            console.log('[Scheduler] All jobs blocked by privacy settings');
            setCurrentBatch([]);
            // Mark blocked jobs as done (skip them)
            for (const job of jobs) {
                await markSuccess(job.id);
            }
            await closeOffscreenIfIdle();
            return;
        }

        // Update current batch
        const currentBatch = filteredJobs.map(job => ({ url: job.url, title: job.title }));
        setCurrentBatch(currentBatch);
        console.log(`[Scheduler] Current batch set:`, currentBatch);

        console.log(`[Scheduler] Processing ${filteredJobs.length} jobs (${jobs.length - filteredJobs.length} blocked)`);

        // Send batch to offscreen with retry mechanism
        let response: any = null;
        let retries = 0;
        const maxRetries = 2; // Reduced since we now verify readiness upfront
        const retryDelay = 150;

        console.log(`[Scheduler] Preparing to send batch to offscreen. Retry config: max=${maxRetries}, delay=${retryDelay}ms`);

        while (retries < maxRetries) {
            try {
                console.log(`[Scheduler] Attempt ${retries + 1}/${maxRetries}: Sending message to offscreen`);

                // Check if offscreen exists and is ready
                if (!chrome.runtime.lastError) {
                    const jobsPayload = filteredJobs.map((job) => ({
                        url: job.url,
                        title: job.title,
                        description: job.description,
                        payload: job.payload,
                    }));

                    const message = {
                        type: 'ProcessBatch',
                        jobs: jobsPayload,
                    } as BgMsgToOffscreen;

                    console.log(`[Scheduler] Message payload: ${jobsPayload.length} jobs`,
                        jobsPayload.map(j => ({ url: j.url, title: j.title?.substring(0, 30) })));

                    response = await chrome.runtime.sendMessage(message);

                    // If we got a response, break out of retry loop
                    if (response) {
                        console.log(`[Scheduler] ✓ Received response from offscreen:`, {
                            type: response.type,
                            ok: response.ok,
                            hasResults: 'results' in response,
                            hasErrors: 'errors' in response
                        });
                        break;
                    } else {
                        console.warn(`[Scheduler] ✗ Received null/undefined response from offscreen`);
                    }
                } else {
                    console.warn(`[Scheduler] chrome.runtime.lastError detected:`, chrome.runtime.lastError);
                }
            } catch (error: any) {
                const errorMsg = error?.message || String(error);
                console.error(`[Scheduler] ✗ Error on attempt ${retries + 1}:`, errorMsg);

                if (errorMsg.includes('Could not establish connection') ||
                    errorMsg.includes('Receiving end does not exist')) {
                    retries++;

                    if (retries < maxRetries) {
                        console.log(`[Scheduler] Connection error on attempt ${retries}/${maxRetries}`);
                        console.log(`[Scheduler] Error message: ${errorMsg}`);
                        console.log(`[Scheduler] Waiting before retry...`);

                        const waitTime = retryDelay * (retries + 1);
                        console.log(`[Scheduler] Waiting ${waitTime}ms before retry...`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        console.log(`[Scheduler] Wait complete, verifying offscreen is ready...`);

                        try {
                            // Do a quick ping check before retrying
                            const pingResponse = await chrome.runtime.sendMessage({ type: 'Ping' });
                            if (pingResponse?.ok) {
                                console.log(`[Scheduler] ✓ Offscreen verified ready for retry ${retries + 1}/${maxRetries}`);
                            } else {
                                console.warn(`[Scheduler] ✗ Offscreen ping check failed before retry`);
                                await ensureOffscreen();
                            }
                        } catch (pingError) {
                            console.error(`[Scheduler] ✗ Failed to ping offscreen before retry:`, pingError);
                            console.log(`[Scheduler] Re-ensuring offscreen before retry...`);
                            await ensureOffscreen();
                        }
                    } else {
                        console.error(`[Scheduler] ✗✗✗ Max retries (${maxRetries}) reached ✗✗✗`);
                        console.error(`[Scheduler] Final error message: ${errorMsg}`);
                        console.error(`[Scheduler] Marking ${filteredJobs.length} jobs as failed (retriable)`);
                        console.error(`[Scheduler] Failed job IDs and URLs:`,
                            filteredJobs.map(j => ({ id: j.id, url: j.url })));

                        // Mark all jobs as retriable failures
                        for (const job of filteredJobs) {
                            console.log(`[Scheduler] Marking job ${job.id} (${job.url}) as failed`);
                            try {
                                await markFailure(job.id, errorMsg, true);
                                console.log(`[Scheduler] ✓ Job ${job.id} marked as failed`);
                            } catch (markError) {
                                console.error(`[Scheduler] ✗ Failed to mark job ${job.id} as failed:`, markError);
                            }
                        }

                        console.error(`[Scheduler] Exiting scheduler tick due to connection failures`);
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
        console.log(`[Scheduler] Processing response...`);
        if (response && typeof response === 'object') {
            const result = response as OffscreenMsgToBg;
            console.log(`[Scheduler] Response type: ${result.type}, ok: ${'ok' in result ? (result as any).ok : 'N/A'}`);

            if (result.type === 'BatchResult') {
                if ('ok' in result && result.ok && 'results' in result) {
                    console.log(`[Scheduler] ✓ Batch successful: ${result.results.length} results`);
                    console.log(`[Scheduler] Success results:`,
                        result.results.map(r => ({ url: r.url, id: r.id })));

                    // Mark all as success
                    for (const jobResult of result.results) {
                        const job = filteredJobs.find((j) => j.url === jobResult.url);
                        if (job) {
                            console.log(`[Scheduler] Marking job ${job.id} (${job.url}) as success`);
                            await markSuccess(job.id);
                        } else {
                            console.warn(`[Scheduler] Could not find job for URL: ${jobResult.url}`);
                        }
                    }
                } else if ('ok' in result && !result.ok && 'errors' in result) {
                    console.error(`[Scheduler] ✗ Batch failed: ${result.errors.length} errors`);
                    console.error(`[Scheduler] Error details:`,
                        result.errors.map(e => ({ url: e.url, message: e.message })));

                    // Mark all as failure
                    for (const error of result.errors) {
                        const job = filteredJobs.find((j) => j.url === error.url);
                        if (job) {
                            const isRetriable = !error.message.includes('non-retriable');
                            console.log(`[Scheduler] Marking job ${job.id} (${job.url}) as failure (retriable: ${isRetriable})`);
                            await markFailure(job.id, error.message, isRetriable);
                        } else {
                            console.warn(`[Scheduler] Could not find job for error URL: ${error.url}`);
                        }
                    }
                }
            } else {
                console.warn(`[Scheduler] Unexpected response type: ${result.type}`);
            }
        } else if (!response) {
            console.warn('[Scheduler] ✗ No response received from offscreen, marking jobs for retry');
            console.warn(`[Scheduler] Affected jobs (${filteredJobs.length}):`,
                filteredJobs.map(j => ({ id: j.id, url: j.url })));

            // Mark all jobs as retriable failures if no response
            for (const job of filteredJobs) {
                console.log(`[Scheduler] Marking job ${job.id} as failed (no response)`);
                await markFailure(job.id, 'No response from offscreen', true);
            }
        }

        const elapsed = Date.now() - startTime;
        console.log(`[Scheduler] Tick completed in ${elapsed}ms`);

        // Clear current batch
        setCurrentBatch([]);

        // Check if we should continue processing (respect time budget)
        if (elapsed < PROCESS_TIME_BUDGET_MS && jobs.length === batchSize) {
            // More work might be available, schedule another tick soon
            setTimeout(() => runSchedulerTick(), 100);
        }
    } catch (error) {
        console.error('[Scheduler] Tick error:', error);
        setCurrentBatch([]);
    } finally {
        setProcessing(false);
    }
}
