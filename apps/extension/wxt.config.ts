import { defineConfig } from 'wxt';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { resolve } from 'path';

export default defineConfig({
    // Use src/ directory for non-entrypoint code
    srcDir: 'src',

    // Output directory
    outDir: 'dist',

    // Target browsers
    browser: 'chrome',
    manifestVersion: 3,

    // Path aliases for TypeScript
    alias: {
        '~': resolve(__dirname, 'src'),
        '@': resolve(__dirname, 'src'),
        '@assets': resolve(__dirname, 'assets'),
        '~logger': resolve(__dirname, 'src/logger'),
    },

    // React support via Vite with Node.js polyfills and Tailwind CSS
    vite: () => ({
        // Enable CORS for sandbox pages (which run in null origin)
        // Without this, the sandbox iframe cannot load ES modules from localhost:3000
        server: {
            cors: true,
        },
        plugins: [
            react(),
            tailwindcss(),
            nodePolyfills({
                // Enable polyfills for node: protocol imports
                protocolImports: true,
                // Include all needed polyfills
                // Note: 'net' and 'fs' are excluded - we provide custom polyfills
                include: [
                    'process',
                    'util',
                    'stream',
                    'events',
                    'crypto',
                    'buffer',
                    'querystring',
                    // 'net' - excluded: we provide custom polyfill with isIP function
                    'http',
                    'https',
                    'url',
                    // 'fs' - excluded: we provide custom polyfill with promises export
                    'path',
                    'os',
                    'tty',
                    'zlib',
                    'zlib',
                ],
            }),
        ],
        resolve: {
            alias: {
                // Custom polyfills that need specific implementations
                'google-logging-utils': resolve(__dirname, 'src/polyfills/google-logging-utils.ts'),
                // Map node:stream/web and stream/web to empty module since browsers have native streams
                'node:stream/web': resolve(__dirname, 'src/polyfills/stream-web.ts'),
                'stream/web': resolve(__dirname, 'src/polyfills/stream-web.ts'),
                // Custom net polyfill with isIP function (required by node-fetch via google-auth-library)
                'net': resolve(__dirname, 'src/polyfills/net.ts'),
                'node:net': resolve(__dirname, 'src/polyfills/net.ts'),
                // Custom fs polyfill with promises export (required by fetch-blob via node-fetch)
                'fs': resolve(__dirname, 'src/polyfills/fs.ts'),
                'node:fs': resolve(__dirname, 'src/polyfills/fs.ts'),
                // Stubs for other Node.js modules to prevent build errors
                'child_process': resolve(__dirname, 'src/polyfills/child_process.ts'),
                'node:child_process': resolve(__dirname, 'src/polyfills/child_process.ts'),
                'tls': resolve(__dirname, 'src/polyfills/tls.ts'),
                'node:tls': resolve(__dirname, 'src/polyfills/tls.ts'),
                'worker_threads': resolve(__dirname, 'src/polyfills/worker_threads.ts'),
                'node:worker_threads': resolve(__dirname, 'src/polyfills/worker_threads.ts'),
                'vm': resolve(__dirname, 'src/polyfills/vm.ts'),
                'node:vm': resolve(__dirname, 'src/polyfills/vm.ts'),
            },
        },
        // Exclude problematic dependencies from optimization
        optimizeDeps: {
            esbuildOptions: {
                target: 'esnext',
                // Better tree-shaking
                treeShaking: true,
            },
            // Exclude heavy deps that don't need pre-bundling
            exclude: ['three', 'ogl'],
        },
        // Disable source maps in production for smaller bundles
        sourcemap: process.env.NODE_ENV === 'development' ? 'inline' : false,
        build: {
            target: 'esnext',
            commonjsOptions: {
                transformMixedEsModules: true,
            },
            chunkSizeWarningLimit: 1000,
            minify: 'esbuild', // Use esbuild for faster minification
            rollupOptions: {
                output: {
                    // Explicitly set manualChunks to undefined to prevent conflicts with
                    // inlineDynamicImports used by WXT for content scripts.
                    // This overrides any manualChunks set by plugins like @tailwindcss/vite.
                    manualChunks: undefined,
                },
            },
        },
    }),

    // Manifest configuration (will be expanded in Phase 11)
    manifest: {
        name: 'Cognito : Your AI Browser Agent',
        version: '0.0.1',
        description: 'super powerful and private',
        author: { email: 'dev@codewarnab.in' },

        permissions: [
            "storage",
            "unlimitedStorage",
            "tabs",
            "tabGroups",
            "sidePanel",
            "alarms",
            "scripting",
            "activeTab",
            "identity",
            "notifications",
            "offscreen",
            "history",
            "bookmarks",
            "omnibox",
            "clipboardWrite",
            "contextMenus",
            "geolocation",
        ],
        // Fixed key for consistent Extension ID
        key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwVgxsaDxwIfWw0yGhkMLONlzo+7RO6+wUT6bF2syzpTO73uMdr/ij5kJwUUQwR4/SNikqkvIi6ijDLkcl17610Cm1B4grtHMFYEuvp7dwkDbO35inGINnXFf+Zf8u9UNN63doNJUu0XEvEWmCS/qi5lOPCuvxAj3xs5gT/eTsDsS8waXNLLqu2l0aT/CR5dbFwH602shM2e2iCUccmFq/6S+gZso1AYg73ffb44XD87ZCiRAZo+hakAfqz6mnUe1lce8lB/J6Rul7mL48m76N9faDinWfowoSpIW9KE8ybFRkHzdX1TvDloGhY+P7vLwuOtR+MwAV0fKjHWHnJPZYQIDAQAB",

        optional_permissions: [],
        host_permissions: [
            "https://youtube-transcript-generator-five.vercel.app/*",
            "<all_urls>"
        ],
        commands: {
            "_execute_side_panel": {
                "suggested_key": {
                    "default": "Ctrl+Shift+H",
                    "mac": "Command+Shift+H"
                },
                "description": "Open AI Chat side panel"
            }
        },
        omnibox: {
            "keyword": "ai"
        },
        content_security_policy: {
            "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
            // Sandbox pages have a more relaxed CSP that allows unsafe-eval
            // This is used by the sandbox-executor for dynamic code execution
            "sandbox": "sandbox allow-scripts allow-forms; script-src 'self' 'unsafe-inline' 'unsafe-eval'; child-src 'self';"
        },
        // Sandbox pages run in a unique origin with no chrome.* API access
        // They can use eval() and new Function() for dynamic code execution
        // WXT compiles entrypoint folders like "sandbox-executor" to "sandbox-executor.html" in root
        sandbox: {
            pages: ["sandbox-executor.html"]
        },

        externally_connectable: {
            matches: [
                "http://localhost:3002/*",
                "https://cognito-ai-one.vercel.app/*"
            ]
        },

        // Web accessible resources - files that can be accessed from web pages
        web_accessible_resources: [
            {
                resources: [
                    // Audio files from public/
                    'sweep1.mp3',
                    // Fonts from src/assets/fonts/ (compiled to assets/fonts/* in output)
                    // Note: WXT may compile these differently - verify paths after build
                    'assets/fonts/Inter-Regular.ttf',
                    'assets/fonts/Inter-Medium.ttf',
                    'assets/fonts/Inter-SemiBold.ttf',
                    // ElevenLabs audio worklet files from assets/elevenlabs/
                    'assets/elevenlabs/audioConcatProcessor.worklet.js',
                    'assets/elevenlabs/rawAudioProcessor.worklet.js',
                ],
                matches: ['<all_urls>'],
            },
        ],
    },
});
