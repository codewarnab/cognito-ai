import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CopyIcon, type CopyIconHandle } from '@/components/shared/icons/CopyIcon';

interface UserMessageCopyButtonProps {
    content: string;
}

export const UserMessageCopyButton: React.FC<UserMessageCopyButtonProps> = ({ content }) => {
    const [copied, setCopied] = useState(false);
    const iconRef = useRef<CopyIconHandle>(null);

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent triggering parent click handlers
        if (!content) return;

        try {
            await navigator.clipboard.writeText(content);
            setCopied(true);
            iconRef.current?.startAnimation();

            setTimeout(() => {
                setCopied(false);
                iconRef.current?.stopAnimation();
            }, 2000);
        } catch (err) {
            console.error('Failed to copy message:', err);
        }
    };

    return (
        <button
            className="flex items-center justify-center w-6 h-6 p-0 bg-transparent border-none text-white/40 cursor-pointer transition-all duration-150 rounded hover:text-white/80 hover:bg-white/10 active:scale-90"
            onClick={handleCopy}
            title={copied ? 'Copied!' : 'Copy message'}
            aria-label={copied ? 'Copied!' : 'Copy message'}
        >
            <AnimatePresence mode="wait">
                {copied ? (
                    <motion.svg
                        key="check"
                        xmlns="http://www.w3.org/2000/svg"
                        width={14}
                        height={14}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0, rotate: 180 }}
                        transition={{
                            type: 'spring',
                            stiffness: 200,
                            damping: 15
                        }}
                    >
                        <polyline points="20 6 9 17 4 12" />
                    </motion.svg>
                ) : (
                    <motion.div
                        key="copy"
                        initial={{ scale: 0, rotate: 180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0, rotate: -180 }}
                        transition={{
                            type: 'spring',
                            stiffness: 200,
                            damping: 15
                        }}
                    >
                        <CopyIcon ref={iconRef} size={14} />
                    </motion.div>
                )}
            </AnimatePresence>
        </button>
    );
};
