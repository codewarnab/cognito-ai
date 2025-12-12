/**
 * Polyfill for child_process
 * Exporting stubs to prevent runtime errors in browser environment
 */

export const spawn = () => {
    throw new Error('child_process.spawn is not supported in the browser');
};

export const exec = () => {
    throw new Error('child_process.exec is not supported in the browser');
};

export const execSync = () => {
    throw new Error('child_process.execSync is not supported in the browser');
};

export const fork = () => {
    throw new Error('child_process.fork is not supported in the browser');
};

export default {
    spawn,
    exec,
    execSync,
    fork
};
