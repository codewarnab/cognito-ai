/**
 * Model Selector Popover Component
 * Circular Gemini icon button that opens a popover for model selection.
 * Syncs with ProviderSetup model configuration.
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gemini } from '@assets/brands/integrations/Gemini';
import { getModelConfig, setModelConfig } from '@/utils/ai/modelSettings';
import { createLogger } from '~logger';
import type { RemoteModelType } from '@/ai/types/types';

const log = createLogger('ModelSelectorPopover');

interface ModelOption {
    id: RemoteModelType;
    name: string;
    description: string;
}

const MODEL_OPTIONS: ModelOption[] = [
    {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        description: 'capable model for complex tasks',
    },
    {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        description: 'Fast and efficient for most tasks',
    },
    {
        id: 'gemini-3-pro-preview',
        name: 'Gemini 3.0 pro ',
        description: 'Most capable model ',
    },
];

interface ModelSelectorPopoverProps {
    className?: string;
    isOpen?: boolean;
    onOpenChange?: (isOpen: boolean) => void;
}

export const ModelSelectorPopover: React.FC<ModelSelectorPopoverProps> = ({
    className,
    isOpen: controlledIsOpen,
    onOpenChange
}) => {
    const [internalIsOpen, setInternalIsOpen] = useState(false);
    const isOpen = controlledIsOpen ?? internalIsOpen;
    const setIsOpen = onOpenChange ?? setInternalIsOpen;

    const [selectedModel, setSelectedModel] = useState<RemoteModelType>('gemini-2.5-flash');
    const [isLoading, setIsLoading] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    // Load current model from storage
    const loadModel = useCallback(async () => {
        try {
            const config = await getModelConfig();
            setSelectedModel(config.remoteModel);
        } catch (error) {
            log.error('Failed to load model config', error);
        }
    }, []);

    useEffect(() => {
        loadModel();

        // Listen for storage changes to sync with ProviderSetup
        const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
            if (areaName === 'local' && changes.ai_model_config) {
                const newConfig = changes.ai_model_config.newValue;
                if (newConfig?.remoteModel) {
                    setSelectedModel(newConfig.remoteModel);
                    log.info('Model synced from storage', { model: newConfig.remoteModel });
                }
            }
        };

        chrome.storage.onChanged.addListener(handleStorageChange);
        return () => {
            chrome.storage.onChanged.removeListener(handleStorageChange);
        };
    }, [loadModel]);

    // Close on click outside
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (
                popoverRef.current &&
                !popoverRef.current.contains(e.target as Node) &&
                buttonRef.current &&
                !buttonRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };

        const timeoutId = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscape);
        }, 0);

        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen]);

    const handleModelChange = async (model: RemoteModelType) => {
        if (model === selectedModel || isLoading) return;

        setIsLoading(true);
        try {
            await setModelConfig({ remoteModel: model });
            setSelectedModel(model);
            log.info('Model changed', { model });
            setIsOpen(false);
        } catch (error) {
            log.error('Failed to save model config', error);
        } finally {
            setIsLoading(false);
        }
    };

    const currentModel = MODEL_OPTIONS.find(m => m.id === selectedModel);

    return (
        <div className={`relative flex items-center ${className || ''}`}>
            <button
                ref={buttonRef}
                type="button"
                className="flex items-center justify-center w-[26px] h-[26px] rounded-md bg-transparent border-0 cursor-pointer transition-all duration-150 p-1 opacity-60 hover:opacity-100 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-[var(--color-primary,#3b82f6)] focus-visible:outline-offset-2 focus-visible:opacity-100"
                onClick={() => setIsOpen(!isOpen)}
                aria-label={`Current model: ${currentModel?.name || selectedModel}. Click to change.`}
                aria-expanded={isOpen}
                aria-haspopup="listbox"
            >
                <Gemini className="w-4 h-4" />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        ref={popoverRef}
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.96 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className="absolute bottom-[calc(100%+8px)] left-0 min-w-[220px] bg-[var(--bg-secondary,#0f172a)] border border-[var(--border-color,rgba(255,255,255,0.1))] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] z-[1000] overflow-hidden"
                        role="listbox"
                        aria-label="Select AI model"
                    >
                        <div className="absolute -bottom-1.5 left-4 rotate-45 w-3 h-3 bg-[var(--bg-secondary,#0f172a)] border-r border-b border-[var(--border-color,rgba(255,255,255,0.1))]" />
                        <div className="px-3 pt-2 pb-1.5 border-b border-[var(--border-color,rgba(255,255,255,0.08))]">
                            <span className="text-[10px] font-semibold text-[var(--text-tertiary,#6b7280)] uppercase tracking-[0.5px]">Select Model</span>
                        </div>
                        <div className="p-1">
                            {MODEL_OPTIONS.map((model) => (
                                <button
                                    key={model.id}
                                    type="button"
                                    className={`flex items-center justify-between w-full px-2.5 py-2 bg-transparent border-0 rounded-lg cursor-pointer transition-colors duration-150 text-left hover:bg-[var(--bg-tertiary,rgba(255,255,255,0.05))] focus-visible:outline-2 focus-visible:outline-[var(--color-primary,#3b82f6)] focus-visible:-outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${selectedModel === model.id ? 'bg-blue-500/10' : ''}`}
                                    onClick={() => handleModelChange(model.id)}
                                    disabled={isLoading}
                                    role="option"
                                    aria-selected={selectedModel === model.id}
                                >
                                    <div className="flex flex-col gap-0">
                                        <span className="text-[13px] font-medium text-[var(--text-primary,#ffffff)]">{model.name}</span>
                                        <span className="text-[10px] text-[var(--text-tertiary,#6b7280)]">{model.description}</span>
                                    </div>
                                    {selectedModel === model.id && (
                                        <Check size={14} className="text-[var(--color-primary,#3b82f6)] flex-shrink-0" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ModelSelectorPopover;
