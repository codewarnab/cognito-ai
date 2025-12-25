'use client';

import { Header } from '@/components/shared/Header';
import { LoggerPanel } from '@/components/settings/logger';

export default function LoggerPage() {
    return (
        <>
            <Header title="Logger Config" />
            <div className="container mx-auto max-w-2xl py-8 px-4">
                <LoggerPanel />
            </div>
        </>
    );
}

// Prevent static generation in production
export const dynamic = 'force-dynamic';
