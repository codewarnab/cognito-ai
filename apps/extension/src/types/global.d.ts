/**
 * Global type augmentations and ambient declarations
 * 
 * Note: Asset module declarations (*.svg, *.png, *.jpg, etc.) are in assets.d.ts
 */

// Extend global Window interface if needed
declare global {
    interface Window {
        // Add custom global properties here if needed
        chrome: typeof chrome;
    }
}

// Module augmentations (non-asset types only)
declare module '*.css' {
    const content: Record<string, string>;
    export default content;
}

declare module '*.json' {
    const content: Record<string, any>;
    export default content;
}

export { };
