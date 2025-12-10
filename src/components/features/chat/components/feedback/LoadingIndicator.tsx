import React from 'react';
import { motion } from 'framer-motion';

const THINKING_MESSAGES = [
    'Thinking...',
    'Still thinking...',
    'Processing your request...',
    'Analyzing the details...',
    'Almost there...',
    'Working on it...',
    'Just a moment longer...',
    'Putting it all together...',
];

const MESSAGE_DELAY = 4; // 4 seconds between each message

export const LoadingIndicator: React.FC = () => {
    return (
        <motion.div
            layout="position"
            layoutId="loading-message"
            transition={{ type: 'easeOut', duration: 0.2 }}
            className="copilot-message copilot-message-assistant"
        >
            <div className="copilot-message-bubble copilot-message-bubble-assistant">
                <div className="copilot-thinking-shimmer" style={{ display: 'inline-grid' }}>
                    {THINKING_MESSAGES.map((message, index) => (
                        <motion.span
                            key={message}
                            style={{ gridArea: '1 / 1' }}
                            initial={{ opacity: index === 0 ? 1 : 0 }}
                            animate={{ opacity: [null, 0, 1, 1, 0] }}
                            transition={{
                                duration: MESSAGE_DELAY,
                                delay: index * MESSAGE_DELAY,
                                times: index === 0
                                    ? [0, 0.9, 0.9, 0.9, 1]
                                    : index === THINKING_MESSAGES.length - 1
                                        ? [0, 0, 0.1, 1, 1]
                                        : [0, 0, 0.1, 0.9, 1],
                            }}
                        >
                            {message}
                        </motion.span>
                    ))}
                </div>
            </div>
        </motion.div>
    );
};
