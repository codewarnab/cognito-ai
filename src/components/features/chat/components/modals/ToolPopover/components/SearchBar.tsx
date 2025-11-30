import React from 'react';
import { Search } from 'lucide-react';

interface SearchBarProps {
    value: string;
    onChange: (value: string) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ value, onChange }) => (
    <div className="tools-popover-search">
        <Search size={12} className="tools-popover-search-icon" />
        <input
            className="tools-popover-search-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Search tools..."
            autoFocus
        />
    </div>
);
