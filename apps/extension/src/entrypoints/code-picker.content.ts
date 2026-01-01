import type { CodeModeElementContext } from '@cognito/shared/types';

/**
 * Result of the element picker operation
 */
type PickResult =
    | { ok: true; context: CodeModeElementContext }
    | { ok: false; error: string };

/**
 * Checks if an element is a sensitive input (password, credit card, etc.)
 */
function isSensitiveInput(el: Element): boolean {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return false;

    const type = (el instanceof HTMLInputElement ? el.type : '').toLowerCase();
    const ac = (el.getAttribute('autocomplete') || '').toLowerCase();
    const name = (el.getAttribute('name') || '').toLowerCase();
    const id = (el.getAttribute('id') || '').toLowerCase();

    if (type === 'password') return true;
    if (
        ['cc-number', 'cc-exp', 'cc-csc', 'current-password', 'new-password'].includes(ac)
    )
        return true;
    if (
        /password|card|cvv|csc|ssn|secret|pin/i.test(name) ||
        /password|card|cvv|csc|ssn|secret|pin/i.test(id)
    )
        return true;

    return false;
}

/**
 * Builds a best-effort CSS selector for an element
 */
function buildSelector(el: Element): string | undefined {
    // Best-effort: prefer ID, else tag + first safe class, else tag
    const id = el.id;
    if (id) {
        // IDs might have special chars that need escaping
        try {
            return `#${CSS.escape(id)}`;
        } catch {
            // Fallback if ID is weird
        }
    }

    const classList = Array.from(el.classList || []).filter(Boolean);
    const safe = classList.find((c) => {
        try {
            // Check if class is unique enough/valid
            document.querySelectorAll(`.${CSS.escape(c)}`);
            return true;
        } catch {
            return false;
        }
    });

    if (safe) return `${el.tagName.toLowerCase()}.${CSS.escape(safe)}`;
    return el.tagName.toLowerCase();
}

/**
 * Starts the interactive element picker
 */
export function startElementPicker(): Promise<PickResult> {
    return new Promise((resolve) => {
        // Create overlay container
        const overlay = document.createElement('div');
        overlay.style.cssText = [
            'position:fixed',
            'top:0',
            'left:0',
            'right:0',
            'bottom:0',
            'pointer-events:none',
            'z-index:2147483647', // Max z-index
        ].join(';');

        // Create highlight box
        const box = document.createElement('div');
        box.style.cssText = [
            'position:fixed', // Fixed instead of absolute to handle scrolling better with getBoundingClientRect
            'border:2px solid rgba(59,130,246,0.9)',
            'background:rgba(59,130,246,0.08)',
            'box-sizing:border-box',
            'border-radius:4px',
            'transition: all 0.05s ease-out',
            'pointer-events:none',
        ].join(';');

        overlay.appendChild(box);
        document.documentElement.appendChild(overlay);

        // Change cursor
        const prevCursor = document.body.style.cursor;
        document.body.style.cursor = 'crosshair';

        // Add style tag for forcing cursor on all elements
        const style = document.createElement('style');
        style.textContent = '* { cursor: crosshair !important; }';
        document.head.appendChild(style);

        const cleanup = () => {
            document.body.style.cursor = prevCursor;
            style.remove();
            window.removeEventListener('mousemove', onMove, true);
            window.removeEventListener('click', onClick, true);
            window.removeEventListener('keydown', onKeyDown, true);
            overlay.remove();
        };

        let lastTarget: Element | null = null;

        const onMove = (e: MouseEvent) => {
            const target = document.elementFromPoint(e.clientX, e.clientY);
            if (!target || target === overlay || target === box) return;

            lastTarget = target;
            const r = target.getBoundingClientRect();

            box.style.top = `${r.top}px`;
            box.style.left = `${r.left}px`;
            box.style.width = `${r.width}px`;
            box.style.height = `${r.height}px`;
        };

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                cleanup();
                resolve({ ok: false, error: 'cancelled' });
            }
        };

        const onClick = (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            const el = lastTarget;
            if (!el) {
                // If clicked without a target (shouldn't happen with elementFromPoint), cancel
                return;
            }

            // SECURITY: never capture values from sensitive inputs
            if (isSensitiveInput(el)) {
                cleanup();
                resolve({ ok: false, error: 'sensitive-element' });
                return;
            }

            const rect = el.getBoundingClientRect();
            const text = (el as HTMLElement).innerText || el.textContent || '';
            const textPreview = text.trim().slice(0, 200) || undefined;
            const outer = el.outerHTML || '';
            const outerHtmlPreview = outer.slice(0, 2000) || undefined;

            const ctx: CodeModeElementContext = {
                url: window.location.href,
                title: document.title,
                selector: buildSelector(el),
                tagName: el.tagName.toLowerCase(),
                id: el.id || undefined,
                classList: Array.from(el.classList || []).slice(0, 20),
                textPreview,
                outerHtmlPreview,
                boundingBox: {
                    top: Math.round(rect.top),
                    left: Math.round(rect.left),
                    width: Math.round(rect.width),
                    height: Math.round(rect.height),
                },
            };

            cleanup();
            resolve({ ok: true, context: ctx });
        };

        window.addEventListener('mousemove', onMove, { capture: true, passive: true });
        window.addEventListener('click', onClick, { capture: true }); // Not passive as we preventDefault
        window.addEventListener('keydown', onKeyDown, { capture: true });
    });
}

