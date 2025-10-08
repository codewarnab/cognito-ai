/**
 * UI Components for History Page
 */

import React, { useCallback, useState } from 'react';
import type { DateRange, Toast, HistoryResultGroup, HistoryResultItem } from './types';
import { DatePreset } from './types';
import './privacy-controls.css';

// ============================================================================
// HeaderBar Component
// ============================================================================

interface HeaderBarProps {
    title: string;
    children?: React.ReactNode;
}

export function HeaderBar({ title, children }: HeaderBarProps) {
    return (
        <header className="history-header" role="banner">
            <h1 className="history-header-title">{title}</h1>
            {children}
        </header>
    );
}

// ============================================================================
// SearchInput Component
// ============================================================================

interface SearchInputProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit?: () => void;
    placeholder?: string;
    disabled?: boolean;
}

export function SearchInput({
    value,
    onChange,
    onSubmit,
    placeholder = 'Search your browsing history...',
    disabled = false,
}: SearchInputProps) {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && onSubmit) {
            onSubmit();
        }
    };

    const handleClear = () => {
        onChange('');
    };

    return (
        <div className="history-search-container">
            <label htmlFor="history-search-input" className="sr-only">
                Search history
            </label>
            <input
                id="history-search-input"
                type="text"
                className="history-search-input"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                aria-label="Search history"
                aria-describedby="search-instructions"
            />
            <span id="search-instructions" className="sr-only">
                Type to search, press Enter to submit. Use arrow keys to navigate results.
            </span>
            {value && (
                <button
                    type="button"
                    className="history-search-clear"
                    onClick={handleClear}
                    aria-label="Clear search"
                    title="Clear search"
                >
                    ✕
                </button>
            )}
        </div>
    );
}

// ============================================================================
// DateFilter Component
// ============================================================================

interface DateFilterProps {
    dateRange: DateRange;
    onChange: (range: DateRange) => void;
    disabled?: boolean;
}

export function DateFilter({ dateRange, onChange, disabled = false }: DateFilterProps) {
    const [preset, setPreset] = useState<DatePreset>(DatePreset.ALL);
    const [showCustom, setShowCustom] = useState(false);

    const handlePreset = (p: DatePreset) => {
        setPreset(p);
        const now = Date.now();

        switch (p) {
            case DatePreset.TODAY:
                onChange({
                    start: new Date().setHours(0, 0, 0, 0),
                    end: now,
                });
                setShowCustom(false);
                break;
            case DatePreset.WEEK:
                onChange({
                    start: now - 7 * 24 * 60 * 60 * 1000,
                    end: now,
                });
                setShowCustom(false);
                break;
            case DatePreset.MONTH:
                onChange({
                    start: now - 30 * 24 * 60 * 60 * 1000,
                    end: now,
                });
                setShowCustom(false);
                break;
            case DatePreset.ALL:
                onChange({ start: null, end: null });
                setShowCustom(false);
                break;
            case DatePreset.CUSTOM:
                setShowCustom(true);
                break;
        }
    };

    return (
        <div className="history-filter-group" role="group" aria-label="Date filter">
            <span className="history-filter-label">Date:</span>
            <button
                type="button"
                className={`history-filter-chip ${preset === DatePreset.TODAY ? 'active' : ''}`}
                onClick={() => handlePreset(DatePreset.TODAY)}
                disabled={disabled}
                aria-pressed={preset === DatePreset.TODAY}
            >
                Today
            </button>
            <button
                type="button"
                className={`history-filter-chip ${preset === DatePreset.WEEK ? 'active' : ''}`}
                onClick={() => handlePreset(DatePreset.WEEK)}
                disabled={disabled}
                aria-pressed={preset === DatePreset.WEEK}
            >
                Last 7 days
            </button>
            <button
                type="button"
                className={`history-filter-chip ${preset === DatePreset.MONTH ? 'active' : ''}`}
                onClick={() => handlePreset(DatePreset.MONTH)}
                disabled={disabled}
                aria-pressed={preset === DatePreset.MONTH}
            >
                Last 30 days
            </button>
            <button
                type="button"
                className={`history-filter-chip ${preset === DatePreset.ALL ? 'active' : ''}`}
                onClick={() => handlePreset(DatePreset.ALL)}
                disabled={disabled}
                aria-pressed={preset === DatePreset.ALL}
            >
                All time
            </button>
        </div>
    );
}

