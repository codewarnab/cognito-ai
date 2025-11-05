import React from "react"

interface ToggleProps {
    checked: boolean
    onChange: (checked: boolean) => void
    label?: string
    disabled?: boolean
}

export const Toggle: React.FC<ToggleProps> = ({
    checked,
    onChange,
    label,
    disabled = false
}) => {
    return (
        <label className="toggle-wrapper">
            <input
                type="checkbox"
                className="toggle-input"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                disabled={disabled}
                aria-checked={checked}
            />
            <span className="toggle-switch" aria-hidden="true">
                <span className="toggle-slider" />
            </span>
            {label && <span className="toggle-label">{label}</span>}
        </label>
    )
}
