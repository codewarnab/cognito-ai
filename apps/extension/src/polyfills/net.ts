/**
 * Net Polyfill for Browser Environment
 * 
 * Provides polyfills for Node.js 'net' module functions used by dependencies.
 * This is required because google-auth-library uses node-fetch which uses isIP from 'node:net'.
 * 
 * @see https://github.com/nodejs/node/blob/main/lib/internal/net.js
 */

/**
 * Regular expression to test if a string is a valid IPv4 address
 */
const IPv4Regex = /^(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)$/;

/**
 * Regular expression to test if a string is a valid IPv6 address
 * This is a simplified version that covers most common cases
 */
const IPv6Regex = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]+|::(ffff(:0{1,4})?:)?((25[0-5]|(2[0-4]|1?\d)?\d)\.){3}(25[0-5]|(2[0-4]|1?\d)?\d)|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1?\d)?\d)\.){3}(25[0-5]|(2[0-4]|1?\d)?\d))$/;

/**
 * Test if input is an IPv4 address
 * @param input - String to test
 * @returns true if valid IPv4 address
 */
export function isIPv4(input: string): boolean {
    return IPv4Regex.test(input);
}

/**
 * Test if input is an IPv6 address
 * @param input - String to test
 * @returns true if valid IPv6 address
 */
export function isIPv6(input: string): boolean {
    return IPv6Regex.test(input);
}

/**
 * Test if input is an IP address
 * Returns 0 if invalid, 4 if IPv4, 6 if IPv6
 * 
 * This is the function that node-fetch uses and was causing the build error:
 * `"isIP" is not exported by "...node-stdlib-browser/esm/mock/empty.js"`
 * 
 * @param input - String to test
 * @returns 0 if not an IP, 4 if IPv4, 6 if IPv6
 */
export function isIP(input: string): 0 | 4 | 6 {
    if (isIPv4(input)) {
        return 4;
    }
    if (isIPv6(input)) {
        return 6;
    }
    return 0;
}

// Stub implementations for other net functions that might be imported
// These are not fully implemented but prevent import errors

export class Socket {
    // Stub class - not implemented for browser
    constructor() {
        console.warn('[net polyfill] Socket is not implemented in browser environment');
    }
}

export class Server {
    // Stub class - not implemented for browser
    constructor() {
        console.warn('[net polyfill] Server is not implemented in browser environment');
    }
}

export function createServer(): Server {
    console.warn('[net polyfill] createServer is not implemented in browser environment');
    return new Server();
}

export function createConnection(): Socket {
    console.warn('[net polyfill] createConnection is not implemented in browser environment');
    return new Socket();
}

export function connect(): Socket {
    console.warn('[net polyfill] connect is not implemented in browser environment');
    return new Socket();
}

// Default export for module resolution
export default {
    isIP,
    isIPv4,
    isIPv6,
    Socket,
    Server,
    createServer,
    createConnection,
    connect,
};
