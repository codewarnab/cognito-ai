'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface DevOnlyProps {
    children: React.ReactNode;
    fallbackPath?: string;
}

/**
 * Route guard component that only renders children in development mode.
 * Redirects to fallbackPath (default: '/') in production.
 *
 * @example
 * ```tsx
 * <DevOnly>
 *   <SomeDeveloperTool />
 * </DevOnly>
 * ```
 */
export function DevOnly({ children, fallbackPath = '/' }: DevOnlyProps) {
    const router = useRouter();
    const [isAllowed, setIsAllowed] = useState(false);

    useEffect(() => {
        const isDev = process.env.NODE_ENV === 'development';
        if (!isDev) {
            router.replace(fallbackPath);
        } else {
            setIsAllowed(true);
        }
    }, [router, fallbackPath]);

    if (!isAllowed) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[var(--bg-primary)]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    return <>{children}</>;
}
