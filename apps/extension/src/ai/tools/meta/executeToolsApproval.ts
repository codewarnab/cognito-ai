import { createLogger } from '~logger';

const log = createLogger('ExecuteToolsApproval', 'TOOLS_EXECUTION');

type PendingApproval = {
  resolve: () => void;
  reject: (error: Error) => void;
};

/**
 * In Adaptive Mode, tools are invoked from a sandboxed iframe (executeTools).
 * For sensitive tools, we need to pause sandbox execution, show approval UI,
 * and resume only after the user approves.
 *
 * This module provides a small promise bridge:
 * - SandboxBridge awaits approval via `waitForSandboxToolApproval(callId)`
 * - UI resolves via `approveSandboxToolCall(callId)` or `denySandboxToolCall(callId)`
 */
const pendingApprovals = new Map<string, PendingApproval>();

export function waitForSandboxToolApproval(callId: string, abortSignal?: AbortSignal): Promise<void> {
  // If a previous waiter exists, reject it (defensive; should not happen)
  const existing = pendingApprovals.get(callId);
  if (existing) {
    log.warn('Duplicate approval waiter detected, rejecting previous waiter', { callId });
    existing.reject(new Error('Approval superseded by a newer request'));
    pendingApprovals.delete(callId);
  }

  return new Promise<void>((resolve, reject) => {
    if (abortSignal?.aborted) {
      reject(new Error('Operation cancelled'));
      return;
    }

    const onAbort = () => {
      const pending = pendingApprovals.get(callId);
      if (!pending) return;
      pendingApprovals.delete(callId);
      pending.reject(new Error('Operation cancelled'));
    };

    if (abortSignal) {
      abortSignal.addEventListener('abort', onAbort, { once: true });
    }

    const wrappedResolve = () => {
      if (abortSignal) abortSignal.removeEventListener('abort', onAbort);
      resolve();
    };

    const wrappedReject = (error: Error) => {
      if (abortSignal) abortSignal.removeEventListener('abort', onAbort);
      reject(error);
    };

    pendingApprovals.set(callId, { resolve: wrappedResolve, reject: wrappedReject });
  });
}

export function approveSandboxToolCall(callId: string): void {
  const pending = pendingApprovals.get(callId);
  if (!pending) {
    log.debug('Approve ignored (no pending approval)', { callId });
    return;
  }

  pendingApprovals.delete(callId);
  pending.resolve();
}

export function denySandboxToolCall(callId: string, reason = 'User denied this action.'): void {
  const pending = pendingApprovals.get(callId);
  if (!pending) {
    log.debug('Deny ignored (no pending approval)', { callId });
    return;
  }

  pendingApprovals.delete(callId);
  pending.reject(new Error(reason));
}

