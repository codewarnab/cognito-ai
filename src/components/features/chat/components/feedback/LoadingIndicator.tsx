import React from 'react';
import { motion } from 'framer-motion';

export const LoadingIndicator: React.FC = () => {
    return (
        <motion.div
            layout="position"
            layoutId="loading-message"
            transition={{ type: 'easeOut', duration: 0.2 }}
            className="copilot-message copilot-message-assistant"
        >
            <div className="copilot-message-bubble copilot-message-bubble-assistant">
                <div className="copilot-thinking-shimmer">
                    Thinking<span className="copilot-thinking-dots">...</span>
                </div>
            </div>
        </motion.div>
    );
};
