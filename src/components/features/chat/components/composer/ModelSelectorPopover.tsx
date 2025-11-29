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
import '@/styles/features/copilot/model-selector-popover.css';

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
}

export const ModelSelectorPopover: React.FC<ModelSelectorPopoverProps> = ({ className }) => {
    const [isOpen, setIsOpen] = useState(false);
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
    const classNames = ['model-selector-popover-container', className].filter(Boolean).join(' ');

    return (
        <div className={classNames}>
            <button
                ref={buttonRef}
                type="button"
                className="model-selector-button"
                onClick={() => setIsOpen(!isOpen)}
                aria-label={`Current model: ${currentModel?.name || selectedModel}. Click to change.`}
                aria-expanded={isOpen}
                aria-haspopup="listbox"
            >
                <Gemini className="model-selector-icon" />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        ref={popoverRef}
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.96 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className="model-selector-popover"
                        role="listbox"
                        aria-label="Select AI model"
                    >
                        <div className="model-selector-popover-arrow" />
                        <div className="model-selector-popover-header">
                            <span className="model-selector-popover-title">Select Model</span>
                        </div>
                        <div className="model-selector-popover-content">
                            {MODEL_OPTIONS.map((model) => (
                                <button
                                    key={model.id}
                                    type="button"
                                    className={`model-selector-option ${selectedModel === model.id ? 'selected' : ''}`}
                                    onClick={() => handleModelChange(model.id)}
                                    disabled={isLoading}
                                    role="option"
                                    aria-selected={selectedModel === model.id}
                                >
                                    <div className="model-selector-option-info">
                                        <span className="model-selector-option-name">{model.name}</span>
                                        <span className="model-selector-option-desc">{model.description}</span>
                                    </div>
                                    {selectedModel === model.id && (
                                        <Check size={14} className="model-selector-option-check" />
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
