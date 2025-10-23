/**
 * Visual Feedback Utility
 * Provides CSS injection and animation helpers for action feedback
 */

export interface AnimationOptions {
    duration?: number;
    element?: Element;
    cleanup?: boolean;
}

/**
 * Injects CSS into the page for animations
 */
export async function injectCSS(css: string, id: string): Promise<boolean> {
    try {
        // Remove existing style if present
        const existing = document.getElementById(id);
        if (existing) {
            existing.remove();
        }

        const style = document.createElement('style');
        style.id = id;
        style.textContent = css;
        document.head.appendChild(style);
        return true;
    } catch (error) {
        console.warn('Failed to inject CSS:', error);
        return false;
    }
}

/**
 * Removes injected CSS
 */
export function removeCSS(id: string): void {
    try {
        const style = document.getElementById(id);
        if (style) {
            style.remove();
        }
    } catch (error) {
        console.warn('Failed to remove CSS:', error);
    }
}

/**
 * Adds a class to an element and removes it after duration
 */
export async function animateElement(
    element: Element,
    className: string,
    duration: number
): Promise<void> {
    try {
        element.classList.add(className);
        await new Promise(resolve => setTimeout(resolve, duration));
        element.classList.remove(className);
    } catch (error) {
        console.warn('Failed to animate element:', error);
    }
}

/**
 * Creates a temporary overlay element for animations
 */
export function createOverlay(className: string, duration: number): HTMLElement | null {
    try {
        const overlay = document.createElement('div');
        overlay.className = className;
        document.body.appendChild(overlay);

        setTimeout(() => {
            try {
                overlay.remove();
            } catch (e) {
                console.warn('Failed to remove overlay:', e);
            }
        }, duration);

        return overlay;
    } catch (error) {
        console.warn('Failed to create overlay:', error);
        return null;
    }
}

/**
 * Animation: Ripple Click (Option A for clickElement)
 */
export async function showRippleClick(x: number, y: number): Promise<void> {
    const css = `
    @keyframes ai-ripple-click {
      0% {
        transform: translate(-50%, -50%) scale(0);
        opacity: 1;
      }
      100% {
        transform: translate(-50%, -50%) scale(2);
        opacity: 0;
      }
    }
    
    .ai-ripple-click {
      position: fixed;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: rgba(255, 215, 0, 0.6);
      border: 2px solid #FFD700;
      pointer-events: none;
      z-index: 999999;
      animation: ai-ripple-click 300ms ease-out forwards;
    }
  `;

    await injectCSS(css, 'ai-ripple-click-style');

    const ripple = document.createElement('div');
    ripple.className = 'ai-ripple-click';
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    document.body.appendChild(ripple);

    setTimeout(() => {
        try {
            ripple.remove();
            removeCSS('ai-ripple-click-style');
        } catch (e) {
            console.warn('Failed to cleanup ripple:', e);
        }
    }, 300);
}

/**
 * Animation: Zoom Focus (Option C for clickByText)
 */
export async function showZoomFocus(element: Element): Promise<void> {
    const css = `
    @keyframes ai-zoom-focus {
      0% {
        transform: scale(1);
        box-shadow: 0 0 0 0 rgba(255, 215, 0, 0.7);
      }
      50% {
        transform: scale(1.05);
        box-shadow: 0 0 20px 10px rgba(255, 215, 0, 0.7);
      }
      100% {
        transform: scale(1);
        box-shadow: 0 0 0 0 rgba(255, 215, 0, 0);
      }
    }
    
    .ai-zoom-focus {
      animation: ai-zoom-focus 300ms ease-in-out !important;
      position: relative !important;
      z-index: 999998 !important;
    }
    
    body.ai-page-dim::before {
      content: '';
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 999997;
      pointer-events: none;
      animation: ai-dim-fade 300ms ease-in-out;
    }
    
    @keyframes ai-dim-fade {
      0%, 100% { opacity: 0; }
      50% { opacity: 1; }
    }
  `;

    await injectCSS(css, 'ai-zoom-focus-style');

    document.body.classList.add('ai-page-dim');
    await animateElement(element, 'ai-zoom-focus', 300);
    document.body.classList.remove('ai-page-dim');

    setTimeout(() => removeCSS('ai-zoom-focus-style'), 300);
}

