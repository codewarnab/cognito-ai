import React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';

interface ToggleProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label?: string;
    disabled?: boolean;
    className?: string;
    size?: 'sm' | 'md';
}

export const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label, disabled, className = '', size = 'md' }) => {
    const id = label ? `toggle-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined;

    // Size configurations
    const sizes = {
        sm: { width: 28, height: 16, thumb: 12, translateOn: 13, translateOff: 2 },
        md: { width: 42, height: 25, thumb: 21, translateOn: 19, translateOff: 2 },
    };
    const s = sizes[size];

    return (
        <div className={`flex items-center gap-3 ${className}`}>
            <SwitchPrimitive.Root
                className="relative rounded-full cursor-pointer transition-colors duration-200 focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                    width: s.width,
                    height: s.height,
                    backgroundColor: checked ? 'var(--color-secondary, #3b82f6)' : 'var(--bg-tertiary, #202d3e)',
                    border: `1px solid ${checked ? 'var(--color-secondary, #3b82f6)' : 'var(--border-color, rgba(255, 255, 255, 0.1))'}`,
                    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
                    WebkitTapHighlightColor: 'rgba(0, 0, 0, 0)',
                }}
                checked={checked}
                onCheckedChange={onChange}
                disabled={disabled}
                id={id}
            >
                <SwitchPrimitive.Thumb
                    className="block bg-white rounded-full shadow-md transition-transform duration-100 will-change-transform"
                    style={{
                        width: s.thumb,
                        height: s.thumb,
                        transform: checked ? `translateX(${s.translateOn}px)` : `translateX(${s.translateOff}px)`,
                        boxShadow: '0 2px 2px rgba(0, 0, 0, 0.2)',
                    }}
                />
            </SwitchPrimitive.Root>
            {label && (
                <label
                    className="text-sm select-none cursor-pointer"
                    style={{ color: 'var(--text-primary, #e4e6eb)' }}
                    htmlFor={id}
                >
                    {label}
                </label>
            )}
        </div>
    );
};
