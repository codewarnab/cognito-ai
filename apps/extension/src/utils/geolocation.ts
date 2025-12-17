/**
 * Interface definition for geolocation coordinates
 */
export interface GeoLocation {
    latitude: number;
    longitude: number;
}

/**
 * Custom error class for Geolocation errors
 */
export class GeolocationError extends Error {
    constructor(message: string, public code?: number) {
        super(message);
        this.name = 'GeolocationError';
    }
}

/**
 * Options for geolocation retrieval
 */
export interface GeolocationOptions {
    timeout?: number;
    enableHighAccuracy?: boolean;
    maximumAge?: number;
}

/**
 * Result type for geolocation requests
 */
export type GeolocationResult =
    | { success: true; location: GeoLocation }
    | { success: false; error: 'denied' | 'timeout' | 'unavailable' | 'unknown' };

/**
 * Check the status of geolocation permission
 * @returns Promise<'granted' | 'prompt' | 'denied'>
 */
export const checkLocationPermission = async (): Promise<PermissionState> => {
    if (!navigator.permissions || !navigator.permissions.query) {
        // Fallback for browsers without permissions API (though Chrome supports it)
        return 'prompt';
    }
    try {
        // @ts-ignore - name: 'geolocation' is correct but TS sometimes complains
        const result = await navigator.permissions.query({ name: 'geolocation' });
        return result.state;
    } catch (e) {
        console.warn('[Geolocation] Failed to query permission:', e);
        return 'prompt';
    }
};

/**
 * Watch for changes in geolocation permission state.
 * Useful for detecting when user revokes permission from browser settings.
 * 
 * @param callback Function to call when permission state changes
 * @returns Cleanup function to stop watching
 */
export const watchLocationPermission = (
    callback: (state: PermissionState) => void
): (() => void) => {
    if (!navigator.permissions || !navigator.permissions.query) {
        console.warn('[Geolocation] Permissions API not supported, cannot watch for changes');
        return () => { };
    }

    let permissionStatus: PermissionStatus | null = null;
    let isActive = true;

    const handleChange = function (this: PermissionStatus) {
        if (isActive) {
            console.log('[Geolocation] Permission state changed to:', this.state);
            callback(this.state);
        }
    };

    // Set up the listener
    navigator.permissions.query({ name: 'geolocation' as PermissionName })
        .then((status) => {
            if (!isActive) return;
            permissionStatus = status;
            status.addEventListener('change', handleChange);
        })
        .catch((e) => {
            console.warn('[Geolocation] Failed to set up permission watcher:', e);
        });

    // Return cleanup function
    return () => {
        isActive = false;
        if (permissionStatus) {
            permissionStatus.removeEventListener('change', handleChange);
        }
    };
};

/**
 * Promisified wrapper for navigator.geolocation.getCurrentPosition
 * Handles timeouts, permission denials, and unavailability.
 * 
 * @param options used to configure the geolocation request
 * @returns Promise<GeolocationResult> Returns success with coordinates, or failure with error reason
 */
export const getCurrentLocation = (
    options: GeolocationOptions = { timeout: 5000, enableHighAccuracy: false, maximumAge: 0 }
): Promise<GeolocationResult> => {
    return new Promise(async (resolve) => {
        // Check if we are in an extension page (Side Panel, Popup, etc.)
        // We can use the native API directly which allows permission prompts
        const isExtensionPage = typeof window !== 'undefined' &&
            window.location &&
            window.location.protocol === 'chrome-extension:';

        if (isExtensionPage) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        success: true,
                        location: {
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude
                        }
                    });
                },
                (error) => {
                    console.warn('[Geolocation] Direct request failed:', error);
                    // Map error codes to our error types
                    let errorType: 'denied' | 'timeout' | 'unavailable' | 'unknown';
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            errorType = 'denied';
                            break;
                        case error.TIMEOUT:
                            errorType = 'timeout';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            errorType = 'unavailable';
                            break;
                        default:
                            errorType = 'unknown';
                    }
                    resolve({ success: false, error: errorType });
                },
                options
            );
            return;
        }

        // Fallback for Content Scripts: Send message to background -> offscreen
        try {
            // Send message to background -> offscreen
            const response = await chrome.runtime.sendMessage({
                type: 'geolocation/request',
                payload: { options }
            });

            if (response && response.ok && response.location) {
                resolve({ success: true, location: response.location });
            } else {
                console.warn('[Geolocation] Offscreen request failed:', response?.error);
                // Try to determine error type from response
                const errorType = response?.errorType || 'unknown';
                resolve({ success: false, error: errorType });
            }
        } catch (error) {
            console.warn('[Geolocation] Failed to communicate with background:', error);
            resolve({ success: false, error: 'unknown' });
        }
    });
};

