/**
 * Error Boundary for Ask Command Content Script
 * Catches React rendering errors and displays a fallback UI
 */
import React from 'react';
import { createLogger } from '~logger';

const log = createLogger('AskCommandErrorBoundary');

interface ErrorBoundaryProps {
    children: React.ReactNode;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
    onClose?: () => void;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

/**
 * Error Boundary component that catches React rendering errors
 * in the Ask overlay and displays a user-friendly fallback
 */
export class AskCommandErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        log.error('Ask overlay crashed', {
            error: error.message,
            componentStack: errorInfo.componentStack?.slice(0, 500),
        });

        this.props.onError?.(error, errorInfo);
    }

    handleRetry = (): void => {
        this.setState({ hasError: false, error: null });
    };

    handleClose = (): void => {
        this.setState({ hasError: false, error: null });
        this.props.onClose?.();
    };

    override render(): React.ReactNode {
        if (this.state.hasError) {
            return (
                <div
                    className="ask-overlay ask-error-boundary"
                    style={{
                        position: 'fixed',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        zIndex: 2147483647,
                    }}
                    role="alert"
                    aria-label="Ask command error"
                >
                    <div className="ask-header">
                        <span className="ask-title">Ask Error</span>
                        <button
                            type="button"
                            className="ask-close"
                            onClick={this.handleClose}
                            aria-label="Close"
                        >
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                    </div>
                    <div className="ask-error" style={{ margin: '12px' }}>
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 8v4M12 16h.01" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span>Something went wrong. Please try again.</span>
                        <button type="button" className="ask-error-retry" onClick={this.handleRetry}>
                            Retry
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
