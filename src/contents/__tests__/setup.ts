/**
 * Test Setup for Content Script Tests
 * Mocks Chrome Extension APIs
 */

import { vi } from 'vitest'

// Mock Chrome API
const mockChrome = {
    storage: {
        local: {
            get: vi.fn(),
            set: vi.fn(),
            remove: vi.fn(),
        },
    },
    runtime: {
        sendMessage: vi.fn(),
        onMessage: {
            addListener: vi.fn(),
            removeListener: vi.fn(),
        },
        id: 'test-extension-id',
    },
}

// @ts-ignore - Mock global chrome object
global.chrome = mockChrome

// Mock window.location
Object.defineProperty(window, 'location', {
    value: {
        href: 'https://example.com/test',
        hostname: 'example.com',
        pathname: '/test',
    },
    writable: true,
})