/**
 * Animation: Progressive Highlight (Option C for readPageContent)
 */
export async function showProgressiveHighlight(): Promise<void> {
    const css = `
    @keyframes ai-progressive-highlight {
      0% {
        background: rgba(59, 130, 246, 0);
      }
      50% {
        background: rgba(59, 130, 246, 0.2);
      }
      100% {
        background: rgba(59, 130, 246, 0);
      }
    }
    
    .ai-progressive-highlight {
      animation: ai-progressive-highlight 400ms ease-in-out !important;
    }
  `;

    await injectCSS(css, 'ai-progressive-highlight-style');

    // Find major content blocks
    const blocks = document.querySelectorAll('main, article, section, div[role="main"], .content, #content');
    const targetBlocks = Array.from(blocks).slice(0, 5);

    if (targetBlocks.length === 0) {
        // Fallback to body children
        const children = Array.from(document.body.children).slice(0, 5);
        for (let i = 0; i < children.length; i++) {
            setTimeout(() => {
                animateElement(children[i], 'ai-progressive-highlight', 400);
            }, i * 100);
        }
    } else {
        for (let i = 0; i < targetBlocks.length; i++) {
            setTimeout(() => {
                animateElement(targetBlocks[i], 'ai-progressive-highlight', 400);
            }, i * 100);
        }
    }

    setTimeout(() => removeCSS('ai-progressive-highlight-style'), 400 + targetBlocks.length * 100);
}

/**
 * Animation: Selection Glow (Option A for getSelectedText)
 */
export async function showSelectionGlow(): Promise<void> {
    const css = `
    @keyframes ai-selection-glow {
      0%, 100% {
        outline: 2px solid rgba(59, 130, 246, 0);
        outline-offset: 2px;
      }
      50% {
        outline: 2px solid rgba(59, 130, 246, 0.8);
        outline-offset: 4px;
      }
    }
    
    .ai-selection-glow::selection {
      animation: ai-selection-glow 200ms ease-in-out !important;
    }
  `;

    await injectCSS(css, 'ai-selection-glow-style');

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const span = document.createElement('span');
        span.className = 'ai-selection-glow';
        span.style.outline = '2px solid rgba(59, 130, 246, 0.8)';
        span.style.outlineOffset = '2px';
        span.style.animation = 'ai-selection-glow 200ms ease-in-out';

        try {
            range.surroundContents(span);
            setTimeout(() => {
                try {
                    const parent = span.parentNode;
                    while (span.firstChild) {
                        parent?.insertBefore(span.firstChild, span);
                    }
                    span.remove();
                    removeCSS('ai-selection-glow-style');
                } catch (e) {
                    console.warn('Failed to cleanup selection glow:', e);
                }
            }, 200);
        } catch (e) {
            // If surroundContents fails, just show a simple flash
            console.warn('Failed to wrap selection:', e);
            removeCSS('ai-selection-glow-style');
        }
    }
}

/**
 * Animation: Field Focus (Option C for typeInField)
 */
export async function showFieldFocus(element: Element, duration: number): Promise<void> {
    const css = `
    @keyframes ai-field-focus {
      0%, 100% {
        box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.5);
      }
      50% {
        box-shadow: 0 0 0 4px rgba(6, 182, 212, 0.8), 0 0 20px rgba(6, 182, 212, 0.4);
      }
    }
    
    .ai-field-focus {
      animation: ai-field-focus 1s ease-in-out infinite !important;
      border: 2px solid rgba(6, 182, 212, 0.8) !important;
    }
  `;

    await injectCSS(css, 'ai-field-focus-style');
    element.classList.add('ai-field-focus');

    setTimeout(() => {
        try {
            element.classList.remove('ai-field-focus');
            removeCSS('ai-field-focus-style');
        } catch (e) {
            console.warn('Failed to cleanup field focus:', e);
        }
    }, duration);
}

