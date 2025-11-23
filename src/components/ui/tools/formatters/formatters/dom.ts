/**
 * DOM tool formatters
 */

import type { ActionFormatter } from '../types';
import { truncateText } from '../helpers';

export const analyzeDomFormatter: ActionFormatter = ({ state, input, output }) => {
    const selector = input?.selector;
    const depth = input?.depth;

    if (state === 'loading') {
        return {
            action: 'Analyzing DOM',
            description: selector
                ? `Analyzing ${truncateText(selector, 30)} (depth: ${depth || 5})`
                : `Analyzing page structure (depth: ${depth || 5})`
        };
    }

    if (state === 'success') {
        const totalElements = output?.totalElements || 0;
        const interactive = output?.interactiveCounts;
        const shadowDom = output?.shadowDomCount || 0;

        // Build summary of interactive elements
        const interactiveSummary = interactive
            ? Object.entries(interactive)
                .filter(([_, count]) => (count as number) > 0)
                .map(([type, count]) => `${count} ${type}`)
                .slice(0, 3) // Show first 3 types
                .join(', ')
            : '';

        const description = [
            `${totalElements} elements`,
            interactiveSummary,
            shadowDom > 0 ? `${shadowDom} shadow roots` : ''
        ].filter(Boolean).join(' • ');

        return {
            action: 'DOM analyzed',
            description: description || `${totalElements} elements found`
        };
    }

    return {
        action: 'DOM analysis failed',
        description: output?.error ? truncateText(output.error, 50) : undefined
    };
};

export const executeScriptFormatter: ActionFormatter = ({ state, input, output }) => {
    const code = input?.code;
    const timeout = input?.timeout || 5000;

    if (state === 'loading') {
        const codeLength = code?.length || 0;
        const preview = code ? truncateText(code.trim().split('\n')[0], 40) : 'script';

        return {
            action: 'Executing script',
            description: `${codeLength} chars • ${preview}${timeout !== 5000 ? ` • ${timeout}ms timeout` : ''}`
        };
    }

    if (state === 'success') {
        // Check if execution was successful
        if (output?.success === false) {
            // Script executed but returned error
            const errorMsg = output?.error || 'Unknown error';
            const suggestion = output?.suggestion;

            return {
                action: 'Script failed',
                description: suggestion
                    ? `${truncateText(errorMsg, 30)} • ${truncateText(suggestion, 40)}`
                    : truncateText(errorMsg, 50)
            };
        }

        // Success case
        const hasResult = output?.result !== undefined;
        const resultType = hasResult ? typeof output.result : undefined;

        let description = 'Executed successfully';

        if (hasResult) {
            if (resultType === 'object' && output.result !== null) {
                // Show object keys or array length
                const keys = Array.isArray(output.result)
                    ? `${output.result.length} items`
                    : `${Object.keys(output.result).length} properties`;
                description = `Returned ${resultType} • ${keys}`;
            } else if (resultType === 'string') {
                description = `Returned: ${truncateText(output.result, 40)}`;
            } else {
                description = `Returned ${resultType}: ${output.result}`;
            }
        }

        return {
            action: 'Script executed',
            description
        };
    }

    return {
        action: 'Script execution failed',
        description: output?.error ? truncateText(output.error, 50) : 'Unknown error'
    };
};
