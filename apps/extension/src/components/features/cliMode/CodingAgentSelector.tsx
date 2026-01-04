import React, { useEffect, useState, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, Check, Loader2, Terminal } from 'lucide-react';
import { useCliModeStore } from '@/stores';
import type { CliModeState, AgentInfo } from '@/stores/cliMode/types';
import { cn } from '@/lib/utils';
import { createLogger } from '~logger';
import { Gemini } from '@assets/brands/integrations/Gemini';
import { ClaudeAI } from '@assets/brands/integrations/ClaudeAI';
import { OpenAI } from '@assets/brands/integrations/OpenAI';

const log = createLogger('CodingAgentSelector', 'CLI_MODE_UI');

// Agent icon mapping - matches agent names to brand icons
const AGENT_ICONS: Record<string, React.FC<React.SVGProps<SVGSVGElement>>> = {
    'Gemini CLI': Gemini,
    'Claude Code': ClaudeAI,
    'Codex CLI': OpenAI,
};

// Agent colors for styling
const AGENT_COLORS: Record<string, string> = {
    'Gemini CLI': '#4285F4',
    'Claude Code': '#D97757',
    'Codex CLI': '#10A37F',
};

/** Get icon component for an agent */
const getAgentIcon = (agentName: string): React.FC<React.SVGProps<SVGSVGElement>> => {
    return AGENT_ICONS[agentName] || Terminal;
};

/** Get color for an agent */
const getAgentColor = (agentName: string): string => {
    return AGENT_COLORS[agentName] || '#9ca3af';
};

interface CodingAgentSelectorProps {
    className?: string;
}

/**
 * CodingAgentSelector - Renders above the chat input when in CLI Mode
 * Allows selecting which coding agent CLI to use (Gemini CLI, Claude Code, etc.)
 * Shows in place of SuggestedActions when toolsMode === 'cli'
 */
