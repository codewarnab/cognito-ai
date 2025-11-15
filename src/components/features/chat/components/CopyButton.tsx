import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CopyIcon, type CopyIconHandle } from '../../../shared/icons/CopyIcon';

interface CopyButtonProps {
    content: string;
}

export const CopyButton: React.FC<CopyButtonProps> = ({ content }) => {
    const [copied, setCopied] = useState(false);
    const iconRef = useRef<CopyIconHandle>(null);

    const handleCopy = async () => {
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
        <div className="copy-message-button-wrapper">
            <button
                className="copy-message-button"
                onClick={handleCopy}
                title={copied ? 'Copied!' : 'Copy message'}
                aria-label={copied ? 'Copied!' : 'Copy message'}
            >
                <AnimatePresence mode="wait">
                    {copied ? (
                        <motion.svg
                            key="check"
                            xmlns="http://www.w3.org/2000/svg"
                            width={18}
                            height={18}
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
                            <CopyIcon ref={iconRef} size={18} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </button>
        </div>
    );
};
