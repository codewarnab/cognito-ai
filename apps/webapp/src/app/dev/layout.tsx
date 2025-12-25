'use client';

import { DevOnly } from '@/components/shared/DevOnly';

export default function DevLayout({ children }: { children: React.ReactNode }) {
    return (
        <DevOnly>
            <div className="min-h-screen bg-[var(--bg-primary)]">
                {/* Dev Mode Banner */}
                <div className="bg-yellow-500/10 border-b border-yellow-500/20">
                    <div className="container mx-auto px-4 py-2">
                        <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                            🔧 Development Mode
                        </span>
                    </div>
                </div>
                {children}
            </div>
        </DevOnly>
    );
}
