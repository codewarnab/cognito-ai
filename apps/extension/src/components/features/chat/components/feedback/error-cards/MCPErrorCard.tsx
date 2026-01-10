import React, { useState } from 'react';
import { Plug, ChevronDown, ChevronUp, RotateCcw, Settings } from 'lucide-react';
import type { BaseErrorCardProps } from './types';

/**
 * MCP Error Card
 * Displayed for Model Context Protocol server errors
 * Uses purple/violet theme with server status info
 */
export const MCPErrorCard: React.FC<BaseErrorCardProps> = ({ data, onRetry, isLoading }) => {
    const [showDetails, setShowDetails] = useState(false);

    const title = data.title || 'MCP Server Error';
    const message = data.userMessage || data.message || 'Unable to communicate with the MCP server.';

    const hasDetails = Boolean(
        (data.technicalDetails && data.technicalDetails.trim().length > 0) ||
        data.errorCode ||
        data.statusCode ||
        data.context
    );

    // Extract server name from metadata or message
    const serverName = data.metadata?.serverName || 'MCP Server';

    // Determine specific MCP error type
    const getMCPErrorInfo = () => {
        switch (data.errorCode) {
            case 'MCP_CONNECTION_FAILED':
                return {
                    status: 'Connection Failed',
                    statusColor: 'text-red-400 border-red-500/20 bg-red-500/10',
                    hint: 'Could not establish connection to the server. It may be offline or misconfigured.',
                };
            case 'MCP_AUTH_FAILED':
                return {
                    status: 'Auth Failed',
                    statusColor: 'text-amber-400 border-amber-500/20 bg-amber-500/10',
                    hint: 'Authentication failed. Check your credentials or re-authorize.',
                };
            case 'MCP_TOOL_EXECUTION_FAILED':
                return {
                    status: 'Tool Failed',
                    statusColor: 'text-orange-400 border-orange-500/20 bg-orange-500/10',
                    hint: 'The tool could not execute. Check permissions or try a different operation.',
                };
            case 'MCP_SERVER_UNAVAILABLE':
                return {
                    status: 'Unavailable',
                    statusColor: 'text-gray-400 border-gray-500/20 bg-gray-500/10',
                    hint: 'Server is temporarily unavailable. It may be under maintenance.',
                };
            case 'MCP_CLOUDFLARE_WORKER_ERROR':
                return {
                    status: 'Service Error',
                    statusColor: 'text-orange-400 border-orange-500/20 bg-orange-500/10',
                    hint: 'The service is experiencing issues. This is a temporary server-side problem.',
                };
            case 'MCP_TRANSPORT_ERROR':
                return {
                    status: 'Transport Error',
                    statusColor: 'text-cyan-400 border-cyan-500/20 bg-cyan-500/10',
                    hint: 'Communication error. Check your network connection.',
                };
            case 'MCP_INVALID_RESPONSE':
                return {
                    status: 'Invalid Response',
                    statusColor: 'text-yellow-400 border-yellow-500/20 bg-yellow-500/10',
                    hint: 'Received unexpected response from server. The server may be experiencing issues.',
                };
            default:
                return {
                    status: 'Error',
                    statusColor: 'text-purple-400 border-purple-500/20 bg-purple-500/10',
                    hint: 'An error occurred with the MCP server.',
                };
        }
    };

    const errorInfo = getMCPErrorInfo();

    return (
        <div className="w-full max-w-[560px] rounded-xl border border-purple-500/20 bg-gradient-to-b from-purple-500/10 to-violet-500/5 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
            <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg border border-purple-500/25 bg-purple-500/10 text-purple-200">
                    <Plug size={18} />
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <div className="text-[13px] font-semibold text-white/95">{title}</div>
                        <div className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${errorInfo.statusColor}`}>
                            {errorInfo.status}
                        </div>
                    </div>

                    {/* Server name badge */}
                    <div className="mt-1 flex items-center gap-2">
                        <span className="rounded bg-purple-500/10 px-1.5 py-0.5 text-[11px] font-medium text-purple-200">
                            {serverName}
                        </span>
                    </div>

                    <div className="mt-1.5 text-[12px] leading-relaxed text-white/80">
                        {message}
                    </div>

                    {/* Error-specific hint */}
                    <div className="mt-2 rounded-lg bg-purple-500/5 p-2 text-[11px] text-purple-200/80">
                        <p>{errorInfo.hint}</p>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        {onRetry && (
                            <button
                                type="button"
                                disabled={isLoading}
                                onClick={onRetry}
                                className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-purple-500/20 px-3 py-2 text-[12px] font-medium text-purple-100 ring-1 ring-inset ring-purple-500/30 transition hover:bg-purple-500/30 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <RotateCcw size={14} className={isLoading ? 'animate-spin' : ''} />
                                Retry
                            </button>
                        )}

                        <button
                            type="button"
                            className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-[12px] font-medium text-white/90 ring-1 ring-inset ring-white/10 transition hover:bg-white/15"
                        >
                            <Settings size={14} />
                            Configure
                        </button>

                        {hasDetails && (
                            <button
                                type="button"
                                onClick={() => setShowDetails(v => !v)}
                                className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-transparent px-3 py-2 text-[12px] font-medium text-white/65 ring-1 ring-inset ring-white/10 transition hover:bg-white/5 hover:text-white/85"
                            >
                                {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                Details
                            </button>
                        )}
                    </div>

                    {showDetails && hasDetails && (
                        <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3 text-[11px] leading-relaxed text-white/65">
                            {data.context && (
                                <div className="mb-2">
                                    <span className="text-white/55">Context:</span> {data.context}
                                </div>
                            )}
                            {data.errorCode && (
                                <div className="mb-2">
                                    <span className="text-white/55">Error Code:</span> {data.errorCode}
                                </div>
                            )}
                            {typeof data.statusCode === 'number' && (
                                <div className="mb-2">
                                    <span className="text-white/55">Status:</span> {data.statusCode}
                                </div>
                            )}
                            {data.technicalDetails && (
                                <pre className="whitespace-pre-wrap break-words font-mono text-[11px] text-white/65">
                                    {data.technicalDetails}
                                </pre>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
