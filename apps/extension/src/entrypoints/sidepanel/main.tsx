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






import '../../styles/features/onboarding/index.css';



// Core Styles (Moved from sidepanel.css)
import '../../styles/fonts.css';
import '../../styles/core/variables.css';
import '../../styles/core/animations.css';

// Feature Styles (To be migrated later, keeping for now)


// Main sidepanel styles (Migrated to inline/tailwind)
// import '../../sidepanel.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
