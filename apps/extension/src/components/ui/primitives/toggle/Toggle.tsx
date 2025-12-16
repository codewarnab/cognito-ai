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
                <div className="w-11 h-6 bg-[#404040] rounded-full transition-colors duration-200 peer-checked:bg-[#3b82f6] peer-focus-visible:ring-2 peer-focus-visible:ring-[#3b82f6] peer-focus-visible:ring-offset-2"></div>
                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-[#737373] rounded-full transition-all duration-200 shadow-sm peer-checked:bg-white peer-checked:translate-x-5"></div>
            </div>
            {label && <span className="text-sm font-medium text-[#a3a3a3]">{label}</span>}
        </label>
    )
}
