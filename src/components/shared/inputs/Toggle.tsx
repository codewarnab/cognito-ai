import React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import './Toggle.css';

interface ToggleProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label?: string;
    disabled?: boolean;
    className?: string;
}

export const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label, disabled, className = '' }) => {
    const id = label ? `toggle-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined;

    return (
        <div className={`toggle-container ${className}`}>
            <SwitchPrimitive.Root
                className="toggle-root"
                checked={checked}
                onCheckedChange={onChange}
                disabled={disabled}
                id={id}
            >
                <SwitchPrimitive.Thumb className="toggle-thumb" />
            </SwitchPrimitive.Root>
            {label && (
                <label
                    className="toggle-label-text"
                    htmlFor={id}
                >
                    {label}
                </label>
            )}
        </div>
    );
};
