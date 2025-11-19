/**
 * Screenshot tool formatter
 */

import type { ActionFormatter } from '../types';
import { truncateText } from '../helpers';

export const takeScreenshotFormatter: ActionFormatter = ({ state, input, output }) => {
    const title = output?.title;
    const url = output?.url;
    const reason = input?.reason;
    const hasScreenshot = !!output?.screenshot;
    const errorType = output?.errorType;
    const errorDetails = output?.errorDetails;

    if (state === 'loading') {
        return {
            action: 'Capturing screenshot',
            description: reason ? truncateText(reason, 40) : 'Analyzing visible page content'
        };
    }

    if (state === 'success' && hasScreenshot) {
        const viewport = output?.viewport;
        const viewportInfo = viewport?.width && viewport?.height
            ? ` (${viewport.width}×${viewport.height})`
            : '';

        return {
            action: 'Screenshot captured',
            description: title
                ? truncateText(`${title}${viewportInfo}`, 40)
                : (url ? truncateText(url, 40) : 'Page captured successfully')
        };
    }

    // Error states with specific context
    if (state === 'error' || !hasScreenshot) {
        let errorAction = 'Screenshot failed';
        let errorDescription = 'Unknown error';

        switch (errorType) {
            case 'PERMISSION_DENIED':
                errorAction = 'Permission denied';
                errorDescription = 'Missing activeTab permission';
                break;
            case 'NO_ACTIVE_TAB':
                errorAction = 'No active tab';
                errorDescription = 'No tab selected in window';
                break;
            case 'RESTRICTED_PAGE':
                errorAction = 'Restricted page';
                const scheme = output?.restrictedScheme || 'system';
                errorDescription = `Cannot capture ${scheme}:// pages`;
                break;
            case 'CAPTURE_FAILED':
            case 'CAPTURE_PERMISSION_DENIED':
                errorAction = 'Capture failed';
                errorDescription = errorDetails ? truncateText(errorDetails, 40) : 'Unable to capture tab';
                break;
            case 'TAB_NOT_ACTIVE':
                errorAction = 'Tab not visible';
                errorDescription = 'Tab must be active and visible';
                break;
            case 'WINDOW_STATE_ERROR':
                errorAction = 'Window issue';
                errorDescription = 'Window may be minimized';
                break;
            case 'INVALID_FORMAT':
                errorAction = 'Invalid data';
                errorDescription = 'Screenshot format error';
                break;
            case 'NO_URL':
                errorAction = 'Empty tab';
                errorDescription = 'Tab has no URL';
                break;
            default:
                if (output?.error) {
                    errorDescription = truncateText(output.error, 45);
                }
        }

        return {
            action: errorAction,
            description: errorDescription
        };
    }

    return {
        action: 'Screenshot incomplete',
        description: 'No image data received'
    };
};
