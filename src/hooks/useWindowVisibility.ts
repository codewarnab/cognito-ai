import { useContext } from 'react';
import { WindowVisibilityContext } from '../contexts/WindowVisibilityContext';

/**
 * Hook to access window visibility state
 * @returns {Object} Object containing isUserAway boolean
 * @throws {Error} If used outside WindowVisibilityProvider
 */
export const useWindowVisibility = () => {
    const context = useContext(WindowVisibilityContext);
    if (context === undefined) {
        throw new Error('useWindowVisibility must be used within a WindowVisibilityProvider');
    }
    return context;
};
