'use client';

import React, { useState } from 'react';
import { Send, PlayCircle, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ExternalMessageType } from '@cognito/shared';

// Use environment variable for extension ID
const EXTENSION_ID = process.env.NEXT_PUBLIC_EXTENSION_ID;

const MESSAGE_TYPES: ExternalMessageType[] = [
    'PING',
    'GET_ONBOARDING_STATUS',
    'GET_ALL_SETTINGS',
    'GET_PROVIDER_CONFIG',
    'GET_PROVIDERS_CONFIG',
    'GET_REMINDERS',
    'GET_SEARCH_SETTINGS',
    'GET_ASK_AI_SETTINGS',
    'GET_SUMMARIZER_SETTINGS',
    'GET_REWRITER_SETTINGS',
    'GET_WRITE_SETTINGS',
    'GET_SUPERMEMORY_SETTINGS',
    'GET_RESEARCH_SETTINGS',
    'GET_TTS_SETTINGS',
    'GET_VOICE_SETTINGS',
    'GET_AI_CONFIG',
    'LOGGER_CONFIG_REQUEST',
    'GET_STORES_STATE'
];

export function MessageSandbox() {
    const [selectedType, setSelectedType] = useState<ExternalMessageType | 'CUSTOM'>('PING');
    const [customType, setCustomType] = useState('');
    const [payload, setPayload] = useState('{}');
    const [response, setResponse] = useState<string | null>(null);
    const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
    const [responseTime, setResponseTime] = useState<number | null>(null);

    const handleSend = async () => {
        if (!EXTENSION_ID) {
            setResponse('Error: NEXT_PUBLIC_EXTENSION_ID not configured');
            setStatus('error');
            return;
        }

        if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
            setResponse('Error: Chrome runtime API not available');
            setStatus('error');
            return;
        }

        const type = selectedType === 'CUSTOM' ? customType : selectedType;
        if (!type) {
            setResponse('Error: Message type is required');
            setStatus('error');
            return;
        }

        let parsedPayload;
        try {
            parsedPayload = JSON.parse(payload);
        } catch (e) {
            setResponse('Error: Invalid JSON payload');
            setStatus('error');
            return;
        }

        setStatus('sending');
        setResponse(null);
        setResponseTime(null);
        const startTime = performance.now();

        try {
            console.log(`[Sandbox] Sending message to ${EXTENSION_ID}:`, { type, payload: parsedPayload });

            chrome.runtime.sendMessage(
                EXTENSION_ID,
                { type, payload: parsedPayload },
                (res) => {
                    const endTime = performance.now();
                    setResponseTime(Math.round(endTime - startTime));

                    const lastError = chrome.runtime.lastError;
                    if (lastError) {
                        console.error('[Sandbox] Runtime error:', lastError);
                        setResponse(JSON.stringify({ error: lastError.message }, null, 2));
                        setStatus('error');
                    } else {
                        console.log('[Sandbox] Received response:', res);
                        setResponse(JSON.stringify(res, null, 2));
                        setStatus('success');
                    }
                }
            );
        } catch (e) {
            const endTime = performance.now();
            setResponseTime(Math.round(endTime - startTime));
            console.error('[Sandbox] Exception:', e);
            setResponse(JSON.stringify({ error: String(e) }, null, 2));
            setStatus('error');
        }
    };

    return (
        <div className="flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-xl border border-[var(--border-color)] overflow-hidden shadow-sm mt-8">
            <div className="flex items-center p-3 border-b border-[var(--border-color)] bg-[var(--bg-secondary)] gap-3">
                <div className="flex items-center gap-2">
                    <PlayCircle size={16} className="text-[var(--text-secondary)]" />
                    <span className="text-sm font-medium text-[var(--text-secondary)]">Message Sandbox</span>
                </div>
            </div>

            <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Request Column */}
                <div className="flex flex-col gap-4">
                    <div>
                        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                            Message Type
                        </label>
                        <select
                            value={selectedType}
                            onChange={(e) => setSelectedType(e.target.value as any)}
                            className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-md text-sm focus:outline-none focus:border-[var(--text-secondary)]"
                        >
                            {MESSAGE_TYPES.map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                            <option value="CUSTOM">Custom...</option>
                        </select>
                    </div>

                    {selectedType === 'CUSTOM' && (
                        <div>
                            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                                Custom Type
                            </label>
                            <input
                                type="text"
                                value={customType}
                                onChange={(e) => setCustomType(e.target.value)}
                                placeholder="e.g. MY_CUSTOM_ACTION"
                                className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-md text-sm focus:outline-none focus:border-[var(--text-secondary)]"
                            />
                        </div>
                    )}

                    <div className="flex-1 flex flex-col">
                        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                            Payload (JSON)
                        </label>
                        <textarea
                            value={payload}
                            onChange={(e) => setPayload(e.target.value)}
                            className="flex-1 w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-md text-sm font-mono focus:outline-none focus:border-[var(--text-secondary)] min-h-[200px]"
                            spellCheck={false}
                        />
                    </div>

                    <button
                        onClick={handleSend}
                        disabled={status === 'sending'}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {status === 'sending' ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Send size={16} />
                        )}
                        Send Message
                    </button>
                </div>

                {/* Response Column */}
                <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-medium text-[var(--text-secondary)]">
                            Response
                        </label>
                        {responseTime !== null && (
                            <span className="text-xs text-[var(--text-tertiary)]">
                                {responseTime}ms
                            </span>
                        )}
                    </div>

                    <div className={cn(
                        "flex-1 w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-md text-sm font-mono overflow-hidden relative",
                        status === 'error' ? "border-red-500/30 bg-red-500/5" : "",
                        status === 'success' ? "border-green-500/30 bg-green-500/5" : ""
                    )}>
                        {response ? (
                            <pre className="p-3 overflow-auto max-h-[400px] text-xs">
                                {response}
                            </pre>
                        ) : (
                            <div className="flex items-center justify-center h-full text-[var(--text-tertiary)] text-xs italic">
                                No response data
                            </div>
                        )}

                        {status === 'success' && (
                            <div className="absolute top-2 right-2 text-green-500">
                                <CheckCircle size={16} />
                            </div>
                        )}
                        {status === 'error' && (
                            <div className="absolute top-2 right-2 text-red-500">
                                <AlertCircle size={16} />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
