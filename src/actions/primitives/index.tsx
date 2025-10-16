/**
 * Primitive Actions Module
 * 
 * This module provides basic browser automation actions and utilities.
 * Each action is split into its own file for better maintainability.
 */

// Export utility functions
export * from "./utils";

// Export individual action hooks
export { useNavigateToAction } from "./navigateTo";
export { useWaitForPageLoadAction } from "./waitForPageLoad";
export { useWaitForSelectorAction } from "./waitForSelector";

// Import hooks for internal use
import { useNavigateToAction } from "./navigateTo";
import { useWaitForPageLoadAction } from "./waitForPageLoad";
import { useWaitForSelectorAction } from "./waitForSelector";

/**
 * Register all primitive actions
 * This function should be called to register all primitive actions at once
 */
export function registerPrimitiveActions() {
    useNavigateToAction();
    useWaitForPageLoadAction();
    useWaitForSelectorAction();
}
