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
                <div className="copilot-loading">
                    <div className="copilot-loading-dot" style={{ animationDelay: '0ms' }}></div>
                    <div className="copilot-loading-dot" style={{ animationDelay: '150ms' }}></div>
                    <div className="copilot-loading-dot" style={{ animationDelay: '300ms' }}></div>
                </div>
            </div>
        </motion.div>
    );
};
