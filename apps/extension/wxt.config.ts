import { defineConfig } from 'wxt';
import react from '@vitejs/plugin-react';
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

    // React support via Vite with Node.js polyfills
    vite: () => ({
        plugins: [
            react(),
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
                    'vm',
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
            },
        },
        // Exclude problematic dependencies from optimization
        optimizeDeps: {
            esbuildOptions: {
                target: 'esnext',
            },
        },
        build: {
            target: 'esnext',
            commonjsOptions: {
                transformMixedEsModules: true,
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
            "webNavigation",
            "identity",
            "notifications",
            "offscreen",
            "cookies",
            "history",
            "search",
            "bookmarks",
            "omnibox",
            "clipboardWrite",
            "contextMenus"
        ],
        optional_permissions: [
            "tabCapture",
            "desktopCapture"
        ],
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
            "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';"
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