export const CodingAgentSelector: React.FC<CodingAgentSelectorProps> = ({ className }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // CLI mode store state
    const selectedAgentName = useCliModeStore((s: CliModeState) => s.selectedAgentName);
    const availableAgents = useCliModeStore((s: CliModeState) => s.availableAgents);
    const setSelectedAgentName = useCliModeStore((s: CliModeState) => s.setSelectedAgentName);
    const fetchAvailableAgents = useCliModeStore((s: CliModeState) => s.fetchAvailableAgents);
    const bridgeStatus = useCliModeStore((s: CliModeState) => s.bridgeStatus);

    // Fetch available agents when component mounts and bridge is connected
    useEffect(() => {
        if (bridgeStatus === 'connected') {
            fetchAvailableAgents();
        }
    }, [bridgeStatus, fetchAvailableAgents]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
        return undefined;
    }, [isOpen]);

    const handleSelectAgent = (agent: AgentInfo) => {
        log.info('Selecting agent', { name: agent.name });
        setSelectedAgentName(agent.name);
        setIsOpen(false);
    };

    // Default agents when bridge hasn't fetched yet
    const defaultAgents: AgentInfo[] = [
        { name: 'Gemini CLI', command: 'gemini', args: [], available: true },
        { name: 'Claude Code', command: 'claude', args: [], available: false },
        { name: 'Codex CLI', command: 'codex', args: [], available: false },
    ];

    const agents = availableAgents.length > 0 ? availableAgents : defaultAgents;
    const selectedAgent = agents.find(a => a.name === selectedAgentName) || agents[0];
    const SelectedIcon = selectedAgent ? getAgentIcon(selectedAgent.name) : Terminal;

    const isConnected = bridgeStatus === 'connected';
    const isPairing = bridgeStatus === 'needs-pairing';

    return (
        <AnimatePresence>
            <motion.div
                key="coding-agent-selector"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.2 }}
                className={cn(
                    'absolute bottom-full left-0 right-0 mb-2 px-3 z-0 pointer-events-auto ml-2',
                    'max-[480px]:mb-1.5 max-[480px]:px-2.5',
                    className
                )}
            >
                <div className="flex items-center gap-2">
                    {/* Agent Selector Dropdown */}
                    <div ref={dropdownRef} className="relative">
                        <button
                            type="button"
                            onClick={() => isConnected && setIsOpen(!isOpen)}
                            disabled={!isConnected}
                            className={cn(
                                'flex items-center gap-1.5 pl-2 pr-2.5 py-1.5 rounded-lg',
                                'bg-white/[0.06] hover:bg-white/[0.10] transition-all duration-150',
                                'text-white/80 hover:text-white text-[13px] font-medium',
                                'border border-white/[0.06] hover:border-white/[0.12] cursor-pointer',
                                'backdrop-blur-sm shadow-sm',
                                !isConnected && 'opacity-50 cursor-not-allowed'
                            )}
                        >
                            <SelectedIcon className="w-3.5 h-3.5 shrink-0" />
                            <span className="whitespace-nowrap leading-none">
                                {isPairing ? 'Pairing...' : selectedAgent?.name || 'Select Agent'}
                            </span>
                            {isConnected && (
                                <ChevronDown
                                    className={cn(
                                        'w-3 h-3 opacity-60 transition-transform duration-150',
                                        isOpen && 'rotate-180'
                                    )}
                                />
                            )}
                            {isPairing && (
                                <Loader2 className="w-3 h-3 animate-spin opacity-60" />
                            )}
                        </button>

                        {/* Dropdown Menu */}
                        <AnimatePresence>
                            {isOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: -4, scale: 0.96 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -4, scale: 0.96 }}
                                    transition={{ duration: 0.12, ease: 'easeOut' }}
                                    className={cn(
                                        'absolute bottom-full left-0 mb-1.5 min-w-[180px]',
                                        'bg-[#151a24]/95 backdrop-blur-xl',
                                        'border border-white/[0.08] rounded-lg',
                                        'shadow-[0_4px_24px_rgba(0,0,0,0.4)] overflow-hidden'
                                    )}
                                >
                                    <div className="py-1">
                                        {agents.map((agent) => {
                                            const AgentIcon = getAgentIcon(agent.name);
                                            const agentColor = getAgentColor(agent.name);
                                            const isSelected = selectedAgent?.name === agent.name;

                                            return (
                                                <button
                                                    key={agent.name}
                                                    type="button"
                                                    onClick={() => handleSelectAgent(agent)}
                                                    disabled={!agent.available}
                                                    className={cn(
                                                        'group relative w-full flex items-center gap-2 px-2.5 py-1.5',
                                                        'text-left text-[13px] transition-all duration-100',
                                                        agent.available
                                                            ? 'text-white/85 hover:bg-white/[0.06] hover:text-white cursor-pointer'
                                                            : 'text-white/30 cursor-not-allowed',
                                                        isSelected && 'bg-white/[0.04]'
                                                    )}
                                                >
                                                    {/* Selected indicator bar */}
                                                    {isSelected && (
                                                        <div
                                                            className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-r-full"
                                                            style={{ backgroundColor: agentColor }}
                                                        />
                                                    )}
                                                    <AgentIcon className="w-3.5 h-3.5 shrink-0" />
                                                    <span className="flex-1 whitespace-nowrap">{agent.name}</span>
                                                    {isSelected && (
                                                        <Check size={12} className="opacity-70" style={{ color: agentColor }} />
                                                    )}
                                                    {!agent.available && (
                                                        <span className="text-[10px] text-white/25 whitespace-nowrap">
                                                            not installed
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Bridge Status Indicator */}
                    <div className="flex items-center gap-1 text-[10px] text-white/35">
                        <div
                            className={cn(
                                'w-1 h-1 rounded-full',
                                bridgeStatus === 'connected' && 'bg-emerald-400/80',
                                bridgeStatus === 'needs-pairing' && 'bg-amber-400/80 animate-pulse',
                                bridgeStatus === 'offline' && 'bg-red-400/80'
                            )}
                        />
                        <span className="opacity-80">
                            {bridgeStatus === 'connected' && 'Connected'}
                            {bridgeStatus === 'needs-pairing' && 'Pairing'}
                            {bridgeStatus === 'offline' && 'Offline'}
                        </span>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};
