/**
 * Page Glow Indicator Utility
 * Creates a diffused blue glow effect around the page to indicate AI is reading
 */

import { createLogger } from '~logger';

const log = createLogger('PageGlow', 'UTILS');

const GLOW_ID = 'ai-reading-glow';
const GLOW_STYLE_ID = 'ai-reading-glow-style';

/**
 * Start the page reading glow effect
 */
export function startPageGlow(): void {
    try {
        // Check if glow is already applied
        if (document.body.classList.contains(GLOW_ID)) {
            return;
        }

        // Create and inject CSS if not already present
        if (!document.getElementById(GLOW_STYLE_ID)) {
            const style = document.createElement('style');
            style.id = GLOW_STYLE_ID;
            style.textContent = `
                @keyframes pageGlowPulse {
                    0%, 100% {
                        box-shadow: 0 0 20px 10px rgba(59, 130, 246, 0.3), 
                                    0 0 40px 20px rgba(59, 130, 246, 0.15),
                                    inset 0 0 30px 5px rgba(59, 130, 246, 0.1);
                    }
                    50% {
                        box-shadow: 0 0 30px 15px rgba(59, 130, 246, 0.4), 
                                    0 0 60px 30px rgba(59, 130, 246, 0.2),
                                    inset 0 0 40px 8px rgba(59, 130, 246, 0.15);
                    }
                }

                body.${GLOW_ID} {
                    animation: pageGlowPulse 2s ease-in-out infinite;
                    box-shadow: 0 0 20px 10px rgba(59, 130, 246, 0.3), 
                                0 0 40px 20px rgba(59, 130, 246, 0.15),
                                inset 0 0 30px 5px rgba(59, 130, 246, 0.1);
                }
            `;
            document.head.appendChild(style);
        }

        // Apply glow class to body
        document.body.classList.add(GLOW_ID);
    } catch (error) {
        log.warn('Failed to start page glow:', error);
    }
}

/**
 * Stop the page reading glow effect
 */
export function stopPageGlow(): void {
    try {
        // Apply fade out transition before removing class
        document.body.style.transition = 'box-shadow 0.5s ease-out';
        document.body.classList.remove(GLOW_ID);

        // Reset transition after fade out
        setTimeout(() => {
            document.body.style.transition = '';
        }, 500);
    } catch (error) {
        log.warn('Failed to stop page glow:', error);
    }
}

/**
 * Check if glow is currently active
 */
export function isPageGlowActive(): boolean {
    return document.body.classList.contains(GLOW_ID);
}

