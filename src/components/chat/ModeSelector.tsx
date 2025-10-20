import React, { useRef } from 'react';
import { CloudCogIcon } from '../CloudCogIcon';
import { LaptopMinimalCheckIcon } from '../LaptopMinimalCheckIcon';
import type { ExecutionMode } from './types';

interface ModeSelectorProps {
    executionMode: ExecutionMode;
    showModeDropdown: boolean;
    onExecutionModeChange: (mode: ExecutionMode) => void;
    onToggleDropdown: (show: boolean) => void;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({
    executionMode,
    showModeDropdown,
    onExecutionModeChange,
    onToggleDropdown,
}) => {
    const cloudCogRef = useRef<any>(null);
    const laptopIconRef = useRef<any>(null);
    const cloudCogDropdownActiveRef = useRef<any>(null);
    const cloudCogDropdownInactiveRef = useRef<any>(null);
    const laptopIconDropdownActiveRef = useRef<any>(null);
    const laptopIconDropdownInactiveRef = useRef<any>(null);

    return (
        <div className="copilot-composer-options">
            {!showModeDropdown ? (
                <button
                    type="button"
                    className="copilot-mode-inline-button"
                    onClick={() => onToggleDropdown(true)}
                    title="Execution mode"
                    onMouseEnter={() => {
                        if (executionMode === 'cloud') {
                            cloudCogRef.current?.startAnimation();
                        } else {
                            laptopIconRef.current?.startAnimation();
                        }
                    }}
                    onMouseLeave={() => {
                        if (executionMode === 'cloud') {
                            cloudCogRef.current?.stopAnimation();
                        } else {
                            laptopIconRef.current?.stopAnimation();
                        }
                    }}
                >
                    {executionMode === 'local' ? (
                        <LaptopMinimalCheckIcon ref={laptopIconRef} size={14} />
                    ) : (
                        <CloudCogIcon ref={cloudCogRef} size={14} />
                    )}
                    <span>{executionMode === 'local' ? 'Local' : 'Cloud'}</span>
                </button>
            ) : (
                <div className="copilot-mode-expanded">
                    {executionMode === 'local' ? (
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
                                onClick={() => {
                                    onExecutionModeChange('cloud');
                                    onToggleDropdown(false);
                                }}
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
                                onClick={() => {
                                    onExecutionModeChange('local');
                                    onToggleDropdown(false);
                                }}
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
