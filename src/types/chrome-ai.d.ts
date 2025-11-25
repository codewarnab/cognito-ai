/**
 * TypeScript declarations for Chrome's Built-in AI APIs
 * https://developer.chrome.com/docs/ai/built-in
 */

declare global {
    interface Window {
        /**
         * Chrome's Language Model API for on-device AI inference
         */
        LanguageModel?: {
            /**
             * Check the availability of the language model
             */
            availability: () => Promise<'available' | 'readily' | 'downloading' | 'no' | 'downloaded' | undefined>

            /**
             * Create a new language model session
             */
            create: (options?: {
                topK?: number
                temperature?: number
                signal?: AbortSignal
                systemInstruction?: string
            }) => Promise<{
                /**
                 * Generate a response from the model
                 */
                prompt: (text: string, options?: {
                    signal?: AbortSignal
                    responseConstraint?: any
                }) => Promise<string>

                /**
                 * Generate a streaming response from the model
                 */
                promptStreaming: (text: string, options?: { signal?: AbortSignal }) => ReadableStream<string>

                /**
                 * Destroy the session and free resources
                 */
                destroy: () => void
            }>
        }
    }
}

export { };
