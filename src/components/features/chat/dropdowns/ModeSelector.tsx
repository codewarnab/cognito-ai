import React, { useRef } from 'react';
import { CloudCogIcon, LaptopMinimalCheckIcon } from '../../../shared/effects/icons';
import { canSwitchMode } from '../../../../utils/modelSettings';
import type { AIMode, RemoteModelType, ModelState } from '../types';

interface ModeSelectorProps {
    modelState: ModelState;
    onModeChange: (mode: AIMode) => void;
    onModelChange: (model: RemoteModelType) => void;
    showModeDropdown: boolean;
    onToggleDropdown: (show: boolean) => void;
    onError?: (message: string, type?: 'error' | 'warning' | 'info') => void;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({
    modelState,
    onModeChange,
    onModelChange,
    showModeDropdown,
    onToggleDropdown,
    onError,
}) => {
    const { mode, remoteModel, hasApiKey, conversationStartMode } = modelState;

    const cloudCogRef = useRef<any>(null);
    const laptopIconRef = useRef<any>(null);
    const cloudCogDropdownActiveRef = useRef<any>(null);
    const cloudCogDropdownInactiveRef = useRef<any>(null);
    const laptopIconDropdownActiveRef = useRef<any>(null);
    const laptopIconDropdownInactiveRef = useRef<any>(null);

    const handleModeSwitch = async (newMode: AIMode) => {
        // Check if switch is allowed
        const allowed = await canSwitchMode(mode, newMode);

        if (!allowed) {
            if (onError) {
                onError(
                    'Cannot switch to Local mode. This conversation started with Remote mode and uses advanced features. Please start a new conversation to use Local mode.',
                    'warning'
                );
            }
            return;
        }

        // Check if remote mode has API key
        if (newMode === 'remote' && !hasApiKey) {
            if (onError) {
                onError(
                    'API Key Required. Please add your Gemini API key in Settings to use Remote mode.',
                    'warning'
                );
            }
            return;
        }

        onModeChange(newMode);
        onToggleDropdown(false);
    };

    // Get model display name
    const modelName = mode === 'local' ? 'Nano' : remoteModel.split('-').pop() || 'Flash';

    return (
        <div className="copilot-composer-options">
            {!showModeDropdown ? (
                <div className="mode-selector-inline">
                    <button
                        type="button"
                        className="copilot-mode-inline-button"
                        onClick={() => onToggleDropdown(true)}
                        title="Change AI mode"
                        onMouseEnter={() => {
                            if (mode === 'remote') {
                                cloudCogRef.current?.startAnimation();
                            } else {
                                laptopIconRef.current?.startAnimation();
                            }
                        }}
                        onMouseLeave={() => {
                            if (mode === 'remote') {
                                cloudCogRef.current?.stopAnimation();
                            } else {
                                laptopIconRef.current?.stopAnimation();
                            }
                        }}
                    >
                        {mode === 'local' ? (
                            <LaptopMinimalCheckIcon ref={laptopIconRef} size={14} />
                        ) : (
                            <CloudCogIcon ref={cloudCogRef} size={14} />
                        )}
                        <span className="mode-label">{mode === 'local' ? 'Local' : 'Cloud'}</span>
                    </button>
                </div>
            ) : (
                <div className="copilot-mode-expanded">
                    {mode === 'local' ? (
                        <>
                            <button
                                type="button"
                                className="copilot-mode-expanded-option active"
                                onClick={() => onToggleDropdown(false)}
                                onMouseEnter={() => laptopIconDropdownActiveRef.current?.startAnimation()}
                                onMouseLeave={() => laptopIconDropdownActiveRef.current?.stopAnimation()}
                            >
                                <LaptopMinimalCheckIcon ref={laptopIconDropdownActiveRef} size={14} />
                                Local
                            </button>
                            <button
                                type="button"
                                className="copilot-mode-expanded-option"
                                onClick={() => handleModeSwitch('remote')}
                                onMouseEnter={() => cloudCogDropdownInactiveRef.current?.startAnimation()}
                                onMouseLeave={() => cloudCogDropdownInactiveRef.current?.stopAnimation()}
                            >
                                <CloudCogIcon ref={cloudCogDropdownInactiveRef} size={14} />
                                Cloud
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                type="button"
                                className="copilot-mode-expanded-option active"
                                onClick={() => onToggleDropdown(false)}
                                onMouseEnter={() => cloudCogDropdownActiveRef.current?.startAnimation()}
                                onMouseLeave={() => cloudCogDropdownActiveRef.current?.stopAnimation()}
                            >
                                <CloudCogIcon ref={cloudCogDropdownActiveRef} size={14} />
                                Cloud
                            </button>
                            <button
                                type="button"
                                className="copilot-mode-expanded-option"
                                onClick={() => handleModeSwitch('local')}
                                onMouseEnter={() => laptopIconDropdownInactiveRef.current?.startAnimation()}
                                onMouseLeave={() => laptopIconDropdownInactiveRef.current?.stopAnimation()}
                            >
                                <LaptopMinimalCheckIcon ref={laptopIconDropdownInactiveRef} size={14} />
                                Local
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};
