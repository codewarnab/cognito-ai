/**
 * DOM tool formatters
 * NOTE: analyzeDomFormatter removed - functionality unified into readPageContent
 */

import type { ActionFormatter } from '../types';
import { truncateText } from '../helpers';

export const executeScriptFormatter: ActionFormatter = ({ state, input, output }) => {
    const code = input?.code as string | undefined;
    const timeout = (input?.timeout as number) || 5000;

    if (state === 'loading') {
        const codeLength = code?.length || 0;
        const preview = code ? truncateText(code.trim().split('\n')[0] ?? '', 40) : 'script';

        return {
            action: 'Executing script',
            description: `${codeLength} chars • ${preview}${timeout !== 5000 ? ` • ${timeout}ms timeout` : ''}`
        };
    }

    if (state === 'success') {
        // Check if execution was successful
        if (output?.success === false) {
            // Script executed but returned error
            const errorMsg = (output?.error as string) || 'Unknown error';
            const suggestion = output?.suggestion as string | undefined;

            return {
                action: 'Script failed',
                description: suggestion
                    ? `${truncateText(errorMsg, 30)} • ${truncateText(suggestion, 40)}`
                    : truncateText(errorMsg, 50)
            };
        }

        // Success case
        const result = output?.result;
        const hasResult = result !== undefined;
        const resultType = hasResult ? typeof result : undefined;

        let description = 'Executed successfully';

        if (hasResult && result !== null) {
            if (resultType === 'object') {
                // Show object keys or array length
                const keys = Array.isArray(result)
                    ? `${result.length} items`
                    : `${Object.keys(result as object).length} properties`;
                description = `Returned ${resultType} • ${keys}`;
            } else if (resultType === 'string') {
                description = `Returned: ${truncateText(result as string, 40)}`;
            } else {
                description = `Returned ${resultType}: ${result}`;
            }
        }

        return {
            action: 'Script executed',
            description
        };
    }

    if (state === 'pending-approval') {
        const preview = code ? truncateText(code.trim().split('\n')[0] ?? '', 40) : 'script';
        return {
            action: 'Execute script',
            description: preview || 'Waiting for approval'
        };
    }

    const errorMsg = output?.error as string | undefined;
    return {
        action: 'Script execution failed',
        description: errorMsg ? truncateText(errorMsg, 50) : 'Unknown error'
    };
};
