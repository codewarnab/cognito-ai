/**
 * Installation Token Manager
 * Generates and persists a unique installation ID for the extension.
 * Used for rate limiting and analytics on the backend.
 */

const STORAGE_KEY = 'cognito:installationId';
const TOKEN_VERSION = 1;

interface StoredToken {
    id: string;
    version: number;
    createdAt: number;
}

/**
 * Gets or generates a persistent installation ID.
 * Format: `ext_${uuid}_v${version}`
 */
export async function getInstallationToken(): Promise<string> {
    const storage = await chrome.storage.local.get(STORAGE_KEY);

    if (storage[STORAGE_KEY]) {
        const token = storage[STORAGE_KEY] as StoredToken;
        // Migration path: regenerate if version mismatch
        if (token.version === TOKEN_VERSION) {
            return `ext_${token.id}_v${token.version}`;
        }
    }

    // Generate new token
    const newToken: StoredToken = {
        id: crypto.randomUUID(),
        version: TOKEN_VERSION,
        createdAt: Date.now()
    };

    await chrome.storage.local.set({ [STORAGE_KEY]: newToken });
    return `ext_${newToken.id}_v${newToken.version}`;
}

/**
 * Validates token format (for backend verification)
 */
export function isValidTokenFormat(token: string): boolean {
    return /^ext_[a-f0-9-]{36}_v\d+$/.test(token);
}
