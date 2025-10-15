import { createLogger } from "../logger";

const log = createLogger("Actions-Downloads");

export interface StartDownloadOptions {
    filename?: string;
    saveAs?: boolean;
}

export interface StartDownloadResult {
    success: boolean;
    downloadId?: number;
    error?: string;
}

export interface TrackDownloadResult {
    success: boolean;
    state?: 'in_progress' | 'complete' | 'interrupted';
    filePath?: string;
    error?: string;
}

export interface MoveToArtifactsOptions {
    artifactKey?: string;
}

export interface MoveToArtifactsResult {
    success: boolean;
    artifactId?: string;
    error?: string;
}

// Store download listeners
const downloadListeners = new Map<number, (delta: chrome.downloads.DownloadDelta) => void>();

/**
 * Start a download
 */
export async function startDownload(
    url: string,
    options: StartDownloadOptions = {}
): Promise<StartDownloadResult> {
    const { filename, saveAs = false } = options;

    try {
        log.info("startDownload", { url, filename, saveAs });

        const downloadId = await chrome.downloads.download({
            url,
            filename,
            saveAs,
        });

        return { success: true, downloadId };
    } catch (error) {
        log.error("Error starting download:", error);
        return {
            success: false,
            error: `Failed to start download: ${(error as Error).message}`,
        };
    }
}

/**
 * Track download progress and wait for completion
 */
export async function trackDownload(
    downloadId: number,
    timeoutMs: number = 60000
): Promise<TrackDownloadResult> {
    try {
        log.info("trackDownload", { downloadId, timeoutMs });

        // Check current state
        const downloads = await chrome.downloads.search({ id: downloadId });
        if (downloads.length === 0) {
            return { success: false, error: "Download not found" };
        }

        const download = downloads[0];

        // If already complete, return immediately
        if (download.state === 'complete') {
            return {
                success: true,
                state: 'complete',
                filePath: download.filename,
            };
        }

        // If interrupted, return error
        if (download.state === 'interrupted') {
            return {
                success: false,
                state: 'interrupted',
                error: `Download interrupted: ${download.error}`,
            };
        }

        // Wait for completion or timeout
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                cleanup();
                resolve({
                    success: false,
                    state: 'in_progress',
                    error: "Download tracking timed out",
                });
            }, timeoutMs);

            const listener = (delta: chrome.downloads.DownloadDelta) => {
                if (delta.id !== downloadId) return;

                if (delta.state && delta.state.current === 'complete') {
                    cleanup();
                    chrome.downloads.search({ id: downloadId }).then((downloads) => {
                        resolve({
                            success: true,
                            state: 'complete',
                            filePath: downloads[0]?.filename,
                        });
                    });
                }

                if (delta.state && delta.state.current === 'interrupted') {
                    cleanup();
                    chrome.downloads.search({ id: downloadId }).then((downloads) => {
                        resolve({
                            success: false,
                            state: 'interrupted',
                            error: `Download interrupted: ${downloads[0]?.error}`,
                        });
                    });
                }
            };

            const cleanup = () => {
                clearTimeout(timeout);
                chrome.downloads.onChanged.removeListener(listener);
                downloadListeners.delete(downloadId);
            };

            chrome.downloads.onChanged.addListener(listener);
            downloadListeners.set(downloadId, listener);
        });
    } catch (error) {
        log.error("Error tracking download:", error);
        return {
            success: false,
            error: `Failed to track download: ${(error as Error).message}`,
        };
    }
}

/**
 * Move downloaded file to artifacts directory
 * Note: This would require file system access and proper artifact management
 */
export async function moveToArtifacts(
    downloadIdOrPath: number | string,
    options: MoveToArtifactsOptions = {}
): Promise<MoveToArtifactsResult> {
    try {
        log.info("moveToArtifacts", { downloadIdOrPath, options });

        let filePath: string | undefined;

        if (typeof downloadIdOrPath === 'number') {
            const downloads = await chrome.downloads.search({ id: downloadIdOrPath });
            if (downloads.length === 0) {
                return { success: false, error: "Download not found" };
            }
            filePath = downloads[0].filename;
        } else {
            filePath = downloadIdOrPath;
        }

        if (!filePath) {
            return { success: false, error: "File path not available" };
        }

        // TODO: Implement actual file moving logic
        // This would require:
        // 1. File system access (potentially via Native Messaging or File System Access API)
        // 2. Artifact directory management
        // 3. Proper artifact ID generation

        log.warn("moveToArtifacts not fully implemented - requires file system access");

        // For now, return a placeholder artifact ID
        const artifactId = `artifact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        return {
            success: false,
            error: "moveToArtifacts not yet implemented - requires file system access integration",
        };

        /* Future implementation:
        // Move file to artifacts directory
        const artifactPath = path.join(artifactsDir, artifactId, path.basename(filePath));
        await fs.promises.mkdir(path.dirname(artifactPath), { recursive: true });
        await fs.promises.rename(filePath, artifactPath);
        
        return {
          success: true,
          artifactId,
        };
        */
    } catch (error) {
        log.error("Error moving to artifacts:", error);
        return {
            success: false,
            error: `Failed to move to artifacts: ${(error as Error).message}`,
        };
    }
}

/**
 * Clean up all download listeners
 */
export function cleanupDownloadListeners(): void {
    for (const [downloadId, listener] of downloadListeners.entries()) {
        chrome.downloads.onChanged.removeListener(listener);
    }
    downloadListeners.clear();
}
