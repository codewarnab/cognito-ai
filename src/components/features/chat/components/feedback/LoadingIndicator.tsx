import React from 'react';
import { motion } from 'framer-motion';

const THINKING_MESSAGES = [
    'Thinking',
    'Still thinking',
    'Processing',
    'Analyzing',
    'Almost there',
    'Working on it',
    'Just a moment longer',
    'Putting it all together',
];

const MESSAGE_INTERVAL = 3000;

export const LoadingIndicator: React.FC = () => {
    const [messageIndex, setMessageIndex] = React.useState(0);

    React.useEffect(() => {
        const interval = setInterval(() => {
            setMessageIndex((prev) => (prev + 1) % THINKING_MESSAGES.length);
        }, MESSAGE_INTERVAL);
        return () => clearInterval(interval);
    }, []);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="copilot-message copilot-message-assistant"
        >
            <div className="copilot-message-bubble copilot-message-bubble-assistant">
                <span className="copilot-thinking-shimmer">
                    {THINKING_MESSAGES[messageIndex]}<span className="animate-pulse">...</span>
                </span>
            </div>
        </motion.div>
    );
};
