import type http from 'node:http';

/**
 * Read and parse JSON body from request
 */
export async function readJson(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  
  const raw = Buffer.concat(chunks).toString('utf-8');
  if (!raw) return {};
  
  return JSON.parse(raw);
}

/**
 * Send JSON response
 */
export function sendJson(res: http.ServerResponse, data: unknown, statusCode = 200): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

/**
 * Send error response
 */
export function sendError(res: http.ServerResponse, error: string, statusCode = 400): void {
  sendJson(res, { error }, statusCode);
}
