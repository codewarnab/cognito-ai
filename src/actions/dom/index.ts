/**
 * DOM Actions
 * Deep DOM analysis and script execution capabilities
 */

import { useAnalyzeDomTool } from "./analyzeDom";
import { useExecuteScriptTool } from "./executeScript";

export function registerDomActions() {
    useAnalyzeDomTool();
    useExecuteScriptTool();
}
