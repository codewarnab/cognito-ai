// Stub for google-logging-utils to prevent browser incompatibility

export enum LogSeverity {
    DEFAULT = "DEFAULT",
    DEBUG = "DEBUG",
    INFO = "INFO",
    WARNING = "WARNING",
    ERROR = "ERROR"
}

// Create a no-op logger function that matches the AdhocDebugLogFunction interface
const createLogFunction = (namespace: string): any => {
    const logFunc = (_fields: any, ..._args: unknown[]) => {
        // No-op in browser environment
    };

    // Add the required methods
    logFunc.instance = {
        namespace,
        on: () => logFunc,
        invoke: () => { },
        invokeSeverity: () => { }
    } as any;

    logFunc.on = () => logFunc;
    logFunc.debug = (..._args: unknown[]) => { };
    logFunc.info = (..._args: unknown[]) => { };
    logFunc.warn = (..._args: unknown[]) => { };
    logFunc.error = (..._args: unknown[]) => { };
    logFunc.sublog = (ns: string) => createLogFunction(`${namespace}:${ns}`);

    return logFunc;
};

// Main log function export
export function log(namespace: string, _parent?: any): any {
    return createLogFunction(namespace);
}

// Placeholder logger
export const placeholder = createLogFunction('placeholder');

// Backend functions (all no-ops for browser)
export function setBackend(_backend: any): void {
    // No-op
}

export function getNodeBackend(): any {
    return null;
}

export function getDebugBackend(_debugPkg: any): any {
    return null;
}

export function getStructuredBackend(_upstream?: any): any {
    return null;
}

export const env = {
    nodeEnables: ''
};
