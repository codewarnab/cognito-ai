/**
 * Polyfill for worker_threads
 * Exporting stubs to prevent runtime errors in browser environment
 */

export const Worker = class {
    constructor() {
        throw new Error('worker_threads.Worker is not supported in the browser');
    }
};

export const isMainThread = true;

export const parentPort = null;

export const workerData = null;

export default {
    Worker,
    isMainThread,
    parentPort,
    workerData
};
