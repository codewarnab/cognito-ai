import React, { useRef, useEffect } from 'react';
import { PaperclipIcon } from '../../../shared/icons';
import { CameraIcon } from '../../../../../assets/icons/chat/camera';
import { TabsIcon } from '../../../../../assets/icons/chat/tabs';

interface AttachmentDropdownProps {
    onFileClick: () => void;
    onScreenshotClick: () => void;
    onAddTabsClick: () => void;
    onClose: () => void;
    isLocalMode: boolean;
}

interface ButtonConfig {
    label: string;
    icon: React.ComponentType<{ size: number }>;
    onClick: () => void;
}

export const AttachmentDropdown: React.FC<AttachmentDropdownProps> = ({
    onFileClick,
    onScreenshotClick,
    onAddTabsClick,
    onClose,
    isLocalMode,
}) => {
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const buttons: ButtonConfig[] = [
        { label: 'File', icon: PaperclipIcon, onClick: onFileClick },
        { label: 'Screenshot', icon: CameraIcon, onClick: onScreenshotClick },
        { label: 'Add tabs', icon: TabsIcon, onClick: onAddTabsClick },
    ];

    const buttonStyle: React.CSSProperties = {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 12px',
        border: 'none',
        background: 'transparent',
        borderRadius: '6px',
        cursor: isLocalMode ? 'not-allowed' : 'pointer',
        fontSize: '14px',
        color: isLocalMode ? 'var(--text-disabled, #64748b)' : 'var(--text-primary, #e2e8f0)',
        transition: 'background-color 0.15s ease',
        opacity: isLocalMode ? 0.5 : 1,
    };

    return (
        <div
            ref={dropdownRef}
            className="attachment-dropdown"
            style={{
                position: 'absolute',
                bottom: '100%',
                right: 0,
                marginBottom: '8px',
                backgroundColor: 'var(--dropdown-bg, #1e293b)',
                border: '1px solid var(--dropdown-border, #334155)',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                padding: '4px',
                minWidth: '160px',
                zIndex: 1000,
            }}
        >
            {buttons.map(({ label, icon: Icon, onClick }) => (
                <button
                    key={label}
                    type="button"
                    className="attachment-dropdown-item"
                    onClick={() => {
                        onClick();
                        onClose();
                    }}
                    disabled={isLocalMode}
                    style={buttonStyle}
                    onMouseEnter={(e) => {
                        if (!isLocalMode) {
                            e.currentTarget.style.backgroundColor = 'var(--dropdown-hover, #334155)';
                        }
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                >
                    <Icon size={18} />
                    <span>{label}</span>
                </button>
            ))}
        </div>
    );
};
