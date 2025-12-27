'use client';

import { DevOnly } from '@/components/shared/DevOnly';

export default function DevLayout({ children }: { children: React.ReactNode }) {
    return (
        <DevOnly>
            <div className="min-h-screen bg-[var(--bg-primary)]">
                {children}
            </div>
        </DevOnly>
    );
}
