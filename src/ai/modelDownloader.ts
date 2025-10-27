/**
 * Model Downloader Utility
 * Handles downloading Gemini Nano models (Language Model and Summarizer)
 * with progress tracking and toast notifications
 */

import { createLogger } from '../logger';
import { broadcastDownloadProgress } from '../utils/modelDownloadBroadcast';

const log = createLogger('ModelDownloader');

export interface DownloadProgressEvent {
    loaded: number; // Progress as a decimal (0.0 to 1.0)
    total?: number;
    modelType: 'language' | 'summarizer';
}

export interface DownloadProgressCallback {
    (progress: DownloadProgressEvent): void;
}

/**
 * Check if Language Model API is available
 */
export async function isLanguageModelAvailable(): Promise<boolean> {
    if (!('LanguageModel' in self)) {
        log.warn('LanguageModel API not available in this browser');
        return false;
    }
    return true;
}

/**
 * Check if Summarizer API is available
 */
export async function isSummarizerAvailable(): Promise<boolean> {
    if (!('Summarizer' in self)) {
        log.warn('Summarizer API not available in this browser');
        return false;
    }
    return true;
}

/**
 * Download Language Model with progress tracking
 * @param onProgress - Callback for download progress updates
 * @returns Language model session
 */
export async function downloadLanguageModel(
    onProgress?: DownloadProgressCallback
): Promise<any> {
    const isAvailable = await isLanguageModelAvailable();
    if (!isAvailable) {
        throw new Error('Language Model API is not available in this browser');
    }

    // @ts-ignore - Chrome built-in AI API
    const availability = await self.LanguageModel.availability();
    log.info('Language Model availability:', availability);

    if (availability === 'no') {
        throw new Error('Language Model is not available on this device');
    }

    if (availability === 'readily') {
        throw new Error('Language Model is supported but there is not enough disk space. Please free up some space.');
    }

    // Check if model is already available (no download needed)
    if (availability === 'available' || availability === undefined) {
        // Model already downloaded, create session without monitoring
        // @ts-ignore - Chrome built-in AI API
        const session = await (self.LanguageModel.create as any)();
        log.info('Language Model session created (already available)');
        return session;
    }

    // Model needs to be downloaded (downloadable or downloading state)
    log.info('Language Model needs to be downloaded, starting download...');

    // Broadcast initial status
    broadcastDownloadProgress({
        model: 'language',
        progress: 0,
        status: 'downloading',
        message: 'Starting Gemini Nano download...',
    });

    // Create session with download progress monitoring
    // Using any type to bypass TypeScript checks for Chrome's experimental monitor API
    // @ts-ignore - Chrome built-in AI API (monitor not in types yet)
    const session = await (self.LanguageModel.create as any)({
        monitor(m: any) {
            log.info('✅ Monitor callback registered for Language Model');

            m.addEventListener('downloadprogress', (e: any) => {
                const progress = e.loaded || 0;
                const percentage = Math.round(progress * 100);
                log.info(`Language Model download progress: ${percentage}%`);

                // Broadcast to UI via chrome.runtime messaging
                broadcastDownloadProgress({
                    model: 'language',
                    progress: percentage,
                    status: percentage >= 100 ? 'complete' : 'downloading',
                    message: `Downloading Gemini Nano... ${percentage}%`,
                });

                // Also call the callback if provided
                if (onProgress) {
                    onProgress({
                        loaded: progress,
                        modelType: 'language',
                    });
                }
            });
        },
    });

    // Broadcast completion
    broadcastDownloadProgress({
        model: 'language',
        progress: 100,
        status: 'complete',
        message: 'Gemini Nano ready!',
    });

    log.info('Language Model downloaded successfully');
    return session;
}

/**
 * Download Summarizer Model with progress tracking
 * @param onProgress - Callback for download progress updates
 * @returns Summarizer instance
 */
