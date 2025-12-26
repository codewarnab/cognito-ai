/**
 * Logger Middleware for Zustand
 * 
 * Logs state changes for debugging during development.
 */
import type { StateCreator } from 'zustand';
import { createLogger } from '~logger';

/**
 * Middleware that logs state changes
 */
export const storeLogger = <T extends object>(
  storeName: string
) => {
  const log = createLogger(`Store:${storeName}`, 'STORAGE_SYNC');

  return (f: StateCreator<T, [], []>): StateCreator<T, [], []> =>
    (set, get, store) => {
      const loggedSet: typeof set = (partial, replace) => {
        const prevState = get();
        if (replace === true) {
          set(partial as T, true);
        } else {
          set(partial, replace);
        }
        const nextState = get();
        
        // Only log in development
        if (process.env.NODE_ENV === 'development') {
          log.debug('State updated', {
            prev: prevState,
            next: nextState,
          });
        }
      };

      return f(loggedSet, get, store);
    };
};
