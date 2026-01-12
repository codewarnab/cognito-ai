/**
 * Tool Parts Merging Utility
 * 
 * Merges tool-call and tool-result parts by toolCallId to prevent
 * showing both loading and success icons for the same tool execution.
 * 
 * This is essential for MCP tools with longer wait times, ensuring:
 * - tool-call shows loading state (no result yet)
 * - tool-result shows success state (execution complete)
 * - Only the latest state is displayed
 * 
 * Handles both AI SDK format (tool-call/tool-result) and 
 * Gemini format (functionCall/functionResponse)
 */

/**
 * Check if a part is a tool call (AI SDK or Gemini format)
 * 
 * @param part - Message part to check
 * @returns True if the part represents a tool call
 */
const isToolCall = (part: any): boolean =>
    part.type === 'tool-call' ||
    part.type?.startsWith('tool-') ||
    part.type === 'dynamic-tool' ||
    part.functionCall !== undefined;

/**
 * Check if a part is a tool result (AI SDK or Gemini format)
 * 
 * @param part - Message part to check
 * @returns True if the part represents a tool result
 */
const isToolResult = (part: any): boolean =>
    part.type === 'tool-result' ||
    part.type === 'tool-output-available' ||
    part.functionResponse !== undefined;

/**
 * Extract toolCallId from various part formats
 * 
 * Supports:
 * - AI SDK format: part.toolCallId
 * - Gemini format: functionCall.name / functionResponse.name
 * 
 * @param part - Message part to extract ID from
 * @returns The tool call ID or undefined if not found
 */
const getToolCallId = (part: any): string | undefined => {
    if (part.toolCallId) return part.toolCallId;
    if (part.functionCall?.name) return `gemini-${part.functionCall.name}`;
    if (part.functionResponse?.name) return `gemini-${part.functionResponse.name}`;
    return undefined;
};

/**
 * Merge tool-call and tool-result parts by toolCallId
 * 
 * This function processes an array of message parts and merges
 * tool-call and tool-result parts that share the same toolCallId.
 * The result includes the input from tool-call and output from tool-result.
 * 
 * @param parts - Array of message parts to process
 * @returns Merged array with deduplicated tool parts
 * 
 * @example
 * ```ts
 * const parts = [
 *   { type: 'tool-call', toolCallId: 'abc', args: { query: 'test' } },
 *   { type: 'tool-result', toolCallId: 'abc', output: { result: 'done' } }
 * ];
 * const merged = mergeToolParts(parts);
 * // Result: single part with both args and output
 * ```
 */
export function mergeToolParts(parts: any[]): any[] {
    const toolMap = new Map<string, any>();
    const mergedParts: any[] = [];

    for (const part of parts) {
        // Handle text parts - always include without merging
        if (part.type === 'text') {
            mergedParts.push(part);
            continue;
        }

        // Handle tool parts - merge by toolCallId
        if (isToolCall(part) || isToolResult(part)) {
            const toolCallId = getToolCallId(part);

            if (!toolCallId) {
                // No ID available, can't merge - just add it as-is
                mergedParts.push(part);
                continue;
            }

            // Check if we've seen this tool before
            const existingTool = toolMap.get(toolCallId);

            if (!existingTool) {
                // First time seeing this tool - store and add to results
                toolMap.set(toolCallId, part);
                mergedParts.push(part);
            } else {
                // We've seen this tool before - merge the parts
                // tool-result/functionResponse should override tool-call/functionCall
                if (isToolResult(part)) {
                    // Replace the existing part with the result, preserving input data
                    const index = mergedParts.indexOf(existingTool);
                    if (index !== -1) {
                        // Merge input from tool-call with output from tool-result
                        const mergedPart = {
                            ...part,
                            args: existingTool.args || part.args,
                            input: existingTool.input || part.input || existingTool.functionCall?.args,
                        };
                        mergedParts[index] = mergedPart;
                        toolMap.set(toolCallId, mergedPart);
                    }
                } else if (isToolCall(existingTool) && isToolCall(part)) {
                    // Multiple tool-calls with same ID - keep the first one (duplicate)
                    continue;
                }
            }
            continue;
        }

        // Other part types (file, tab-context, data-status, etc.) - include as-is
        mergedParts.push(part);
    }

    return mergedParts;
}
