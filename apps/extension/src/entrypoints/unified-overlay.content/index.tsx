/**
 * Unified Overlay Content Script
 * 
 * Combines text-rewriter, text-summarizer, and write-command into a single
 * content script to prevent bundling React and shared dependencies 3x.
 * 
 * Bundle size savings: ~10-15 MB (from ~20MB to ~7MB)
 */
import './style.css';
import './write-command.css';
import ReactDOM from 'react-dom/client';
import { UnifiedOverlayApp } from './UnifiedOverlayApp';

export default defineContentScript({
    matches: ['<all_urls>'],
    allFrames: true, // Inject in all frames for write-command iframe support
    cssInjectionMode: 'ui',

    async main(ctx) {
        const ui = await createShadowRootUi(ctx, {
            name: 'cognito-unified-overlay',
            position: 'overlay',
            anchor: 'body',
            mode: 'open',
            onMount: (container) => {
                const app = document.createElement('div');
                // Ensure Tailwind `.dark` variant + dark CSS vars apply inside shadow root
                app.className = 'cognito-overlay-root dark';
                container.append(app);
                const root = ReactDOM.createRoot(app);
                root.render(<UnifiedOverlayApp ctx={ctx} />);
                return root;
            },
            onRemove: (root) => {
                root?.unmount();
            },
        });

        ui.mount();
    },
});
