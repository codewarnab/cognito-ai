/**
 * Vertex AI Authentication Helper
 * Handles OAuth2 JWT generation for Vertex AI service account authentication
 */

import { createLogger } from '~logger';
import type { VertexCredentials } from '@/utils/credentials';

const log = createLogger('VertexAuth', 'BACKGROUND');

/**
 * Generate an OAuth2 access token for Vertex AI using service account credentials
 * Uses JWT assertion flow (RFC 7523)
 */
export async function generateVertexAccessToken(credentials: VertexCredentials): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const expiry = now + 3600; // 1 hour

    // JWT Header
    const header = {
        alg: 'RS256',
        typ: 'JWT',
        kid: credentials.privateKeyId,
    };

    // JWT Payload (claims)
    const payload = {
        iss: credentials.clientEmail,
        sub: credentials.clientEmail,
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: expiry,
        scope: 'https://www.googleapis.com/auth/cloud-platform',
    };

    // Encode header and payload
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signatureInput = `${encodedHeader}.${encodedPayload}`;

    // Sign with private key using Web Crypto API
    const signature = await signWithPrivateKey(signatureInput, credentials.privateKey);
    const encodedSignature = base64UrlEncodeBuffer(signature);

    const jwt = `${signatureInput}.${encodedSignature}`;

    // Exchange JWT for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: jwt,
        }),
    });

    if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        log.error('Failed to get Vertex access token', { error: errorText });
        throw new Error(`Failed to get Vertex access token: ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    log.debug('Vertex access token obtained', { expiresIn: tokenData.expires_in });

    return tokenData.access_token;
}

/**
 * Base64 URL encode a string (RFC 4648)
 */
function base64UrlEncode(data: string): string {
    const base64 = btoa(data);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Base64 URL encode an ArrayBuffer (RFC 4648)
 */
function base64UrlEncodeBuffer(buffer: ArrayBuffer): string {
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Sign data with RSA private key using Web Crypto API
 */
async function signWithPrivateKey(data: string, privateKeyPem: string): Promise<ArrayBuffer> {
    // Extract the key content from PEM format
    const pemContent = privateKeyPem
        .replace(/-----BEGIN PRIVATE KEY-----/, '')
        .replace(/-----END PRIVATE KEY-----/, '')
        .replace(/\n/g, '')
        .trim();

    // Decode base64 to binary
    const binaryKey = Uint8Array.from(atob(pemContent), c => c.charCodeAt(0));

    // Import the key
    const cryptoKey = await crypto.subtle.importKey(
        'pkcs8',
        binaryKey,
        {
            name: 'RSASSA-PKCS1-v1_5',
            hash: 'SHA-256',
        },
        false,
        ['sign']
    );

    // Sign the data
    const encoder = new TextEncoder();
    const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        cryptoKey,
        encoder.encode(data)
    );

    return signature;
}
