/**
 * Context Indicator - Usage Example
 * 
 * This file demonstrates how to use the ContextIndicator component
 * in your chat interface.
 */

import { ContextIndicator } from './ContextIndicator';
import type { AppUsage } from '../../ai/types/usage';
import '../../styles/context-indicator.css'; // Import the CSS

// Example 1: Basic Usage with sample data
function ExampleBasicUsage() {
    const sampleUsage: AppUsage = {
        inputTokens: 1250,
        outputTokens: 850,
        totalTokens: 2100,
        context: {
            totalMax: 2_000_000,
            inputMax: 2_000_000,
            outputMax: 8192
        }
    };

    return (
        <div className="chat-input-container">
            {/* Position above file attachment button */}
            <ContextIndicator usage={sampleUsage} />

            {/* File attachment button */}
            <button className="file-attach-button">📎</button>
        </div>
    );
}

// Example 2: With cached tokens
function ExampleWithCache() {
    const usageWithCache: AppUsage = {
        inputTokens: 15000,
        outputTokens: 5000,
        totalTokens: 20000,
        cachedInputTokens: 50000, // Cached content
        context: {
            totalMax: 2_000_000,
            inputMax: 2_000_000,
            outputMax: 8192
        },
        modelId: 'gemini-2.5-flash'
    };

    return <ContextIndicator usage={usageWithCache} />;
}

// Example 3: High usage (will show red)
function ExampleHighUsage() {
    const highUsage: AppUsage = {
        inputTokens: 1_700_000,
        outputTokens: 50_000,
        totalTokens: 1_750_000, // 87.5% of limit
        context: {
            totalMax: 2_000_000,
            inputMax: 2_000_000,
            outputMax: 8192
        }
    };

    return <ContextIndicator usage={highUsage} />;
}

// Example 4: Integration in chat component
function ChatInputWithContext({ usage }: { usage: AppUsage | null }) {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px'
        }}>
            {/* Text input */}
            <input
                type="text"
                placeholder="Type your message..."
                style={{ flex: 1 }}
            />

            {/* Context indicator */}
            <ContextIndicator usage={usage} className="context-position" />

            {/* File button */}
            <button>📎</button>

            {/* Send button */}
            <button>Send</button>
        </div>
    );
}

export {
    ExampleBasicUsage,
    ExampleWithCache,
    ExampleHighUsage,
    ChatInputWithContext
};