export default defineContentScript({
    matches: ['<all_urls>'],

    main(_ctx) {
        // Store cancel callback for programmatic cancellation
        let cancelCallback: (() => void) | null = null;

        // Listen for start picker message
        chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
            if (message?.type === 'code/picker/start') {
                // Create a picker with cancel capability
                const abortController = new AbortController();

                // Store cancel callback
                cancelCallback = () => {
                    abortController.abort();
                };

                startElementPickerWithAbort(abortController.signal)
                    .then((result) => {
                        cancelCallback = null;
                        sendResponse(result);
                    })
                    .catch((err) => {
                        cancelCallback = null;
                        sendResponse({
                            ok: false,
                            error: err instanceof Error ? err.message : String(err),
                        });
                    });
                return true; // Keep channel open for async response
            }

            if (message?.type === 'code/picker/cancel') {
                if (cancelCallback) {
                    cancelCallback();
                    cancelCallback = null;
                    sendResponse({ ok: true });
                } else {
                    sendResponse({ ok: false, error: 'no-active-picker' });
                }
                return true;
            }

            return false; // Not handled by this listener
        });
    },
});

/**
 * Starts the interactive element picker with abort signal support
 */
function startElementPickerWithAbort(abortSignal: AbortSignal): Promise<PickResult> {
    return new Promise((resolve) => {
        // Create overlay container
        const overlay = document.createElement('div');
        overlay.style.cssText = [
            'position:fixed',
            'top:0',
            'left:0',
            'right:0',
            'bottom:0',
            'pointer-events:none',
            'z-index:2147483647', // Max z-index
        ].join(';');

        // Create highlight box
        const box = document.createElement('div');
        box.style.cssText = [
            'position:fixed', // Fixed instead of absolute to handle scrolling better with getBoundingClientRect
            'border:2px solid rgba(59,130,246,0.9)',
            'background:rgba(59,130,246,0.08)',
            'box-sizing:border-box',
            'border-radius:4px',
            'transition: all 0.05s ease-out',
            'pointer-events:none',
        ].join(';');

        overlay.appendChild(box);
        document.documentElement.appendChild(overlay);

        // Change cursor
        const prevCursor = document.body.style.cursor;
        document.body.style.cursor = 'crosshair';

        // Add style tag for forcing cursor on all elements
        const style = document.createElement('style');
        style.textContent = '* { cursor: crosshair !important; }';
        document.head.appendChild(style);

        const cleanup = () => {
            document.body.style.cursor = prevCursor;
            style.remove();
            window.removeEventListener('mousemove', onMove, true);
            window.removeEventListener('click', onClick, true);
            window.removeEventListener('keydown', onKeyDown, true);
            overlay.remove();
        };

        // Handle abort signal
        if (abortSignal.aborted) {
            cleanup();
            resolve({ ok: false, error: 'cancelled' });
            return;
        }

        abortSignal.addEventListener('abort', () => {
            cleanup();
            resolve({ ok: false, error: 'cancelled' });
        });

        let lastTarget: Element | null = null;

        const onMove = (e: MouseEvent) => {
            const target = document.elementFromPoint(e.clientX, e.clientY);
            if (!target || target === overlay || target === box) return;

            lastTarget = target;
            const r = target.getBoundingClientRect();

            box.style.top = `${r.top}px`;
            box.style.left = `${r.left}px`;
            box.style.width = `${r.width}px`;
            box.style.height = `${r.height}px`;
        };

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                cleanup();
                resolve({ ok: false, error: 'cancelled' });
            }
        };

        const onClick = (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            const el = lastTarget;
            if (!el) {
                // If clicked without a target (shouldn't happen with elementFromPoint), cancel
                return;
            }

            // SECURITY: never capture values from sensitive inputs
            if (isSensitiveInput(el)) {
                cleanup();
                resolve({ ok: false, error: 'sensitive-element' });
                return;
            }

            const rect = el.getBoundingClientRect();
            const text = (el as HTMLElement).innerText || el.textContent || '';
            const textPreview = text.trim().slice(0, 200) || undefined;
            const outer = el.outerHTML || '';
            const outerHtmlPreview = outer.slice(0, 2000) || undefined;

            const ctx: CodeModeElementContext = {
                url: window.location.href,
                title: document.title,
                selector: buildSelector(el),
                tagName: el.tagName.toLowerCase(),
                id: el.id || undefined,
                classList: Array.from(el.classList || []).slice(0, 20),
                textPreview,
                outerHtmlPreview,
                boundingBox: {
                    top: Math.round(rect.top),
                    left: Math.round(rect.left),
                    width: Math.round(rect.width),
                    height: Math.round(rect.height),
                },
            };

            cleanup();
            resolve({ ok: true, context: ctx });
        };

        window.addEventListener('mousemove', onMove, { capture: true, passive: true });
        window.addEventListener('click', onClick, { capture: true }); // Not passive as we preventDefault
        window.addEventListener('keydown', onKeyDown, { capture: true });
    });
}
