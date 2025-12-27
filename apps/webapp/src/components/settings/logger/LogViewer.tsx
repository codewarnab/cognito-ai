'use client';

import React, { useState, useMemo, useRef } from 'react';
import { useLogStream } from '@/hooks/useLogStream';
import type { LogEntry } from '@cognito/shared';
import { cn } from '@/lib/utils';
import { Search, Trash2, PauseCircle, PlayCircle, X } from 'lucide-react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

const LEVEL_COLORS = {
    debug: 'text-gray-400',
    info: 'text-blue-400',
    warn: 'text-amber-400',
    error: 'text-red-400'
};

const LEVEL_BG = {
    debug: 'bg-gray-500/10',
    info: 'bg-blue-500/10',
    warn: 'bg-amber-500/10',
    error: 'bg-red-500/10'
};

export function LogViewer() {
    const { logs, isConnected, clearLogs } = useLogStream();
    const [searchQuery, setSearchQuery] = useState('');
    const [levelFilter, setLevelFilter] = useState<string[]>(['debug', 'info', 'warn', 'error']);
    const [autoScroll, setAutoScroll] = useState(true);
    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

    // Filter logs
    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            if (!levelFilter.includes(log.level)) return false;
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const content = [
                    log.message,
                    log.category,
                    log.prefix,
                    JSON.stringify(log.args)
                ].join(' ').toLowerCase();
                return content.includes(query);
            }
            return true;
        });
    }, [logs, levelFilter, searchQuery]);

    const toggleLevel = (level: string) => {
        setLevelFilter(prev =>
            prev.includes(level)
                ? prev.filter(l => l !== level)
                : [...prev, level]
        );
    };

    const formatTime = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleTimeString() + '.' + d.getMilliseconds().toString().padStart(3, '0');
    };

    const renderValue = (val: unknown) => {
        if (typeof val === 'string') return val;
        try {
            return JSON.stringify(val, null, 2);
        } catch {
            return String(val);
        }
    };

    const LogRow = ({ log }: { log: LogEntry }) => {
        const isSelected = selectedLogId === log.id;

        return (
            <div className={cn(
                "flex flex-col border-b border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] transition-colors",
                isSelected ? "bg-[var(--bg-tertiary)]" : ""
            )}>
                {/* Log Header Row */}
                <div
                    onClick={() => setSelectedLogId(isSelected ? null : log.id)}
                    className="flex items-start gap-2 p-2 cursor-pointer"
                >
                    <span className="text-[var(--text-tertiary)] whitespace-nowrap opacity-60 w-20 shrink-0">
                        {formatTime(log.timestamp)}
                    </span>
                    <span className={cn("uppercase font-bold w-10 shrink-0", LEVEL_COLORS[log.level])}>
                        {log.level.slice(0, 4)}
                    </span>
                    <div className="flex-1 break-all min-w-0">
                        {log.prefix && <span className="text-[var(--text-secondary)] font-semibold mr-2">[{log.prefix}]</span>}
                        {log.category && <span className="text-[var(--text-tertiary)] mr-2">[{log.category}]</span>}
                        <span className="text-[var(--text-primary)]">
                            {typeof log.message === 'string' ? log.message : renderValue(log.message)}
                        </span>
                        {/* Preview args if not expanded */}
                        {!isSelected && log.args.length > 0 && (
                            <span className="ml-2 opacity-50 text-[var(--text-secondary)] truncate inline-block max-w-[200px] align-bottom">
                                {log.args.map(a => typeof a === 'object' ? '{...}' : String(a)).join(' ')}
                            </span>
                        )}
                    </div>
                </div>

                {/* Expanded Details */}
                {isSelected && (
                    <div className="p-3 bg-black/20 ml-12 text-[var(--text-secondary)] overflow-x-auto">
                        {typeof log.message !== 'string' && (
                            <div className="mb-2">
                                <div className="text-[10px] uppercase opacity-50 mb-1">Message Detail</div>
                                <pre className="whitespace-pre-wrap">{renderValue(log.message)}</pre>
                            </div>
                        )}
                        {log.args.length > 0 && (
                            <div>
                                <div className="text-[10px] uppercase opacity-50 mb-1">Arguments ({log.args.length})</div>
                                {log.args.map((arg, i) => (
                                    <div key={i} className="mb-2 border-l-2 border-[var(--border-color)] pl-2">
                                        <pre className="whitespace-pre-wrap">{renderValue(arg)}</pre>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="mt-2 pt-2 border-t border-[var(--border-color)] opacity-50 text-[10px]">
                            ID: {log.id} | TS: {log.timestamp}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-[600px] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-xl border border-[var(--border-color)] overflow-hidden shadow-sm">
            {/* Header */}
            <div className="flex items-center p-3 border-b border-[var(--border-color)] bg-[var(--bg-secondary)] gap-3 shrink-0">
                <div className="flex items-center gap-2 mr-2">
                    <div className={cn("w-2 h-2 rounded-full", isConnected ? "bg-green-500" : "bg-red-500")} />
                    <span className="text-xs font-medium text-[var(--text-secondary)]">
                        {isConnected ? 'Connected' : 'Disconnected'}
                    </span>
                    <span className="text-xs text-[var(--text-tertiary)] px-2">
                        {filteredLogs.length} events
                    </span>
                </div>

                <div className="flex-1 flex items-center bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg px-2 py-1.5 focus-within:border-[var(--text-secondary)] transition-colors">
                    <Search size={14} className="text-[var(--text-tertiary)] mr-2" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search logs..."
                        className="bg-transparent border-none outline-none text-xs w-full text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                            <X size={12} />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-1 border-l border-[var(--border-color)] pl-3">
                    {/* Level Filters */}
                    {(['debug', 'info', 'warn', 'error'] as const).map(level => (
                        <TooltipProvider key={level}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() => toggleLevel(level)}
                                        className={cn(
                                            "px-2 py-1 rounded text-[10px] font-bold uppercase transition-all border",
                                            levelFilter.includes(level)
                                                ? cn(LEVEL_BG[level], LEVEL_COLORS[level], "border-transparent")
                                                : "bg-transparent text-[var(--text-tertiary)] border-transparent opacity-50 hover:opacity-100 hover:bg-[var(--bg-tertiary)]"
                                        )}
                                    >
                                        {level.slice(0, 1)}
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Toggle {level} logs</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    ))}
                </div>

                <div className="flex items-center gap-2 border-l border-[var(--border-color)] pl-3">
                    <button
                        onClick={() => setAutoScroll(!autoScroll)}
                        className={cn(
                            "p-1.5 rounded-md transition-colors",
                            autoScroll ? "text-green-400 bg-green-500/10" : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                        )}
                        title="Auto-scroll"
                    >
                        {autoScroll ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
                    </button>
                    <button
                        onClick={clearLogs}
                        className="p-1.5 text-[var(--text-tertiary)] hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                        title="Clear logs"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            {/* Log List with Virtualization */}
            <div className="flex-1 font-mono text-[11px]">
                {filteredLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-[var(--text-tertiary)]">
                        <p>No logs to display</p>
                    </div>
                ) : (
                    <Virtuoso
                        ref={virtuosoRef}
                        data={filteredLogs}
                        totalCount={filteredLogs.length}
                        followOutput={autoScroll ? 'smooth' : false}
                        itemContent={(index, log) => <LogRow log={log} />}
                        className="h-full scrollbar-thin"
                    />
                )}
            </div>
        </div>
    );
}
