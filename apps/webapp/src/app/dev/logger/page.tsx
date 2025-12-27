'use client';

import { Header } from '@/components/shared/Header';
import { LoggerPanel } from '@/components/settings/logger';
import { LogViewer } from '@/components/settings/logger/LogViewer';

export default function LoggerPage() {
    return (
        <>
            <Header title="Logger Config" />
            <div className="container mx-auto max-w-5xl py-8 px-4">
                <LoggerPanel />

                <div className="mt-8">
                    <h2 className="text-sm font-medium mb-3 text-[var(--text-secondary)] uppercase tracking-wide">Live Extension Logs</h2>
                    <LogViewer />
                </div>
            </div>
        </>
    );
}

// Prevent static generation in production
export const dynamic = 'force-dynamic';
