/**
 * Dexie IndexedDB Layer for Extension
 * 
 * This module re-exports all database functionality from split modules
 * for backward compatibility. All existing imports from '~/db' will continue to work.
 */

// Types and Interfaces
export * from './types';

// Database class and instance
export * from './database';

// Settings API
export * from './settings';

// Chat Threads API
export * from './threads';

// Chat Messages API
export * from './messages';

// Database Management
export * from './management';

// Token Usage Tracking
export * from './usage';

// Report Sections API
export * from './reportSections';

// Research Sources API + Session Management
export * from './researchSources';

// Stored PDFs API
export * from './storedPDFs';

// Default export
export { default } from './database';