/**
 * Animation: Page Slide (Option C for scrollPage)
 */
export async function showPageSlide(direction: 'up' | 'down'): Promise<void> {
    const css = `
    @keyframes ai-page-slide-indicator {
      0% {
        opacity: 0;
        transform: translateY(${direction === 'down' ? '-20px' : '20px'});
      }
      50% {
        opacity: 1;
        transform: translateY(0);
      }
      100% {
        opacity: 0;
        transform: translateY(${direction === 'down' ? '20px' : '-20px'});
      }
    }
    
    .ai-page-slide-indicator {
      position: fixed;
      ${direction === 'down' ? 'top' : 'bottom'}: 50%;
      right: 20px;
      width: 40px;
      height: 40px;
      background: rgba(59, 130, 246, 0.8);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 24px;
      font-weight: bold;
      z-index: 999999;
      pointer-events: none;
      animation: ai-page-slide-indicator 250ms ease-out forwards;
    }
  `;

    await injectCSS(css, 'ai-page-slide-style');

    const indicator = document.createElement('div');
    indicator.className = 'ai-page-slide-indicator';
    indicator.textContent = direction === 'down' ? '↓' : '↑';
    document.body.appendChild(indicator);

    setTimeout(() => {
        try {
            indicator.remove();
            removeCSS('ai-page-slide-style');
        } catch (e) {
            console.warn('Failed to cleanup page slide:', e);
        }
    }, 250);
}

/**
 * Animation: Spotlight (Option B for focusElement)
 */
export async function showSpotlight(element: Element): Promise<void> {
    const css = `
    @keyframes ai-spotlight-dim {
      0% { opacity: 0; }
      100% { opacity: 1; }
    }
    
    @keyframes ai-spotlight-brighten {
      0% { filter: brightness(1); }
      100% { filter: brightness(1.3); }
    }
    
    body.ai-spotlight-active::before {
      content: '';
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      z-index: 999996;
      pointer-events: none;
      animation: ai-spotlight-dim 250ms ease-out forwards;
    }
    
    .ai-spotlight-element {
      position: relative !important;
      z-index: 999997 !important;
      animation: ai-spotlight-brighten 250ms ease-out forwards !important;
      box-shadow: 0 0 30px 10px rgba(59, 130, 246, 0.6) !important;
    }
  `;

    await injectCSS(css, 'ai-spotlight-style');

    document.body.classList.add('ai-spotlight-active');
    element.classList.add('ai-spotlight-element');

    setTimeout(() => {
        try {
            document.body.classList.remove('ai-spotlight-active');
            element.classList.remove('ai-spotlight-element');
            removeCSS('ai-spotlight-style');
        } catch (e) {
            console.warn('Failed to cleanup spotlight:', e);
        }
    }, 250);
}

/**
 * Animation: Search Detection (Option A for findSearchBar)
 */
export async function showSearchDetection(elements: Element[]): Promise<void> {
    const css = `
    @keyframes ai-search-pulse {
      0%, 100% {
        box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
      }
      50% {
        box-shadow: 0 0 0 8px rgba(59, 130, 246, 0);
      }
    }
    
    .ai-search-detected {
      animation: ai-search-pulse 300ms ease-out !important;
      border: 2px solid rgba(59, 130, 246, 0.8) !important;
    }
  `;

    await injectCSS(css, 'ai-search-detection-style');

    for (let i = 0; i < elements.length; i++) {
        setTimeout(() => {
            animateElement(elements[i], 'ai-search-detected', 300);
        }, i * 100);
    }

    setTimeout(() => removeCSS('ai-search-detection-style'), 300 + elements.length * 100);
}

/**
 * Helper to safely execute animation with error handling
 */
export async function safeAnimate(animationFn: () => Promise<void>): Promise<void> {
    try {
        await animationFn();
    } catch (error) {
        // Silently fail - animations are non-critical
        console.debug('Animation skipped:', error);
    }
}
