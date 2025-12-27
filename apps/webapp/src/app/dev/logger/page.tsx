'use client';

import { Header } from '@/components/shared/Header';
import { LogConfigBar } from '@/components/settings/logger';
import { LogViewer } from '@/components/settings/logger/LogViewer';
import { MessageSandbox } from '@/components/dev/MessageSandbox';
import { StoreViewer } from '@/components/settings/logger/StoreViewer';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export default function LoggerPage() {
    return (
        <>
            <Header title="Dev Tools" />
            <div className="container mx-auto max-w-5xl py-8 px-4">
                <Tabs defaultValue="logs" className="w-full">
                    <div className="flex items-center justify-between mb-6">
                        <TabsList className="bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]">
                            <TabsTrigger value="logs" className="data-[state=active]:bg-[var(--bg-secondary)] data-[state=active]:text-[var(--text-primary)]">
                                Live Logs
                            </TabsTrigger>
                            <TabsTrigger value="stores" className="data-[state=active]:bg-[var(--bg-secondary)] data-[state=active]:text-[var(--text-primary)]">
                                Stores
                            </TabsTrigger>
                            <TabsTrigger value="sandbox" className="data-[state=active]:bg-[var(--bg-secondary)] data-[state=active]:text-[var(--text-primary)]">
                                Message Sandbox
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="stores" className="mt-0">
                        <div className="flex flex-col gap-2 mb-4">
                            <h2 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wide">Zustand Store Inspector</h2>
                            <p className="text-sm text-[var(--text-tertiary)]">Inspect the current state of Zustand stores used in the extension.</p>
                        </div>
                        <StoreViewer />
                    </TabsContent>

                    <TabsContent value="sandbox" className="mt-0">
                        <div className="flex flex-col gap-2 mb-4">
                            <h2 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wide">Extension Messaging Sandbox</h2>
                            <p className="text-sm text-[var(--text-tertiary)]">Test communication with the Chrome Extension by sending messages directly.</p>
                        </div>
                        <MessageSandbox />
                    </TabsContent>

                    <TabsContent value="logs" className="mt-0">
                        <div className="flex flex-col gap-2 mb-4">
                            <h2 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wide">Live Extension Logs</h2>
                            <p className="text-sm text-[var(--text-tertiary)]">Real-time log stream from the extension. Use the controls below to filter what gets logged.</p>
                        </div>
                        {/* Compact configuration bar - controls what gets logged */}
                        <LogConfigBar />
                        {/* Log viewer */}
                        <LogViewer />
                    </TabsContent>
                </Tabs>
            </div>
        </>
    );
}

// Prevent static generation in production
export const dynamic = 'force-dynamic';

