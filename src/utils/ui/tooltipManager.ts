import { useState, useCallback, useEffect } from 'react';

/**
 * Tooltip Manager - Handles subsequent tooltip optimizations
 * Implements the pattern from https://emilkowal.ski/ui/7-practical-animation-tips
 * 
 * Once a tooltip is shown, subsequent tooltips in the same group appear instantly
 * without delay or animation for better UX.
 */

class TooltipManager {
    private activeGroup: string | null = null;
    private resetTimer: number | null = null;
    private readonly RESET_DELAY = 500; // ms after last tooltip closes

    /**
     * Mark a tooltip as being shown in a specific group
     * @param group - The group identifier (e.g., 'inline-code', 'mcp-cards')
     * @returns true if this is a subsequent tooltip (should be instant)
     */
    showTooltip(group: string): boolean {
        const isInstant = this.activeGroup === group;
        this.activeGroup = group;

        // Clear any pending reset
        if (this.resetTimer !== null) {
            window.clearTimeout(this.resetTimer);
            this.resetTimer = null;
        }

        return isInstant;
    }

    /**
     * Mark a tooltip as being hidden
     * Resets the group after a delay if no other tooltips appear
     */
    hideTooltip(): void {
        // Reset the active group after a delay
        if (this.resetTimer !== null) {
            window.clearTimeout(this.resetTimer);
        }

        this.resetTimer = window.setTimeout(() => {
            this.activeGroup = null;
            this.resetTimer = null;
        }, this.RESET_DELAY);
    }

    /**
     * Force reset the tooltip state (e.g., when changing views)
     */
    reset(): void {
        if (this.resetTimer !== null) {
            window.clearTimeout(this.resetTimer);
            this.resetTimer = null;
        }
        this.activeGroup = null;
    }
}

// Export singleton instance
export const tooltipManager = new TooltipManager();

/**
 * React hook for managing tooltip state with instant subsequent tooltips
 * @param group - The tooltip group identifier
 * @returns Object with isInstant flag and show/hide handlers
 * 
 * @example
 * ```tsx
 * const { isInstant, onShow, onHide } = useTooltipGroup('inline-code');
 * 
 * <div 
 *   onMouseEnter={onShow}
 *   onMouseLeave={onHide}
 * >
 *   <span className={`tooltip ${isInstant ? '' : 'data-instant'}`}>
 *     Tooltip content
 *   </span>
 * </div>
 * ```
 */
export function useTooltipGroup(group: string) {
    const [isInstant, setIsInstant] = useState(false);

    const onShow = useCallback(() => {
        const instant = tooltipManager.showTooltip(group);
        setIsInstant(instant);
    }, [group]);

    const onHide = useCallback(() => {
        tooltipManager.hideTooltip();
    }, []);

    useEffect(() => {
        return () => {
            tooltipManager.reset();
        };
    }, []);

    return { isInstant, onShow, onHide };
}

// For non-React usage
export default tooltipManager;
