/**
 * MicrophoneHelpPopover - Help guide for fixing microphone permissions
 */

import React from 'react';
import { CircleHelp } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '../../../ui/primitives/popover';

interface MicrophoneHelpPopoverProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const MicrophoneHelpPopover: React.FC<MicrophoneHelpPopoverProps> = ({
    open,
    onOpenChange
}) => {
    return (
        <Popover open={open} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>
                <button
                    className="voice-mode-mic-help-button"
                    title="How to fix microphone permission"
                    style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: 'rgba(59, 130, 246, 0.15)',
                        border: '1.5px solid rgba(59, 130, 246, 0.4)',
                        color: 'rgba(96, 165, 250, 1)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease',
                        padding: 0,
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(59, 130, 246, 0.25)';
                        e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.6)';
                        e.currentTarget.style.transform = 'scale(1.05)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)';
                        e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.4)';
                        e.currentTarget.style.transform = 'scale(1)';
                    }}
                >
                    <CircleHelp size={20} />
                </button>
            </PopoverTrigger>

            <PopoverContent
                align="end"
                side="bottom"
                sideOffset={10}
                avoidCollisions={true}
                collisionPadding={20}
                style={{
                    width: '380px',
                    background: 'rgba(15, 20, 35, 0.98)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '12px',
                    padding: '20px',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(59, 130, 246, 0.2)',
                    backdropFilter: 'blur(20px)',
                    color: 'white',
                    zIndex: 9999,
                    maxHeight: 'calc(100vh - 100px)',
                    overflowY: 'auto',
                }}
            >
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '16px'
                }}>
                    <h3 style={{
                        margin: 0,
                        fontSize: '16px',
                        fontWeight: '600',
                        color: 'rgba(96, 165, 250, 1)',
                    }}>
                        How to Fix Microphone Permission
                    </h3>
                    <button
                        onClick={() => onOpenChange(false)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'rgba(255, 255, 255, 0.6)',
                            fontSize: '24px',
                            cursor: 'pointer',
                            padding: 0,
                            lineHeight: 1,
                        }}
                    >
                        ×
                    </button>
                </div>

                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    color: 'rgba(255, 255, 255, 0.85)',
                }}>
                    <HelpStep number={1}>
                        <strong>Pin the extension</strong> by clicking the puzzle icon in your browser toolbar
                    </HelpStep>

                    <HelpStep number={2}>
                        <strong>Right-click</strong> on the Cognito extension icon
                    </HelpStep>

                    <HelpStep number={3}>
                        Click on <strong>"View web permissions"</strong>
                    </HelpStep>

                    <HelpStep number={4}>
                        Set the <strong>Microphone permission to "Allow"</strong>
                    </HelpStep>

                    <div style={{
                        marginTop: '8px',
                        padding: '12px',
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: '8px',
                        fontSize: '13px',
                    }}>
                        <strong style={{ color: 'rgba(52, 211, 153, 1)' }}>💡 Tip:</strong> After allowing permission reopen Voice Mode.
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
};

const HelpStep: React.FC<{ number: number; children: React.ReactNode }> = ({ number, children }) => (
    <div style={{ display: 'flex', gap: '12px' }}>
        <span style={{
            minWidth: '24px',
            height: '24px',
            borderRadius: '50%',
            background: 'rgba(59, 130, 246, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: '600',
            fontSize: '13px',
            color: 'rgba(96, 165, 250, 1)',
        }}>{number}</span>
        <p style={{ margin: 0 }}>{children}</p>
    </div>
);