// ============================================================================
// DomainFilter Component
// ============================================================================

interface DomainFilterProps {
    domains: string[];
    onChange: (domains: string[]) => void;
    suggestions?: string[];
    disabled?: boolean;
}

export function DomainFilter({ domains, onChange, suggestions = [], disabled = false }: DomainFilterProps) {
    const [input, setInput] = useState('');

    const handleAdd = () => {
        const trimmed = input.trim().toLowerCase();
        if (trimmed && !domains.includes(trimmed)) {
            onChange([...domains, trimmed]);
            setInput('');
        }
    };

    const handleRemove = (domain: string) => {
        onChange(domains.filter((d) => d !== domain));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAdd();
        }
    };

    return (
        <div className="history-filter-group" role="group" aria-label="Domain filter">
            <span className="history-filter-label">Domains:</span>
            {domains.map((domain) => (
                <button
                    key={domain}
                    type="button"
                    className="history-filter-chip active"
                    onClick={() => handleRemove(domain)}
                    disabled={disabled}
                    aria-label={`Remove filter: ${domain}`}
                >
                    {domain}
                    <span className="remove-icon" aria-hidden="true">
                        ✕
                    </span>
                </button>
            ))}
            <input
                type="text"
                className="history-search-input"
                style={{ width: '200px', padding: '4px 12px', fontSize: '0.875rem' }}
                placeholder="Add domain..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleAdd}
                disabled={disabled}
                aria-label="Add domain filter"
            />
        </div>
    );
}

// ============================================================================
// FiltersBar Component
// ============================================================================

interface FiltersBarProps {
    dateRange: DateRange;
    domains: string[];
    onDateChange: (range: DateRange) => void;
    onDomainsChange: (domains: string[]) => void;
    disabled?: boolean;
}

export function FiltersBar({
    dateRange,
    domains,
    onDateChange,
    onDomainsChange,
    disabled = false,
}: FiltersBarProps) {
    return (
        <nav className="history-filters" aria-label="Search filters">
            <DateFilter dateRange={dateRange} onChange={onDateChange} disabled={disabled} />
            <DomainFilter domains={domains} onChange={onDomainsChange} disabled={disabled} />
        </nav>
    );
}

// ============================================================================
// PrivacyControls Component
// ============================================================================

interface PrivacyControlsProps {
    paused: boolean;
    domainAllowlist: string[];
    domainDenylist: string[];
    onPauseToggle: (paused: boolean) => void;
    onAllowlistUpdate: (domains: string[]) => void;
    onDenylistUpdate: (domains: string[]) => void;
    onDeleteAllData: (alsoRemoveModel: boolean) => void;
    disabled?: boolean;
}

