/**
 * DOM Actions
 * Script execution capabilities (analyzeDom removed - now part of unified readPageContent)
 */

import { useExecuteScriptTool } from "./executeScript";

export function registerDomActions() {
    useExecuteScriptTool();
}
