/**
 * Handlers Index
 *
 * Barrel file for all external message handlers
 */

// Core handlers
export {
    handleLifecycleMessage,
    LIFECYCLE_MESSAGE_TYPES,
} from './lifecycleHandler';

export {
    handleOnboardingMessage,
    ONBOARDING_MESSAGE_TYPES,
} from './onboardingHandler';

export {
    handleReminderMessage,
    REMINDER_MESSAGE_TYPES,
} from './remindersHandler';

export {
    handleProviderMessage,
    PROVIDER_MESSAGE_TYPES,
} from './providersHandler';

export {
    handleDataOperationsMessage,
    DATA_OPERATIONS_MESSAGE_TYPES,
} from './dataOperationsHandler';

export {
    handleLoggerMessage,
    LOGGER_MESSAGE_TYPES,
} from './loggerHandler';

export {
    handleStoresMessage,
    STORES_MESSAGE_TYPES,
} from './storesHandler';

// Settings handlers (grouped)
export * from './settings';
