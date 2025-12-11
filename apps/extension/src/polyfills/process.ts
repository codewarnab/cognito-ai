// Polyfill for process object in browser environment
// This must be loaded before any code that uses process

// Define on globalThis
if (typeof globalThis !== 'undefined' && !(globalThis as any).process) {
    (globalThis as any).process = {
        env: {} as any,
        stdout: {
            isTTY: false,
            write: () => true,
            columns: 80,
            getColorDepth: () => 1
        } as any,
        stderr: {
            isTTY: false,
            write: () => true,
            columns: 80,
            getColorDepth: () => 1
        } as any,
        stdin: {
            isTTY: false
        } as any,
        version: 'v16.0.0',
        versions: {} as any,
        platform: 'linux' as any,
        argv: [],
        execPath: '',
        cwd: () => '/',
        nextTick: (fn: Function, ...args: any[]) => {
            Promise.resolve().then(() => fn(...args));
        },
        exit: () => {
            throw new Error('process.exit is not supported in browser');
        },
        browser: true
    };
}

// Also define on window
if (typeof window !== 'undefined' && !(window as any).process) {
    (window as any).process = (globalThis as any).process;
}

// Also define as a module export for bundlers
const processPolyfill = (globalThis as any).process;
export default processPolyfill;
export { };
