import React from 'react';
import { motion } from 'framer-motion';
import { TextShimmer } from '@/components/ui/TextShimmer';

const THINKING_MESSAGES = [
    'Thinking...',
    'Still thinking...',
    'Processing...',
    'Analyzing...',
    'Almost there...',
    'Working on it...',
    'Just a moment longer...',
    'Putting it all together...',
];

const MESSAGE_INTERVAL = 7000;

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
            <TextShimmer
                key={messageIndex}
                as="span"
                className="text-sm font-medium [--base-color:#a1a1aa] [--base-gradient-color:#ffffff]"
                duration={2}
                spread={2}
            >
                {THINKING_MESSAGES[messageIndex] ?? 'Thinking...'}
            </TextShimmer>
        </motion.div>
    );
};
