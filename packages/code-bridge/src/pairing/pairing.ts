import crypto from 'node:crypto';
import type { PairingCode } from '../types.js';
import { addToken, generateToken } from './tokenStore.js';

// In-memory store for active pairing codes
const activeCodes = new Map<string, { expiresAt: number }>();

// Pairing code expiry time (5 minutes)
const CODE_EXPIRY_MS = 5 * 60 * 1000;

/**
 * Generate a human-readable pairing code (e.g., "123-456")
 */
function generatePairingCode(): string {
  const part1 = crypto.randomInt(100, 999);
  const part2 = crypto.randomInt(100, 999);
  return `${part1}-${part2}`;
}

/**
 * Start a new pairing session
 */
export function startPairing(): PairingCode {
  // Clean up expired codes
  const now = Date.now();
  for (const [code, data] of activeCodes) {
    if (data.expiresAt < now) {
      activeCodes.delete(code);
    }
  }
  
  const code = generatePairingCode();
  const expiresAt = now + CODE_EXPIRY_MS;
  
  activeCodes.set(code, { expiresAt });
  
  return { code, expiresAt };
}

/**
 * Confirm a pairing code and return a token
 * Returns null if code is invalid or expired
 */
export async function confirmPairing(code: string): Promise<string | null> {
  const data = activeCodes.get(code);
  
  if (!data) {
    return null;
  }
  
  if (data.expiresAt < Date.now()) {
    activeCodes.delete(code);
    return null;
  }
  
  // Remove the code (one-time use)
  activeCodes.delete(code);
  
  // Generate and store a new token
  const token = generateToken();
  await addToken(token);
  
  return token;
}

/**
 * Get the current active pairing code (for display on startup)
 */
export function getCurrentPairingCode(): PairingCode | null {
  const now = Date.now();
  
  for (const [code, data] of activeCodes) {
    if (data.expiresAt > now) {
      return { code, expiresAt: data.expiresAt };
    }
  }
  
  return null;
}
