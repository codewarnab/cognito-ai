import '../../polyfills/process';
import { useState } from 'react';
import ReactDOM from 'react-dom/client';

function OptionsPage() {
    const [data, setData] = useState('');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', padding: 16 }}>
            <h1>
                Welcome to <a href="https://cognito.ai">Cognito AI</a>!
            </h1>
            <input onChange={(e) => setData(e.target.value)} value={data} />
            {/* TODO: Add actual settings UI here in future phases */}
        </div>
    );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <OptionsPage />
);
