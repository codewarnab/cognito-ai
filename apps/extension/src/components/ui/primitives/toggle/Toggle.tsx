import React from "react"

type ToggleSize = 'sm' | 'md'

const sizeStyles: Record<ToggleSize, { track: string; thumb: string; translate: string }> = {
    sm: {
        track: 'w-9 h-5',
        thumb: 'w-4 h-4',
        translate: 'peer-checked:translate-x-4'
    },
    md: {
        track: 'w-11 h-6',
        thumb: 'w-5 h-5',
        translate: 'peer-checked:translate-x-5'
    }
}

interface ToggleProps {
    checked: boolean
    onChange: (checked: boolean) => void
    label?: string
    disabled?: boolean
    size?: ToggleSize
}

export const Toggle: React.FC<ToggleProps> = ({
    checked,
    onChange,
    label,
    disabled = false,
    size = 'md'
}) => {
    const styles = sizeStyles[size]

    return (
        <label className={`flex items-center gap-2 cursor-pointer select-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <div className="relative">
                <input
                    type="checkbox"
                    className="peer absolute opacity-0 w-0 h-0"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                    disabled={disabled}
                    aria-checked={checked}
                />
                <div className={`${styles.track} bg-[#404040] rounded-full transition-colors duration-200 peer-checked:bg-[#3b82f6] peer-focus-visible:ring-2 peer-focus-visible:ring-[#3b82f6] peer-focus-visible:ring-offset-2`}></div>
                <div className={`absolute top-0.5 left-0.5 ${styles.thumb} bg-[#737373] rounded-full transition-all duration-200 shadow-sm peer-checked:bg-white ${styles.translate}`}></div>
            </div>
            {label && <span className="text-sm font-medium text-[#a3a3a3]">{label}</span>}
        </label>
    )
}
