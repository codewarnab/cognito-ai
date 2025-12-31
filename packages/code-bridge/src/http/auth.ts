import type http from 'node:http';
import { validateToken, hashToken } from '../pairing/tokenStore.js';
import { sendError } from './json.js';

export interface AuthResult {
  ok: true;
  tokenHash: string;
}

export interface AuthFailure {
  ok: false;
}

/**
 * Require authentication for a request
 * Returns the token hash if valid, or sends an error response and returns failure
 */
export async function requireAuth(
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<AuthResult | AuthFailure> {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  
  if (!match) {
    sendError(res, 'Missing Authorization header', 401);
    return { ok: false };
  }
  
  const token = match[1];
  const isValid = await validateToken(token);
  
  if (!isValid) {
    sendError(res, 'Invalid token', 403);
    return { ok: false };
  }
  
  return { ok: true, tokenHash: hashToken(token) };
}
