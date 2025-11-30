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
    <div className={`tools-popover-footer ${isTooManyTools ? 'tools-popover-footer--warning' : ''}`}>
        <div className="tools-popover-footer-left">
            {isTooManyTools && (
                <AlertTriangle size={12} className="tools-popover-warning-icon" />
            )}
            <span>
                {totalEnabledCount} of {totalToolCount} enabled
                {mcpToolsCount > 0 && (
                    <span className="tools-popover-mcp-count"> ({enabledMcpCount} MCP)</span>
                )}
                {webmcpToolsCount > 0 && (
                    <span className="tools-popover-webmcp-count"> ({enabledWebMCPCount} Web)</span>
                )}
            </span>
        </div>
        {isTooManyTools && (
            <span className="tools-popover-warning-text">Too many tools</span>
        )}
        <div className="tools-popover-info-wrapper">
            <button
                type="button"
                className="tools-popover-info-btn"
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
                        className="tools-popover-tooltip"
                    >
                        <strong>Active Tools</strong>
                        <p>Tools are capabilities the AI can use to help you. Fewer enabled tools = faster, more focused responses.</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    </div>
);
