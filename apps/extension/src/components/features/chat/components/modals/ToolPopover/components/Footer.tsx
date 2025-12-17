import React from 'react';
import { Info, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FooterProps {
    totalEnabledCount: number;
    totalToolCount: number;
    enabledMcpCount: number;
    enabledWebMCPCount: number;
    mcpToolsCount: number;
    webmcpToolsCount: number;
    isTooManyTools: boolean;
    showInfoTooltip: boolean;
    onSetShowInfoTooltip: (show: boolean) => void;
}

export const Footer: React.FC<FooterProps> = ({
    totalEnabledCount,
    totalToolCount,
    enabledMcpCount,
    enabledWebMCPCount,
    mcpToolsCount,
    webmcpToolsCount,
    isTooManyTools,
    showInfoTooltip,
    onSetShowInfoTooltip,
}) => (
    <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 12px',
        borderTop: isTooManyTools
            ? '1px solid rgba(245, 158, 11, 0.2)'
            : '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
        fontSize: '10px',
        color: 'var(--text-tertiary, #6b7280)',
        backgroundColor: isTooManyTools
            ? 'rgba(245, 158, 11, 0.08)'
            : 'var(--bg-secondary, #0f1420)',
    }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {isTooManyTools && (
                <AlertTriangle
                    size={12}
                    style={{ color: 'var(--color-warning, #f59e0b)', flexShrink: 0 }}
                />
            )}
            <span>
                {totalEnabledCount} of {totalToolCount} enabled
                {mcpToolsCount > 0 && (
                    <span style={{ opacity: 0.7, fontSize: '9px' }}> ({enabledMcpCount} MCP)</span>
                )}
                {webmcpToolsCount > 0 && (
                    <span style={{ opacity: 0.7, fontSize: '9px' }}> ({enabledWebMCPCount} Web)</span>
                )}
            </span>
        </div>
        {isTooManyTools && (
            <span
                style={{
                    fontSize: '9px',
                    fontWeight: 500,
                    color: 'var(--color-warning, #f59e0b)',
                    padding: '2px 4px',
                    background: 'rgba(245, 158, 11, 0.15)',
                    borderRadius: '4px',
                    whiteSpace: 'nowrap',
                }}
                title="Too many tools enabled"
            >
                {mcpToolsCount > 0 && webmcpToolsCount > 0 ? 'Too many' : 'Too many tools'}
            </span>
        )}
        <div style={{ position: 'relative' }}>
            <button
                type="button"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    border: 'none',
                    background: 'none',
                    color: 'var(--text-tertiary, #6b7280)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                }}
                onMouseEnter={() => onSetShowInfoTooltip(true)}
                onMouseLeave={() => onSetShowInfoTooltip(false)}
                onClick={(e) => e.stopPropagation()}
                aria-label="Tool information"
            >
                <Info size={12} />
            </button>
            <AnimatePresence>
                {showInfoTooltip && (
                    <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        transition={{ duration: 0.15 }}
                        style={{
                            position: 'absolute',
                            bottom: 'calc(100% + 8px)',
                            right: 0,
                            width: '200px',
                            padding: '10px 12px',
                            backgroundColor: 'var(--bg-tertiary, #1a2637)',
                            border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                            borderRadius: '8px',
                            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
                            zIndex: 10,
                        }}
                    >
                        <strong style={{
                            display: 'block',
                            fontSize: '11px',
                            fontWeight: 600,
                            color: 'var(--text-primary, white)',
                            marginBottom: '4px',
                        }}>
                            Active Tools
                        </strong>
                        <p style={{
                            fontSize: '10px',
                            lineHeight: 1.4,
                            color: 'var(--text-secondary, #9ca3af)',
                            margin: 0,
                        }}>
                            Tools are capabilities the AI can use to help you. Fewer enabled tools = faster, more focused responses.
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    </div>
);
