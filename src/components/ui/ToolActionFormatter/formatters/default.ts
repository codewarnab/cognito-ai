/**
 * Default formatter for tools without specific formatters
 */

import type { ActionFormatter } from '../types';
import { camelToTitle } from '../helpers';

export const defaultFormatter: ActionFormatter = (ctx) => {
    const { toolName, state } = ctx;
    const friendlyName = camelToTitle(toolName);

    if (state === 'loading') {
        return { action: friendlyName };
    }
    if (state === 'success') {
        return { action: friendlyName };
    }
    return { action: `${friendlyName} failed` };
};