export function PrivacyControls({
    paused,
    domainAllowlist,
    domainDenylist,
    onPauseToggle,
    onAllowlistUpdate,
    onDenylistUpdate,
    onDeleteAllData,
    disabled = false
}: PrivacyControlsProps) {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [removeModelFiles, setRemoveModelFiles] = useState(false);
    const [allowlistInput, setAllowlistInput] = useState('');
    const [denylistInput, setDenylistInput] = useState('');

    const handleDeleteClick = () => {
        setShowDeleteConfirm(true);
    };

    const handleConfirmDelete = () => {
        onDeleteAllData(removeModelFiles);
        setShowDeleteConfirm(false);
        setRemoveModelFiles(false);
    };

    const handleCancelDelete = () => {
        setShowDeleteConfirm(false);
        setRemoveModelFiles(false);
    };

    const normalizeHostname = (hostname: string): string => {
        try {
            const url = new URL(`https://${hostname.trim()}`);
            return url.hostname.toLowerCase();
        } catch {
            return hostname.trim().toLowerCase();
        }
    };

    const handleAllowlistKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && allowlistInput.trim()) {
            e.preventDefault();
            const normalized = normalizeHostname(allowlistInput);
            if (!domainAllowlist.includes(normalized)) {
                onAllowlistUpdate([...domainAllowlist, normalized]);
            }
            setAllowlistInput('');
        }
    };

    const handleDenylistKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && denylistInput.trim()) {
            e.preventDefault();
            const normalized = normalizeHostname(denylistInput);
            if (!domainDenylist.includes(normalized)) {
                onDenylistUpdate([...domainDenylist, normalized]);
            }
            setDenylistInput('');
        }
    };

    const removeFromAllowlist = (domain: string) => {
        onAllowlistUpdate(domainAllowlist.filter(d => d !== domain));
    };

    const removeFromDenylist = (domain: string) => {
        onDenylistUpdate(domainDenylist.filter(d => d !== domain));
    };

    return (
        <>
            <div className="history-privacy-controls">
                <div className="history-privacy-section">
                    <h3>Privacy Controls</h3>

                    <div className="history-control-group">
                        <label className="history-control-label">
                            <button
                                type="button"
                                className="history-toggle"
                                onClick={() => onPauseToggle(!paused)}
                                disabled={disabled}
                                aria-pressed={!paused}
                                aria-label={paused ? 'Resume collection' : 'Pause collection'}
                            >
                                <div className={`history-toggle-switch ${!paused ? 'active' : ''}`} aria-hidden="true">
                                    <div className="history-toggle-slider" />
                                </div>
                                <span>{paused ? 'Collection Paused' : 'Collection Active'}</span>
                            </button>
                        </label>
                        <p className="history-control-help">
                            When paused, no new pages will be indexed
                        </p>
                    </div>

                    <div className="history-control-group">
                        <label className="history-control-label">
                            Domain Allowlist (capture only these)
                        </label>
                        <div className="history-domain-tags">
                            {domainAllowlist.map(domain => (
                                <span key={domain} className="history-domain-tag">
                                    {domain}
                                    <button
                                        type="button"
                                        className="history-domain-tag-remove"
                                        onClick={() => removeFromAllowlist(domain)}
                                        aria-label={`Remove ${domain} from allowlist`}
                                    >
                                        ×
                                    </button>
                                </span>
                            ))}
                        </div>
                        <input
                            type="text"
                            className="history-domain-input"
                            placeholder="Add domain (e.g., example.com) and press Enter"
                            value={allowlistInput}
                            onChange={(e) => setAllowlistInput(e.target.value)}
                            onKeyDown={handleAllowlistKeyDown}
                            disabled={disabled}
                        />
                        <p className="history-control-help">
                            If set, only these domains will be captured
                        </p>
                    </div>

                    <div className="history-control-group">
                        <label className="history-control-label">
                            Domain Denylist (never capture these)
                        </label>
                        <div className="history-domain-tags">
                            {domainDenylist.map(domain => (
                                <span key={domain} className="history-domain-tag">
                                    {domain}
                                    <button
                                        type="button"
                                        className="history-domain-tag-remove"
                                        onClick={() => removeFromDenylist(domain)}
                                        aria-label={`Remove ${domain} from denylist`}
                                    >
                                        ×
                                    </button>
                                </span>
                            ))}
                        </div>
                        <input
                            type="text"
                            className="history-domain-input"
                            placeholder="Add domain (e.g., example.com) and press Enter"
                            value={denylistInput}
                            onChange={(e) => setDenylistInput(e.target.value)}
                            onKeyDown={handleDenylistKeyDown}
                            disabled={disabled}
                        />
                        <p className="history-control-help">
                            These domains will never be captured
                        </p>
                    </div>

                    <div className="history-control-group">
                        <button
                            type="button"
                            className="history-button history-button-danger"
                            onClick={handleDeleteClick}
                            disabled={disabled}
                            aria-label="Delete all data"
                        >
                            Delete All Data
                        </button>
                        <p className="history-control-help">
                            Permanently remove all stored pages, chunks, images, and search index
                        </p>
                    </div>
                </div>
            </div>

            {showDeleteConfirm && (
                <ConfirmModal
                    title="Delete All Data?"
                    message="This removes all stored pages, chunks, images, and search index. You can undo this action within 10 seconds."
                    onConfirm={handleConfirmDelete}
                    onCancel={handleCancelDelete}
                    confirmText="Delete All Data"
                    confirmDanger
                >
                    <label className="history-checkbox-label">
                        <input
                            type="checkbox"
                            checked={removeModelFiles}
                            onChange={(e) => setRemoveModelFiles(e.target.checked)}
                        />
                        <span>Also remove downloaded model files</span>
                    </label>
                </ConfirmModal>
            )}
        </>
    );
}

