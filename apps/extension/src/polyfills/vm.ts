/**
 * Polyfill for vm module
 * 
 * The default 'vm-browserify' polyfill uses 'eval' which violates Chrome Extension CSP (Manifest V3).
 * We export stubs here to satisfy build requirements without introducing security risks.
 */

export const runInContext = () => {
    throw new Error('vm.runInContext is not supported in the browser');
};

export const runInNewContext = () => {
    throw new Error('vm.runInNewContext is not supported in the browser');
};

export const runInThisContext = () => {
    throw new Error('vm.runInThisContext is not supported in the browser');
};

export const createContext = () => {
    return {};
};

export const isContext = () => false;

export class Script {
    constructor() {
        throw new Error('vm.Script is not supported in the browser');
    }
    runInContext() {
        throw new Error('vm.Script.runInContext is not supported in the browser');
    }
}

export default {
    runInContext,
    runInNewContext,
    runInThisContext,
    createContext,
    isContext,
    Script,
};
