import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, ChevronDown, ChevronUp, RotateCcw, RefreshCw } from 'lucide-react';
import type { BaseErrorCardProps } from './types';

/**
 * Network Error Card
 * Displayed for network-related issues (timeout, connection reset, DNS, etc.)
 * Uses cyan/teal theme with animated connection status
 */
export const NetworkErrorCard: React.FC<BaseErrorCardProps> = ({ data, onRetry, isLoading }) => {
    const [showDetails, setShowDetails] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    const title = data.title || 'Network Error';
    const message = data.userMessage || data.message || 'Unable to connect. Please check your internet connection.';

    const hasDetails = Boolean(
        (data.technicalDetails && data.technicalDetails.trim().length > 0) ||
        data.errorCode ||
        data.statusCode ||
        data.context
    );

    // Monitor online status
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Determine specific network error type for more helpful messaging
    const getNetworkErrorInfo = () => {
        switch (data.errorCode) {
            case 'NETWORK_TIMEOUT':
                return {
                    icon: <RefreshCw size={18} className="animate-spin-slow" />,
                    hint: 'The request took too long. The server might be slow or overloaded.',
                };
            case 'NETWORK_CONNECTION_RESET':
                return {
                    icon: <WifiOff size={18} />,
                    hint: 'Connection was interrupted. Your network might be unstable.',
                };
            case 'NETWORK_DNS_FAILED':
                return {
                    icon: <WifiOff size={18} />,
                    hint: 'Could not resolve the server address. Check your DNS settings.',
                };
            case 'NETWORK_UNREACHABLE':
                return {
                    icon: <WifiOff size={18} />,
                    hint: 'Server is unreachable. It might be down or blocked by firewall.',
                };
            default:
                return {
                    icon: isOnline ? <Wifi size={18} /> : <WifiOff size={18} />,
                    hint: isOnline
                        ? 'You appear to be online, but the service is not responding.'
                        : 'You appear to be offline. Please check your connection.',
                };
        }
    };

    const errorInfo = getNetworkErrorInfo();

    const handleRetry = () => {
        setRetryCount(prev => prev + 1);
        onRetry?.();
    };

    return (
        <div className="w-full max-w-[560px] rounded-xl border border-cyan-500/20 bg-gradient-to-b from-cyan-500/10 to-teal-500/5 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
            <div className="flex items-start gap-3">
                <div className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg border ${isOnline ? 'border-cyan-500/25 bg-cyan-500/10 text-cyan-200' : 'border-gray-500/25 bg-gray-500/10 text-gray-400'}`}>
                    {errorInfo.icon}
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <div className="text-[13px] font-semibold text-white/95">{title}</div>
                        <div className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${isOnline ? 'border-green-500/20 bg-green-500/10 text-green-300' : 'border-red-500/20 bg-red-500/10 text-red-300'}`}>
                            {isOnline ? 'Online' : 'Offline'}
                        </div>
                    </div>

                    <div className="mt-1 text-[12px] leading-relaxed text-white/80">
                        {message}
                    </div>

                    {/* Network status hint */}
                    <div className="mt-2 rounded-lg bg-cyan-500/5 p-2 text-[11px] text-cyan-200/80">
                        <p>{errorInfo.hint}</p>
                    </div>

                    {/* Auto-retry indicator */}
                    {data.retryable && (
                        <div className="mt-2 flex items-center gap-2 text-[11px] text-white/60">
                            <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
                            {isLoading ? 'Retrying...' : retryCount > 0 ? `Retried ${retryCount} time${retryCount > 1 ? 's' : ''}` : 'Auto-retry enabled'}
                        </div>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        {onRetry && (
                            <button
                                type="button"
                                disabled={isLoading}
                                onClick={handleRetry}
                                className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-cyan-500/20 px-3 py-2 text-[12px] font-medium text-cyan-100 ring-1 ring-inset ring-cyan-500/30 transition hover:bg-cyan-500/30 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <RotateCcw size={14} className={isLoading ? 'animate-spin' : ''} />
                                {isLoading ? 'Retrying...' : 'Try Again'}
                            </button>
                        )}

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
