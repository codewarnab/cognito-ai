/**
 * Dropdown component for selecting workflows via slash commands
 * Displays available workflows with icon, name, and description
 * 
 * DSA Optimization: Uses Trie for O(m+k) prefix search instead of O(n) filter.
 */

import React, { useEffect, useState, useMemo } from 'react';
import type { WorkflowDefinition } from '../../../../workflows/types';
import { getAllWorkflows } from '../../../../workflows/registry';
import { SearchIcon } from '@assets/icons/chat/search';
import { YoutubeIcon } from '@assets/icons/chat/youtube';
import type { AIMode } from '../types';
import { createTrie } from '~/utils/search/Trie';

// Helper to render icon (either emoji or component)
function renderWorkflowIcon(icon: string) {
    if (icon === 'search') {
        return <SearchIcon size={24} />;
    }
    if (icon === 'youtube') {
        return <YoutubeIcon size={24} />;
    }
    // Default: treat as emoji
    return <span>{icon}</span>;
}

/**
 * Extract searchable keys from a workflow definition
 * Used to build the Trie index
 */
function getWorkflowKeys(workflow: WorkflowDefinition): string[] {
    const keys: string[] = [
        workflow.id,
        workflow.name,
    ];

    // Add individual words from name and description for better matching
    const nameWords = workflow.name.toLowerCase().split(/\s+/);
    const descWords = workflow.description.toLowerCase().split(/\s+/);

    keys.push(...nameWords.filter(w => w.length > 2));
    keys.push(...descWords.filter(w => w.length > 3));

    return keys;
}

interface SlashCommandDropdownProps {
    searchQuery: string;
    onSelectWorkflow: (workflow: WorkflowDefinition) => void;
    onClose: () => void;
    position?: { top: number; left: number };
    mode?: AIMode;
}

