/**
 * Dropdown component for selecting workflows via slash commands
 * Displays available workflows with icon, name, and description
 */

import React, { useEffect, useState } from 'react';
import type { WorkflowDefinition } from '../../workflows/types';
import { getAllWorkflows } from '../../workflows/registry';
import { SearchIcon } from '../../../assets/chat/search';
import type { AIMode } from './types';

// Helper to render icon (either emoji or component)
function renderWorkflowIcon(icon: string) {
    if (icon === 'search') {
        return <SearchIcon size={24} />;
    }
    // Default: treat as emoji
    return <span>{icon}</span>;
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

    // Filter workflows based on search query (fuzzy search)
    const filteredWorkflows = workflows.filter((workflow) => {
        const query = searchQuery.toLowerCase();
        const name = workflow.name.toLowerCase();
        const description = workflow.description.toLowerCase();
        const id = workflow.id.toLowerCase();

        return (
            name.includes(query) ||
            description.includes(query) ||
            id.includes(query)
        );
    });

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
            <div className="slash-command-dropdown" style={position}>
                <div className="slash-command-empty">
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
            <div className="slash-command-dropdown" style={position}>
                <div className="slash-command-empty">
                    {searchQuery
                        ? `No workflows matching "${searchQuery}"`
                        : 'No workflows available'}
                </div>
            </div>
        );
    }

    return (
        <div className="slash-command-dropdown" style={position}>
            <div className="slash-command-list" ref={listRef}>
                {filteredWorkflows.map((workflow, index) => (
                    <button
                        key={workflow.id}
                        ref={index === selectedIndex ? selectedItemRef : null}
                        className={`slash-command-item ${index === selectedIndex ? 'selected' : ''
                            }`}
                        onClick={() => onSelectWorkflow(workflow)}
                        onMouseEnter={() => setSelectedIndex(index)}
                        style={
                            workflow.color && index === selectedIndex
                                ? { borderLeftColor: workflow.color }
                                : {}
                        }
                    >
                        <div className="slash-command-icon">{renderWorkflowIcon(workflow.icon)}</div>
                        <div className="slash-command-info">
                            <div className="slash-command-name">
                                /{workflow.id} - {workflow.name}
                            </div>
                            <div className="slash-command-description">
                                {workflow.description}
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