// ============================================================================
// ConfirmModal Component
// ============================================================================

interface ConfirmModalProps {
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
    confirmDanger?: boolean;
    children?: React.ReactNode;
}

export function ConfirmModal({
    title,
    message,
    onConfirm,
    onCancel,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    confirmDanger = false,
    children,
}: ConfirmModalProps) {
    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onCancel();
        }
    };

    return (
        <div
            className="history-modal-overlay"
            onClick={handleOverlayClick}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            aria-describedby="modal-content"
        >
            <div className="history-modal">
                <h2 id="modal-title" className="history-modal-title">
                    {title}
                </h2>
                <p id="modal-content" className="history-modal-content">
                    {message}
                </p>
                {children && (
                    <div className="history-modal-extra">
                        {children}
                    </div>
                )}
                <div className="history-modal-actions">
                    <button type="button" className="history-button" onClick={onCancel}>
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        className={`history-button ${confirmDanger ? 'history-button-danger' : ''}`}
                        onClick={onConfirm}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// ResultsSummary Component
// ============================================================================

interface ResultsSummaryProps {
    total: number;
    groupCount: number;
    activeFilters: { dateRange: DateRange; domains: string[] };
    onClearFilters: () => void;
}

export function ResultsSummary({ total, groupCount, activeFilters, onClearFilters }: ResultsSummaryProps) {
    const hasFilters = activeFilters.domains.length > 0 || activeFilters.dateRange.start !== null;

    return (
        <div className="history-results-summary" role="status" aria-live="polite">
            <div className="history-results-count">
                Found {total} {total === 1 ? 'result' : 'results'} in {groupCount} {groupCount === 1 ? 'group' : 'groups'}
            </div>
            {hasFilters && (
                <div className="history-active-filters">
                    <span className="history-filter-label">Active filters:</span>
                    {activeFilters.domains.map((domain) => (
                        <span key={domain} className="history-filter-chip">
                            {domain}
                        </span>
                    ))}
                    {activeFilters.dateRange.start && <span className="history-filter-chip">Custom date range</span>}
                    <button type="button" className="history-button" onClick={onClearFilters}>
                        Clear all filters
                    </button>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// ResultItem Component
// ============================================================================

interface ResultItemProps {
    item: HistoryResultItem;
    focused: boolean;
    onClick: (url: string) => void;
    onFocus: () => void;
}

export function ResultItem({ item, focused, onClick, onFocus }: ResultItemProps) {
    const handleClick = () => {
        onClick(item.url);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick(item.url);
        }
    };

    return (
        <div
            className={`history-result-item ${focused ? 'focused' : ''}`}
            role="listitem"
            tabIndex={focused ? 0 : -1}
            onClick={handleClick}
            onFocus={onFocus}
            onKeyDown={handleKeyDown}
            aria-label={`${item.title} - ${item.url}`}
        >
            <div className="history-result-title">{item.title || 'Untitled'}</div>
            <div className="history-result-snippet">{item.snippet}</div>
            <div className="history-result-url">{item.url}</div>
        </div>
    );
}

// ============================================================================
// ResultGroup Component
// ============================================================================

interface ResultGroupProps {
    group: HistoryResultGroup;
    groupIndex: number;
    focusedItemIndex: number;
    onToggleExpand: () => void;
    onOpenGroup: () => void;
    onItemClick: (url: string) => void;
    onItemFocus: (itemIndex: number) => void;
}

export function ResultGroup({
    group,
    groupIndex,
    focusedItemIndex,
    onToggleExpand,
    onOpenGroup,
    onItemClick,
    onItemFocus,
}: ResultGroupProps) {
    const displayItems = group.isExpanded ? group.items : group.items.slice(0, 3);
    const hasMore = group.totalItems > 3;

    return (
        <div className="history-result-group" role="group" aria-label={`Results from ${group.domain}`}>
            <div
                className="history-group-header"
                role="button"
                tabIndex={0}
                onClick={onToggleExpand}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onToggleExpand();
                    }
                }}
                aria-expanded={group.isExpanded}
                aria-label={`${group.domain} - ${group.totalItems} results. Press Enter to ${group.isExpanded ? 'collapse' : 'expand'}.`}
            >
                {group.favicon && (
                    <img src={group.favicon} alt="" className="history-group-favicon" aria-hidden="true" />
                )}
                <div className="history-group-info">
                    <div className="history-group-domain">{group.domain}</div>
                    <div className="history-group-count">
                        {group.totalItems} {group.totalItems === 1 ? 'result' : 'results'}
                    </div>
                </div>
                <div className="history-group-actions">
                    <button
                        type="button"
                        className="history-button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onOpenGroup();
                        }}
                        aria-label={`Open all ${group.totalItems} results from ${group.domain}`}
                    >
                        Open All
                    </button>
                </div>
            </div>

            <div role="list" aria-label={`Results from ${group.domain}`}>
                {displayItems.map((item, index) => (
                    <ResultItem
                        key={item.id}
                        item={item}
                        focused={focusedItemIndex === index}
                        onClick={onItemClick}
                        onFocus={() => onItemFocus(index)}
                    />
                ))}
            </div>

            {hasMore && !group.isExpanded && (
                <div style={{ padding: '12px', textAlign: 'center' }}>
                    <button type="button" className="history-button" onClick={onToggleExpand}>
                        Show {group.totalItems - 3} more
                    </button>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// EmptyState Component
// ============================================================================

interface EmptyStateProps {
    type: 'no-results' | 'model-not-ready' | 'paused' | 'no-query';
    onResume?: () => void;
}

export function EmptyState({ type, onResume }: EmptyStateProps) {
    const states = {
        'no-results': {
            icon: '🔍',
            title: 'No results found',
            message: 'Try adjusting your search terms or filters.',
        },
        'model-not-ready': {
            icon: '⚙️',
            title: 'Setting up search',
            message: 'The AI model is being prepared. This may take a few moments.',
        },
        paused: {
            icon: '⏸️',
            title: 'Collection paused',
            message: 'History collection is paused. You can still search existing data.',
        },
        'no-query': {
            icon: '💡',
            title: 'Start searching',
            message: 'Enter a search query to find pages in your browsing history.',
        },
    };

    const state = states[type];

    return (
        <div className="history-empty-state" role="status" aria-live="polite">
            <div className="history-empty-icon" aria-hidden="true">
                {state.icon}
            </div>
            <h2 className="history-empty-title">{state.title}</h2>
            <p className="history-empty-message">{state.message}</p>
            {type === 'paused' && onResume && (
                <button type="button" className="history-button" onClick={onResume}>
                    Resume Collection
                </button>
            )}
        </div>
    );
}

// ============================================================================
// Toast Component
// ============================================================================

interface ToastProps {
    toast: Toast;
    onClose: (id: string) => void;
}

export function ToastComponent({ toast, onClose }: ToastProps) {
    return (
        <div className={`history-toast ${toast.type}`} role="alert" aria-live="polite">
            <div className="history-toast-content">
                <div className="history-toast-message">{toast.message}</div>
                {toast.action && (
                    <button
                        type="button"
                        className="history-toast-action"
                        onClick={toast.action.onClick}
                    >
                        {toast.action.label}
                    </button>
                )}
            </div>
            <button
                type="button"
                className="history-toast-close"
                onClick={() => onClose(toast.id)}
                aria-label="Close notification"
            >
                ✕
            </button>
        </div>
    );
}

// ============================================================================
// ToastContainer Component
// ============================================================================

interface ToastContainerProps {
    toasts: Toast[];
    onClose: (id: string) => void;
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
    if (toasts.length === 0) return null;

    return (
        <div className="history-toast-container" aria-live="polite" aria-atomic="false">
            {toasts.map((toast) => (
                <ToastComponent key={toast.id} toast={toast} onClose={onClose} />
            ))}
        </div>
    );
}

// ============================================================================
// Banner Component
// ============================================================================

interface BannerProps {
    type: 'info' | 'warning' | 'error';
    message: string;
    action?: {
        label: string;
        onClick: () => void;
    };
}

export function Banner({ type, message, action }: BannerProps) {
    return (
        <div className={`history-banner ${type}`} role="alert" aria-live="polite">
            <div>{message}</div>
            {action && (
                <button type="button" className="history-button" onClick={action.onClick}>
                    {action.label}
                </button>
            )}
        </div>
    );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

export function LoadingSkeleton({ count = 3 }: { count?: number }) {
    return (
        <div className="history-results-list">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="history-skeleton history-skeleton-group" />
            ))}
        </div>
    );
}
