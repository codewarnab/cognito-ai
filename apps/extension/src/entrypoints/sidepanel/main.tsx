/**
 * WXT Sidepanel Entry Point
 * 
 * This file bootstraps the React application for the side panel.
 * Migrated from src/sidepanel.tsx auto-detection pattern.
 */

// Tailwind CSS - must be imported first for proper cascade
import '@assets/tailwind.css';

// Polyfill import - relative from src/entrypoints/sidepanel/ to src/polyfills/
import '../../polyfills/process';

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Import global styles (paths relative from src/entrypoints/sidepanel/)
// These are imported from src/styles/ directory
import '../../styles/features/copilot/index.css';
import '../../styles/features/mcp/index.css';
import '../../styles/features/mentions/index.css';
import '../../styles/features/threads/index.css';
import '../../styles/features/reminders/index.css';
import '../../styles/features/workflows/index.css';
import '../../styles/components/voice-recording-pill.css';
import '../../styles/features/onboarding/index.css';
import '../../styles/components/local-banner.css';
import '../../styles/components/model-download-toast.css';
import '../../styles/components/continue-button.css';
import '../../styles/components/context-indicator.css';
import '../../styles/components/context-warning.css';
import '../../styles/components/streaming-warning.css';
import '../../styles/components/error-toast.css';

// Main sidepanel styles (from src/sidepanel.css)
import '../../sidepanel.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
