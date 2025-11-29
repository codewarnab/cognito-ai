/**
 * Accessibility utilities for search components.
 */

/**
 * Announces a message to screen readers.
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.style.cssText = `
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
    `;
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    
    // Remove after announcement
    setTimeout(() => {
        document.body.removeChild(announcement);
    }, 1000);
}

/**
 * Focus trap for modal dialogs.
 */
export function createFocusTrap(container: HTMLElement): {
    activate: () => void;
    deactivate: () => void;
} {
    const focusableSelector = [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
    ].join(', ');

    let previouslyFocused: HTMLElement | null = null;

    function getFocusableElements(): HTMLElement[] {
        return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector));
    }


    function handleKeyDown(e: KeyboardEvent): void {
        if (e.key !== 'Tab') return;

        const focusable = getFocusableElements();
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (!first || !last) return;

        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    }

    return {
        activate() {
            previouslyFocused = document.activeElement as HTMLElement;
            container.addEventListener('keydown', handleKeyDown);
            
            const focusable = getFocusableElements();
            focusable[0]?.focus();
        },
        deactivate() {
            container.removeEventListener('keydown', handleKeyDown);
            previouslyFocused?.focus();
        },
    };
}

/**
 * Keyboard navigation for lists.
 */
export function handleListKeyNavigation(
    event: React.KeyboardEvent,
    items: HTMLElement[],
    currentIndex: number,
    onSelect: (index: number) => void
): void {
    switch (event.key) {
        case 'ArrowDown':
            event.preventDefault();
            if (currentIndex < items.length - 1) {
                onSelect(currentIndex + 1);
                items[currentIndex + 1]?.focus();
            }
            break;
        case 'ArrowUp':
            event.preventDefault();
            if (currentIndex > 0) {
                onSelect(currentIndex - 1);
                items[currentIndex - 1]?.focus();
            }
            break;
        case 'Home':
            event.preventDefault();
            onSelect(0);
            items[0]?.focus();
            break;
        case 'End':
            event.preventDefault();
            onSelect(items.length - 1);
            items[items.length - 1]?.focus();
            break;
    }
}
