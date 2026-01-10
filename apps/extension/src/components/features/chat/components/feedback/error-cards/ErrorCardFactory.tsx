import React from 'react';
import { ErrorCategory, getErrorCategory, type ErrorCardData, type BaseErrorCardProps } from './types';
import { AuthErrorCard } from './AuthErrorCard';
import { RateLimitErrorCard } from './RateLimitErrorCard';
import { NetworkErrorCard } from './NetworkErrorCard';
import { MCPErrorCard } from './MCPErrorCard';
import { StorageErrorCard } from './StorageErrorCard';
import { BrowserErrorCard } from './BrowserErrorCard';
import { GenericErrorCard } from './GenericErrorCard';

/**
 * Error Card Factory
 * Renders the appropriate error card based on error type/category
 */
export const ErrorCardFactory: React.FC<BaseErrorCardProps> = (props) => {
    const { data } = props;
    const category = getErrorCategory(data.errorCode);

    switch (category) {
        case ErrorCategory.AUTH:
            return <AuthErrorCard {...props} />;

        case ErrorCategory.RATE_LIMIT:
            return <RateLimitErrorCard {...props} />;

        case ErrorCategory.NETWORK:
            return <NetworkErrorCard {...props} />;

        case ErrorCategory.MCP:
            return <MCPErrorCard {...props} />;

        case ErrorCategory.STORAGE:
            return <StorageErrorCard {...props} />;

        case ErrorCategory.BROWSER:
            return <BrowserErrorCard {...props} />;

        case ErrorCategory.API:
        case ErrorCategory.UNKNOWN:
        default:
            return <GenericErrorCard {...props} />;
    }
};

// Re-export types and utilities
export type { ErrorCardData, BaseErrorCardProps };
export { ErrorCategory, getErrorCategory };
