import { createLogger } from '~logger';

const log = createLogger('CliToolApproval', 'CLI_MODE_BRIDGE');

type PendingApproval = {
  resolve: () => void;
  reject: (error: Error) => void;
};

/**
 * Pending approval waiters for tool execution requests coming from the local cli bridge.
 *
 * Keyed by the bridge tool execution requestId.
 * We intentionally align requestId with toolCallId (see cli-bridge aiSdkTools) so
 * the UI can approve/deny the exact card it is rendering.
 */
const pendingApprovals = new Map<string, PendingApproval>();

/**
 * Approve/deny can arrive before the tool execution request (race between SSE streams).
 * Track early outcomes so `waitForCliToolApproval()` can resolve immediately.
 */
const preApproved = new Set<string>();
const preDenied = new Map<string, string>();

export function waitForCliToolApproval(callId: string, abortSignal?: AbortSignal): Promise<void> {
  // Fast-path: approval already happened
  if (preApproved.has(callId)) {
    preApproved.delete(callId);
    return Promise.resolve();
  }

  const deniedReason = preDenied.get(callId);
  if (deniedReason) {
    preDenied.delete(callId);
    return Promise.reject(new Error(deniedReason));
  }

  // If a previous waiter exists, reject it (defensive; should not happen)
  const existing = pendingApprovals.get(callId);
  if (existing) {
    log.warn('Duplicate CLI approval waiter detected, rejecting previous waiter', { callId });
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

export function approveCliToolCall(callId: string): void {
  // Clear any prior denial
  preDenied.delete(callId);

  const pending = pendingApprovals.get(callId);
  if (pending) {
    pendingApprovals.delete(callId);
    pending.resolve();
    return;
  }

  // Store for later waiter (race-safe)
  preApproved.add(callId);
  log.debug('Stored pre-approval (no pending waiter yet)', { callId });
}

export function denyCliToolCall(callId: string, reason = 'User denied this action.'): void {
  // Clear any prior approval
  preApproved.delete(callId);

  const pending = pendingApprovals.get(callId);
  if (pending) {
    pendingApprovals.delete(callId);
    pending.reject(new Error(reason));
    return;
  }

  // Store for later waiter (race-safe)
  preDenied.set(callId, reason);
  log.debug('Stored pre-denial (no pending waiter yet)', { callId, reason });
}

