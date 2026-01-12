import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { StoredToken } from '../types';

const TOKENS_PATH = path.join(os.homedir(), '.cognito', 'bridge', 'tokens.json');

/**
 * Hash a token using SHA-256
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a random token
 */
export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Ensure the tokens directory exists
 */
async function ensureDir(): Promise<void> {
  await fs.mkdir(path.dirname(TOKENS_PATH), { recursive: true });
}

/**
 * Load all stored tokens
 */
export async function loadTokens(): Promise<StoredToken[]> {
  try {
    const raw = await fs.readFile(TOKENS_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Save tokens to disk
 */
export async function saveTokens(tokens: StoredToken[]): Promise<void> {
  await ensureDir();
  await fs.writeFile(TOKENS_PATH, JSON.stringify(tokens, null, 2) + '\n', 'utf-8');
}

/**
 * Add a new token
 */
export async function addToken(token: string): Promise<void> {
  const tokens = await loadTokens();
  const tokenHash = hashToken(token);
  
  // Check if already exists
  if (tokens.some(t => t.tokenHash === tokenHash)) {
    return;
  }
  
  tokens.push({
    tokenHash,
    createdAt: Date.now(),
  });
  
  await saveTokens(tokens);
}

/**
 * Validate a token and update last used time
 */
export async function validateToken(token: string): Promise<boolean> {
  const tokens = await loadTokens();
  const tokenHash = hashToken(token);
  const found = tokens.find(t => t.tokenHash === tokenHash);
  
  if (!found) {
    return false;
  }
  
  // Update last used time
  found.lastUsedAt = Date.now();
  await saveTokens(tokens);
  
  return true;
}
