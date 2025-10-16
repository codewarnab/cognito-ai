export async function waitForNavigation(
    tabId: number,
    strategy: 'load' | 'networkidle',
    timeoutMs: number = 30000
): Promise<void> {
    return new Promise((resolve, reject) => {
        let settled = false;
        let idleTimer: number | undefined;

        const cleanup = () => {
            if (settled) return;
            settled = true;
            try { chrome.tabs.onUpdated.removeListener(onUpdated as any); } catch { }
            try { chrome.tabs.onRemoved.removeListener(onRemoved as any); } catch { }
            if (timeoutHandle) clearTimeout(timeoutHandle);
            if (idleTimer) clearTimeout(idleTimer as any);
        };

        const resolveAndClean = () => {
            cleanup();
            resolve();
        };

        const rejectAndClean = (error: Error) => {
            cleanup();
            reject(error);
        };

        const onRemoved = (removedTabId: number) => {
            if (removedTabId === tabId) {
                rejectAndClean(new Error('Navigation aborted: tab was closed'));
            }
        };

        const onUpdated = (
            updatedTabId: number,
            changeInfo: chrome.tabs.TabChangeInfo,
            _tab?: chrome.tabs.Tab
        ) => {
            if (updatedTabId !== tabId) return;

            if (changeInfo.status === 'complete') {
                if (strategy === 'networkidle') {
                    if (idleTimer) clearTimeout(idleTimer as any);
                    // Approximate network idle with a short quiet period after load completes
                    idleTimer = setTimeout(() => {
                        resolveAndClean();
                    }, 1000) as unknown as number;
                } else {
                    resolveAndClean();
                }
            }
        };

        const timeoutHandle = setTimeout(() => {
            rejectAndClean(new Error('Navigation timed out'));
        }, Math.max(0, timeoutMs)) as unknown as number;

        chrome.tabs.onUpdated.addListener(onUpdated as any);
        chrome.tabs.onRemoved.addListener(onRemoved as any);
    });
}
