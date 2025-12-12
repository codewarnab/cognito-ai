/**
 * Polyfill for tls
 * Exporting stubs to prevent runtime errors in browser environment
 */

export const connect = () => {
    throw new Error('tls.connect is not supported in the browser');
};

export const createServer = () => {
    throw new Error('tls.createServer is not supported in the browser');
};

export default {
    connect,
    createServer
};
