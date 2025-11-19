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
            <button
                type="button"
                className="attachment-dropdown-item"
                onClick={() => {
                    onFileClick();
                    onClose();
                }}
                disabled={isLocalMode}
                style={{
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
                }}
                onMouseEnter={(e) => {
                    if (!isLocalMode) {
                        e.currentTarget.style.backgroundColor = 'var(--dropdown-hover, #334155)';
                    }
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                }}
            >
                <PaperclipIcon size={18} />
                <span>File</span>
            </button>

            <button
                type="button"
                className="attachment-dropdown-item"
                onClick={() => {
                    onScreenshotClick();
                    onClose();
                }}
                disabled={isLocalMode}
                style={{
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
                }}
                onMouseEnter={(e) => {
                    if (!isLocalMode) {
                        e.currentTarget.style.backgroundColor = 'var(--dropdown-hover, #334155)';
                    }
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                }}
            >
                <CameraIcon size={18} />
                <span>Screenshot</span>
            </button>

            <button
                type="button"
                className="attachment-dropdown-item"
                onClick={() => {
                    onAddTabsClick();
                    onClose();
                }}
                disabled={isLocalMode}
                style={{
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
                }}
                onMouseEnter={(e) => {
                    if (!isLocalMode) {
                        e.currentTarget.style.backgroundColor = 'var(--dropdown-hover, #334155)';
                    }
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                }}
            >
                <TabsIcon size={18} />
                <span>Add tabs</span>
            </button>
        </div>
    );
};
