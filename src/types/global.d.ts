/**
 * Global type augmentations and ambient declarations
 */

// Extend global Window interface if needed
declare global {
    interface Window {
        // Add custom global properties here if needed
        chrome: typeof chrome;
    }
}

// Module augmentations
declare module '*.css' {
    const content: Record<string, string>;
    export default content;
}

declare module '*.svg' {
    const content: string;
    export default content;
}

declare module '*.png' {
    const content: string;
    export default content;
}

declare module '*.jpg' {
    const content: string;
    export default content;
}

declare module '*.json' {
    const content: Record<string, any>;
    export default content;
}

export { };