export function SlashCommandDropdown({
    searchQuery,
    onSelectWorkflow,
    onClose,
    position,
    mode = 'remote',
}: SlashCommandDropdownProps) {
    const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const listRef = React.useRef<HTMLDivElement>(null);
    const selectedItemRef = React.useRef<HTMLButtonElement>(null);

    // Load workflows on mount
    useEffect(() => {
        const allWorkflows = getAllWorkflows();
        setWorkflows(allWorkflows);
    }, []);

    // Build Trie index for efficient prefix search - O(n * m) once on mount
    const workflowTrie = useMemo(() => {
        return createTrie(workflows, getWorkflowKeys);
    }, [workflows]);

    // Filter workflows using Trie for prefix matching - O(m + k) on each keystroke
    // Falls back to includes() for substring (non-prefix) matches
    const filteredWorkflows = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();

        if (!query) {
            return workflows; // Show all if no query
        }

        // Use Trie for O(m+k) prefix search
        const prefixMatches = workflowTrie.search(query);

        // Also check for substring matches (not just prefix) as fallback
        // This handles cases like searching "tube" to match "youtube"
        const substringMatches = workflows.filter((workflow) => {
            const name = workflow.name.toLowerCase();
            const description = workflow.description.toLowerCase();
            const id = workflow.id.toLowerCase();

            return (
                name.includes(query) ||
                description.includes(query) ||
                id.includes(query)
            );
        });

        // Combine and deduplicate results (prefix matches first for relevance)
        const seen = new Set<string>();
        const combined: WorkflowDefinition[] = [];

        for (const workflow of prefixMatches) {
            if (!seen.has(workflow.id)) {
                seen.add(workflow.id);
                combined.push(workflow);
            }
        }

        for (const workflow of substringMatches) {
            if (!seen.has(workflow.id)) {
                seen.add(workflow.id);
                combined.push(workflow);
            }
        }

        return combined;
    }, [searchQuery, workflows, workflowTrie]);

    // Reset selected index when filtered results change
    useEffect(() => {
        setSelectedIndex(0);
    }, [searchQuery]);

    // Auto-scroll selected item into view
    useEffect(() => {
        if (selectedItemRef.current && listRef.current) {
            const item = selectedItemRef.current;
            const list = listRef.current;
            const itemTop = item.offsetTop;
            const itemBottom = itemTop + item.offsetHeight;
            const listScrollTop = list.scrollTop;
            const listHeight = list.clientHeight;

            if (itemBottom > listScrollTop + listHeight) {
                list.scrollTop = itemBottom - listHeight;
            } else if (itemTop < listScrollTop) {
                list.scrollTop = itemTop;
            }
        }
    }, [selectedIndex]);

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setSelectedIndex((prev) =>
                        prev < filteredWorkflows.length - 1 ? prev + 1 : prev
                    );
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (filteredWorkflows[selectedIndex]) {
                        onSelectWorkflow(filteredWorkflows[selectedIndex]);
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    onClose();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [filteredWorkflows, selectedIndex, onSelectWorkflow, onClose]);

    // Show message when in local mode
    if (mode === 'local') {
        return (
            <div className="absolute bottom-[calc(100%+8px)] left-0 right-0 max-h-[240px] bg-[#1e293b] border border-[#334155] rounded-md shadow-[0_4px_12px_rgba(0,0,0,0.3)] overflow-hidden z-[1000] origin-bottom-center animate-in slide-in-from-bottom-[8px] fade-in zoom-in-[0.93] duration-150" style={position}>
                <div className="p-4 text-center text-[#64748b] text-xs">
                    Workflows are not available in Local mode.
                    <br />
                    <span style={{ fontSize: '0.9em', opacity: 0.8 }}>
                        Switch to Cloud mode to use workflows.
                    </span>
                </div>
            </div>
        );
    }

    if (filteredWorkflows.length === 0) {
        return (
            <div className="absolute bottom-[calc(100%+8px)] left-0 right-0 max-h-[240px] bg-[#1e293b] border border-[#334155] rounded-md shadow-[0_4px_12px_rgba(0,0,0,0.3)] overflow-hidden z-[1000] origin-bottom-center animate-in slide-in-from-bottom-[8px] fade-in zoom-in-[0.93] duration-150" style={position}>
                <div className="p-4 text-center text-[#64748b] text-xs">
                    {searchQuery
                        ? `No workflows matching "${searchQuery}"`
                        : 'No workflows available'}
                </div>
            </div>
        );
    }

    return (
        <div className="absolute bottom-[calc(100%+8px)] left-0 right-0 max-h-[240px] bg-[#1e293b] border border-[#334155] rounded-md shadow-[0_4px_12px_rgba(0,0,0,0.3)] overflow-hidden z-[1000] origin-bottom-center animate-in slide-in-from-bottom-[8px] fade-in zoom-in-[0.93] duration-150" style={position}>
            <div className="max-h-[240px] overflow-y-auto container-scrollbar" ref={listRef}>
                {filteredWorkflows.map((workflow, index) => (
                    <button
                        key={workflow.id}
                        ref={index === selectedIndex ? selectedItemRef : null}
                        className={`flex items-center gap-2.5 px-3 py-2 border-none border-l-2 border-transparent bg-[#1e293b] text-[#e2e8f0] cursor-pointer text-left w-full transition-all duration-120 hover:bg-[#334155] hover:border-l-[#60a5fa] ${index === selectedIndex ? '!bg-[#1e3a5f] !border-l-[#60a5fa]' : ''
                            } ${workflow.comingSoon ? 'opacity-60 cursor-not-allowed hover:!bg-[#1e293b] hover:!border-l-transparent' : ''}`}
                        onClick={() => !workflow.comingSoon && onSelectWorkflow(workflow)}
                        onMouseEnter={() => setSelectedIndex(index)}
                        style={
                            workflow.color && index === selectedIndex
                                ? { borderLeftColor: workflow.color }
                                : {}
                        }
                    >
                        <div className="text-[18px] shrink-0 w-6 h-6 flex items-center justify-center text-[#60a5fa]">{renderWorkflowIcon(workflow.icon)}</div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-semibold text-[#f1f5f9] mb-0.5 font-mono flex items-center gap-1.5">
                                /{workflow.id} - {workflow.name}
                                {workflow.comingSoon && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 bg-[rgba(251,191,36,0.15)] border border-[rgba(251,191,36,0.3)] rounded text-[9px] font-semibold text-[#fbbf24] uppercase tracking-wider font-sans">Coming Soon</span>
                                )}
                            </div>
                            <div className="text-[11px] text-[#94a3b8] overflow-hidden text-ellipsis whitespace-nowrap">
                                {workflow.description}
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
