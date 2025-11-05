import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import type { RemoteModelType } from '../types';

interface ModelDropdownProps {
  currentModel: RemoteModelType;
  onModelChange: (model: RemoteModelType) => void;
  disabled?: boolean;
}

const MODEL_OPTIONS: { value: RemoteModelType; label: string; description: string }[] = [
  {
    value: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    description: 'High-performance model for general use.',
  },
  {
    value: 'gemini-2.5-flash-lite',
    label: 'Gemini 2.5 Flash Lite',
    description: 'Lightweight model for faster responses.',
  },
  {
    value: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    description: 'Advanced capabilities for complex tasks.',
  },
  {
    value: 'gemini-2.5-flash-image',
    label: 'Gemini 2.5 Flash Image',
    description: 'Optimized for image understanding and generation.',
  },
];

export const ModelDropdown: React.FC<ModelDropdownProps> = ({
  currentModel,
  onModelChange,
  disabled,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentOption = MODEL_OPTIONS.find(opt => opt.value === currentModel) || MODEL_OPTIONS[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className="model-dropdown-container" ref={dropdownRef}>
      <button
        className="model-dropdown-trigger"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        type="button"
      >
        <span className="model-name">{currentOption.label}</span>
        <ChevronDown size={14} className={`chevron ${isOpen ? 'open' : ''}`} />
      </button>

      {isOpen && (
        <div className="model-dropdown-menu">
          {MODEL_OPTIONS.map(option => (
            <button
              key={option.value}
              type="button"
              className={`model-option ${option.value === currentModel ? 'active' : ''}`}
              onClick={() => {
                onModelChange(option.value);
                setIsOpen(false);
              }}
            >
              <div className="model-option-label">{option.label}</div>
              <div className="model-option-description">{option.description}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
