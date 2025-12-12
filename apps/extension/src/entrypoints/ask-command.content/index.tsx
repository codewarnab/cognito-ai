
import './style.css';
import ReactDOM from 'react-dom/client';
import App from './App';

export default defineContentScript({
    matches: ['<all_urls>'],
    allFrames: true,
    cssInjectionMode: 'ui',

    async main(ctx) {
        const ui = await createShadowRootUi(ctx, {
            name: 'cognito-ask-command',
            position: 'inline',
            anchor: 'body',
            mode: 'open',
            onMount: (container) => {
                const app = document.createElement('div');
                // Add class for styling scope if needed, though Shadow DOM handles it
                app.className = 'ask-command-root';
                container.append(app);
                const root = ReactDOM.createRoot(app);
                root.render(<App ctx={ctx} />);
                return root;
            },
            onRemove: (root) => {
                root?.unmount();
            },
        });

        ui.mount();
    },
});
