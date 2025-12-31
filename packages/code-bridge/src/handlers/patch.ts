import type http from 'node:http';
import { readJson, sendJson, sendError } from '../http/json.js';
import { requireAuth } from '../http/auth.js';
import { getPatch, deletePatch } from '../patch/patchStore.js';
import { applyWithGit } from '../patch/gitApply.js';

/**
 * Handle POST /code/patch/apply
 * Applies a previously proposed patch
 */
export async function handlePatchApply(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  cwd: string
): Promise<void> {
  // Require authentication
  const auth = await requireAuth(req, res);
  if (!auth.ok) return;

  try {
    const body = await readJson(req) as { patchId?: string };

    if (!body.patchId || typeof body.patchId !== 'string') {
      sendError(res, 'Missing patchId', 400);
      return;
    }

    // Get the patch (validates ownership via tokenHash)
    const patch = getPatch(body.patchId, auth.tokenHash);
    if (!patch) {
      sendError(res, 'Patch not found or expired', 404);
      return;
    }

    // Apply the patch
    const result = await applyWithGit({
      cwd,
      unifiedDiff: patch.unifiedDiff,
    });

    if (result.applied) {
      // Remove the patch from store after successful apply
      deletePatch(body.patchId);
    }

    sendJson(res, result);
  } catch (err) {
    console.error('[patch/apply] Error:', err);
    sendError(res, err instanceof Error ? err.message : 'Internal error', 500);
  }
}
