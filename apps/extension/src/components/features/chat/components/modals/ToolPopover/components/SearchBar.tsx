import React from 'react';
import { Search } from 'lucide-react';

interface SearchBarProps {
    value: string;
    onChange: (value: string) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ value, onChange }) => (
    <div style={{
        position: 'relative',
        padding: '8px',
        borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
    }}>
        <Search
            size={12}
            style={{
                position: 'absolute',
                left: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-tertiary, #6b7280)',
                pointerEvents: 'none',
            }}
        />
        <input
            style={{
                width: '100%',
                backgroundColor: 'var(--bg-tertiary, #1a2637)',
                border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                borderRadius: '6px',
                padding: '6px 8px 6px 28px',
                fontSize: '12px',
                color: 'var(--text-primary, white)',
                transition: 'border-color 0.15s',
                outline: 'none',
                boxSizing: 'border-box',
            }}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Search tools..."
            autoFocus
            onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-primary, #3b82f6)';
            }}
            onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color, rgba(255, 255, 255, 0.08))';
            }}
        />
    </div>
);
