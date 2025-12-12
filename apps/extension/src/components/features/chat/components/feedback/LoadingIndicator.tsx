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

const MESSAGE_INTERVAL = 5000;

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
            className="flex gap-3 justify-start items-start py-1"
        >
            <div className="bg-transparent !text-[var(--text-primary)] !border-none !shadow-none !p-0 !rounded-none !max-w-full !text-base">
                <span
                    className="text-base font-medium bg-clip-text text-transparent bg-gradient-to-r from-white/40 via-white/90 to-white/40 bg-[length:200%_100%] animate-[shimmer_2s_linear_infinite]"
                    style={{
                        backgroundImage: 'linear-gradient(90deg, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.4) 40%, rgba(255, 255, 255, 0.9) 50%, rgba(255, 255, 255, 0.4) 60%, rgba(255, 255, 255, 0.4) 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                    }}
                >
                    {THINKING_MESSAGES[messageIndex]}<span className="animate-pulse">...</span>
                </span>
            </div>
        </motion.div>
    );
};