export async function downloadSummarizer(
    onProgress?: DownloadProgressCallback
): Promise<any> {
    const isAvailable = await isSummarizerAvailable();
    if (!isAvailable) {
        throw new Error('Summarizer API is not available in this browser');
    }

    // @ts-ignore - Chrome built-in AI API
    const availability = await self.Summarizer.availability();
    log.info('Summarizer availability:', availability);

    // Handle different availability states
    // Summarizer uses: 'unavailable' | 'downloadable' | 'downloading' | 'available'
    if (availability === 'unavailable') {
        throw new Error('Summarizer is not available on this device');
    }

    // If model needs to be downloaded or is downloading
    if (availability === 'downloadable' || availability === 'downloading') {
        log.info('Summarizer needs to be downloaded, starting download...');

        // Broadcast initial status
        broadcastDownloadProgress({
            model: 'summarizer',
            progress: 0,
            status: 'downloading',
            message: 'Starting Summarizer download...',
        });

        // Create summarizer with download progress monitoring
        // Using any type to bypass TypeScript checks for Chrome's experimental monitor API
        // @ts-ignore - Chrome built-in AI API
        const summarizer = await (self.Summarizer.create as any)({
            type: 'key-points',
            format: 'markdown',
            length: 'medium',
            monitor(m: any) {
                log.info('✅ Monitor callback registered for Summarizer');

                m.addEventListener('downloadprogress', (e: any) => {
                    const progress = e.loaded || 0;
                    const percentage = Math.round(progress * 100);
                    log.info(`Summarizer download progress: ${percentage}%`);

                    // Broadcast to UI via chrome.runtime messaging
                    broadcastDownloadProgress({
                        model: 'summarizer',
                        progress: percentage,
                        status: percentage >= 100 ? 'complete' : 'downloading',
                        message: `Downloading Summarizer... ${percentage}%`,
                    });

                    // Also call the callback if provided
                    if (onProgress) {
                        onProgress({
                            loaded: progress,
                            modelType: 'summarizer',
                        });
                    }
                });
            },
        });

        // Broadcast completion
        broadcastDownloadProgress({
            model: 'summarizer',
            progress: 100,
            status: 'complete',
            message: 'Summarizer ready!',
        });

        log.info('Summarizer downloaded successfully');
        return summarizer;
    }

    // Model already downloaded (available)
    // @ts-ignore - Chrome built-in AI API
    const summarizer = await (self.Summarizer.create as any)({
        type: 'key-points',
        format: 'markdown',
        length: 'medium',
    });
    log.info('Summarizer created (already available)');
    return summarizer;
}

/**
 * Download all required local models with progress tracking
 * @param onProgress - Callback for download progress updates
 * @returns Object containing both model instances
 */
export async function downloadAllModels(
    onProgress?: DownloadProgressCallback
): Promise<{
    languageModel: any;
    summarizer: any;
}> {
    log.info('Starting download of all local models...');

    // Download Language Model first
    const languageModel = await downloadLanguageModel(onProgress);

    // Then download Summarizer
    const summarizer = await downloadSummarizer(onProgress);

    log.info('All local models downloaded successfully');

    return {
        languageModel,
        summarizer,
    };
}

/**
 * Check if local models are already downloaded and ready
 */
export async function areModelsReady(): Promise<{
    languageModel: boolean;
    summarizer: boolean;
}> {
    const languageModelAvailable = await isLanguageModelAvailable();
    const summarizerAvailable = await isSummarizerAvailable();

    let languageModelReady = false;
    let summarizerReady = false;

    if (languageModelAvailable) {
        try {
            // @ts-ignore
            const availability = await self.LanguageModel.availability();
            // Model is ready if it's available or undefined (already downloaded)
            languageModelReady = availability === 'available' || availability === undefined;
        } catch (error) {
            log.error('Error checking Language Model availability:', error);
        }
    }

    if (summarizerAvailable) {
        try {
            // @ts-ignore
            const availability = await self.Summarizer.availability();
            // Model is ready if it's available or undefined (already downloaded)
            summarizerReady = availability === 'available' || availability === undefined;
        } catch (error) {
            log.error('Error checking Summarizer availability:', error);
        }
    }

    return {
        languageModel: languageModelReady,
        summarizer: summarizerReady,
    };
}
