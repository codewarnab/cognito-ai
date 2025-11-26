/**
 * Rewriter Presets Component
 * Quick action buttons for common rewrite operations
 */
import React from 'react';
import type { RewritePreset } from '@/types';

interface PresetConfig {
    id: RewritePreset;
    label: string;
    icon: React.ReactNode;
    color: string;
}

// Inline SVG icons for bundle size optimization
const Minimize2Icon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="4 14 10 14 10 20" />
        <polyline points="20 10 14 10 14 4" />
        <line x1="14" y1="10" x2="21" y2="3" />
        <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
);

const Maximize2Icon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="15 3 21 3 21 9" />
        <polyline points="9 21 3 21 3 15" />
        <line x1="21" y1="3" x2="14" y2="10" />
        <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
);

const BriefcaseIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
    </svg>
);

const SmileIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
        <line x1="9" y1="9" x2="9.01" y2="9" />
        <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
);

const SparklesIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
    </svg>
);

const ZapIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
);

const PRESETS: PresetConfig[] = [
    { id: 'shorter', label: 'Shorter', icon: <Minimize2Icon />, color: '#3b82f6' },
    { id: 'longer', label: 'Expand', icon: <Maximize2Icon />, color: '#8b5cf6' },
    { id: 'professional', label: 'Professional', icon: <BriefcaseIcon />, color: '#06b6d4' },
    { id: 'casual', label: 'Friendly', icon: <SmileIcon />, color: '#f59e0b' },
    { id: 'improve', label: 'Improve', icon: <SparklesIcon />, color: '#10b981' },
    { id: 'simplify', label: 'Simplify', icon: <ZapIcon />, color: '#ef4444' },
];

interface RewriterPresetsProps {
    onSelect: (preset: RewritePreset) => void;
    disabled?: boolean;
}

export function RewriterPresets({ onSelect, disabled = false }: RewriterPresetsProps) {
    return (
        <div className="rewriter-presets">
            {PRESETS.map((preset) => (
                <button
                    key={preset.id}
                    className="rewriter-preset-button"
                    onClick={() => onSelect(preset.id)}
                    disabled={disabled}
                    title={preset.label}
                    style={{
                        '--preset-color': preset.color,
                    } as React.CSSProperties}
                >
                    {preset.icon}
                    <span className="rewriter-preset-label">{preset.label}</span>
                </button>
            ))}
        </div>
    );
}
