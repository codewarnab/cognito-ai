// Global process polyfill - loaded before any other code
(function () {
    if (typeof globalThis !== 'undefined' && !globalThis.process) {
        globalThis.process = {
            env: {},
            stdout: {
                isTTY: false,
                write: () => true,
                columns: 80,
                getColorDepth: () => 1
            },
            stderr: {
                isTTY: false,
                write: () => true,
                columns: 80,
                getColorDepth: () => 1
            },
            stdin: {
                isTTY: false
            },
            version: 'v16.0.0',
            versions: {},
            platform: 'linux',
            argv: [],
            execPath: '',
            cwd: () => '/',
            nextTick: (fn, ...args) => {
                Promise.resolve().then(() => fn(...args));
            },
            exit: () => {
                throw new Error('process.exit is not supported in browser');
            },
            browser: true
        };
    }

    // Also set on window for compatibility
    if (typeof window !== 'undefined' && !window.process) {
        window.process = globalThis.process;
    }
})();
