/**
 * History Search Page - Main Exports
 */

// Main page component
export { default as HistoryPage } from './index';

// Hooks
export { useSettings } from './useSettings';
export { useHistorySearch } from './useHistorySearch';
export { useKeyboardNav } from './useKeyboardNav';
export { useVirtualWindow } from './useVirtualWindow';

// Components
export {
    HeaderBar,
    SearchInput,
    FiltersBar,
    DateFilter,
    DomainFilter,
    PrivacyControls,
    ConfirmModal,
    ResultsSummary,
    ResultItem,
    ResultGroup,
    EmptyState,
    ToastComponent,
    ToastContainer,
    Banner,
    LoadingSkeleton,
} from './components';

// Types
export type {
    HistoryResultItem,
    HistoryResultGroup,
    DateRange,
    SearchFilters,
    HistorySettings,
    HistoryMessage,
    HistoryResponse,
    SearchPortMessage,
    Toast,
} from './types';

export { DatePreset } from './types';
