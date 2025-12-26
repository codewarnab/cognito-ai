/**
 * Web App URL Constants
 * 
 * Centralized URLs for the Cognito webapp.
 * Uses localhost:3002 for development, production domain TBD.
 */

const isDev = process.env.NODE_ENV === 'development';

export const WEBAPP_BASE_URL = isDev
    ? 'http://localhost:3002'
    : 'https://app.cognito.ai';

export const WEBAPP_ROUTES = {
    ONBOARDING: `${WEBAPP_BASE_URL}/onboarding`,
    SETTINGS: `${WEBAPP_BASE_URL}/settings`,
    PROVIDERS: `${WEBAPP_BASE_URL}/providers`,
    REMINDERS: `${WEBAPP_BASE_URL}/reminders`,
    FEATURES: `${WEBAPP_BASE_URL}/features`,
    TROUBLESHOOTING: `${WEBAPP_BASE_URL}/troubleshooting`,
    CHANGELOG: `${WEBAPP_BASE_URL}/changelog`,
    UNINSTALLED: `${WEBAPP_BASE_URL}/uninstalled`,
    LOGGER: `${WEBAPP_BASE_URL}/dev/logger`,
} as const;

/**
 * Opens a webapp route in a new tab
 */
export function openWebappRoute(route: keyof typeof WEBAPP_ROUTES): void {
    chrome.tabs.create({ url: WEBAPP_ROUTES[route] });
}
