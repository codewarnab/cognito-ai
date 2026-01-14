export function CliBridgeArchitectureDiagram() {
    return (
        <div className="not-prose my-6 font-mono text-sm">
            <svg viewBox="0 0 750 500" className="w-full max-w-3xl">
                {/* Background groupings with solid look */}
                <rect x="20" y="40" width="220" height="380" rx="8" className="fill-blue-50/50 stroke-blue-200 dark:fill-blue-900/10 dark:stroke-blue-800" strokeWidth="1" />
                <rect x="280" y="40" width="220" height="380" rx="8" className="fill-green-50/50 stroke-green-200 dark:fill-green-900/10 dark:stroke-green-800" strokeWidth="1" />
                <rect x="530" y="40" width="160" height="230" rx="8" className="fill-purple-50/50 stroke-purple-200 dark:fill-purple-900/10 dark:stroke-purple-800" strokeWidth="1" />
                <rect x="530" y="290" width="160" height="130" rx="8" className="fill-orange-50/50 stroke-orange-200 dark:fill-orange-900/10 dark:stroke-orange-800" strokeWidth="1" />

                {/* Main Titles */}
                <text x="375" y="25" textAnchor="middle" className="text-sm font-bold fill-gray-800 dark:fill-gray-200 uppercase tracking-widest">Architecture Overview</text>

                {/* Group Labels */}
                <text x="130" y="65" textAnchor="middle" className="text-xs font-bold fill-blue-700 dark:fill-blue-400">Chrome Extension</text>
                <text x="390" y="65" textAnchor="middle" className="text-xs font-bold fill-green-700 dark:fill-green-400">CLI Bridge (localhost:8787)</text>
                <text x="610" y="65" textAnchor="middle" className="text-xs font-bold fill-purple-700 dark:fill-purple-400">External LLMs</text>
                <text x="610" y="315" textAnchor="middle" className="text-xs font-bold fill-orange-700 dark:fill-orange-400">MCP Clients</text>

                {/* Extension Components - Cleaner solid blocks with shadows */}
                <g className="filter drop-shadow-sm">
                    <rect x="40" y="90" width="180" height="40" rx="6" className="fill-white dark:fill-gray-800 stroke-gray-200 dark:stroke-gray-700" strokeWidth="1" />
                    <text x="130" y="115" textAnchor="middle" className="text-[11px] font-medium fill-gray-700 dark:fill-gray-300">Extension UI (Sidepanel)</text>

                    <rect x="40" y="145" width="180" height="40" rx="6" className="fill-white dark:fill-gray-800 stroke-gray-200 dark:stroke-gray-700" strokeWidth="1" />
                    <text x="130" y="170" textAnchor="middle" className="text-[11px] font-medium fill-gray-700 dark:fill-gray-300">cliModeStore</text>

                    <rect x="40" y="200" width="180" height="40" rx="6" className="fill-white dark:fill-gray-800 stroke-gray-200 dark:stroke-gray-700" strokeWidth="1" />
                    <text x="130" y="225" textAnchor="middle" className="text-[11px] font-medium fill-gray-700 dark:fill-gray-300">toolBridgeClient</text>

                    <rect x="40" y="255" width="180" height="40" rx="6" className="fill-white dark:fill-gray-800 stroke-gray-200 dark:stroke-gray-700" strokeWidth="1" />
                    <text x="130" y="280" textAnchor="middle" className="text-[11px] font-medium fill-gray-700 dark:fill-gray-300">cliBridgeClient</text>

                    <rect x="40" y="310" width="180" height="40" rx="6" className="fill-white dark:fill-gray-800 stroke-gray-200 dark:stroke-gray-700" strokeWidth="1" />
                    <text x="130" y="335" textAnchor="middle" className="text-[11px] font-medium fill-gray-700 dark:fill-gray-300">cliToolApproval</text>

                    <rect x="40" y="365" width="180" height="40" rx="6" className="fill-amber-50 dark:fill-amber-900/20 stroke-amber-200 dark:stroke-amber-800" strokeWidth="1" />
                    <text x="130" y="390" textAnchor="middle" className="text-[11px] font-medium fill-amber-700 dark:fill-amber-400">Browser Tools</text>
                </g>

                {/* Bridge Components */}
                <g className="filter drop-shadow-sm">
                    <rect x="300" y="90" width="180" height="40" rx="6" className="fill-white dark:fill-gray-800 stroke-gray-200 dark:stroke-gray-700" strokeWidth="1" />
                    <text x="390" y="115" textAnchor="middle" className="text-[11px] font-medium fill-gray-700 dark:fill-gray-300">HTTP Server</text>

                    <rect x="300" y="145" width="180" height="40" rx="6" className="fill-white dark:fill-gray-800 stroke-gray-200 dark:stroke-gray-700" strokeWidth="1" />
                    <text x="390" y="170" textAnchor="middle" className="text-[11px] font-medium fill-gray-700 dark:fill-gray-300">Token Store</text>

                    <rect x="300" y="200" width="180" height="40" rx="6" className="fill-white dark:fill-gray-800 stroke-gray-200 dark:stroke-gray-700" strokeWidth="1" />
                    <text x="390" y="225" textAnchor="middle" className="text-[11px] font-medium fill-gray-700 dark:fill-gray-300">Agent Handlers</text>

                    <rect x="300" y="255" width="180" height="40" rx="6" className="fill-white dark:fill-gray-800 stroke-gray-200 dark:stroke-gray-700" strokeWidth="1" />
                    <text x="390" y="280" textAnchor="middle" className="text-[11px] font-medium fill-gray-700 dark:fill-gray-300">Tool Store</text>

                    <rect x="300" y="310" width="180" height="40" rx="6" className="fill-white dark:fill-gray-800 stroke-gray-200 dark:stroke-gray-700" strokeWidth="1" />
                    <text x="390" y="335" textAnchor="middle" className="text-[11px] font-medium fill-gray-700 dark:fill-gray-300">MCP Server</text>

                    <rect x="300" y="365" width="180" height="40" rx="6" className="fill-white dark:fill-gray-800 stroke-gray-200 dark:stroke-gray-700" strokeWidth="1" />
                    <text x="390" y="390" textAnchor="middle" className="text-[11px] font-medium fill-gray-700 dark:fill-gray-300">AI SDK Tools Builder</text>
                </g>

                {/* External Components */}
                <g className="filter drop-shadow-sm">
                    <rect x="540" y="90" width="140" height="30" rx="4" className="fill-white dark:fill-gray-800 stroke-gray-200 dark:stroke-gray-700" strokeWidth="1" />
                    <text x="610" y="109" textAnchor="middle" className="text-[10px] fill-gray-700 dark:fill-gray-300">Gemini CLI</text>

                    <rect x="540" y="130" width="140" height="30" rx="4" className="fill-white dark:fill-gray-800 stroke-gray-200 dark:stroke-gray-700" strokeWidth="1" />
                    <text x="610" y="149" textAnchor="middle" className="text-[10px] fill-gray-700 dark:fill-gray-300">Claude Code</text>

                    <rect x="540" y="170" width="140" height="30" rx="4" className="fill-white dark:fill-gray-800 stroke-gray-200 dark:stroke-gray-700" strokeWidth="1" />
                    <text x="610" y="189" textAnchor="middle" className="text-[10px] fill-gray-700 dark:fill-gray-300">Codex CLI</text>

                    <rect x="540" y="210" width="140" height="30" rx="4" className="fill-gray-100 dark:fill-gray-700 stroke-gray-300 dark:stroke-gray-600" strokeWidth="1" />
                    <text x="610" y="229" textAnchor="middle" className="text-[10px] fill-gray-600 dark:fill-gray-400">LLM APIs</text>
                </g>

                {/* MCP Clients */}
                <g className="filter drop-shadow-sm">
                    <rect x="540" y="340" width="140" height="40" rx="4" className="fill-white dark:fill-gray-800 stroke-gray-200 dark:stroke-gray-700" strokeWidth="1" />
                    <text x="610" y="364" textAnchor="middle" className="text-[10px] fill-gray-700 dark:fill-gray-300">Any MCP Client</text>
                </g>

                {/* Connections */}
                <g className="stroke-gray-400 dark:stroke-gray-500">
                    {/* Extension to Bridge (HTTP) */}
                    <line x1="220" y1="110" x2="300" y2="110" strokeWidth="2" markerEnd="url(#arrow-solid)" />
                    <text x="260" y="100" textAnchor="middle" className="text-[9px] fill-gray-500">HTTP</text>

                    {/* Tool Sync (SSE) */}
                    <path d="M 220 220 L 260 220 L 260 275 L 300 275" fill="none" strokeWidth="1.5" strokeDasharray="4 2" markerEnd="url(#arrow-solid)" />
                    <text x="260" y="215" textAnchor="middle" className="text-[9px] fill-gray-500">SSE</text>

                    {/* Bridge to External Agents */}
                    <path d="M 480 220 L 510 220 L 510 145 L 540 145" fill="none" strokeWidth="1.5" markerEnd="url(#arrow-solid)" />

                    {/* MCP Connection */}
                    <line x1="480" y1="330" x2="530" y2="360" strokeWidth="1.5" markerEnd="url(#arrow-solid)" />
                    <text x="505" y="340" textAnchor="middle" className="text-[9px] fill-gray-500">MCP Protocol</text>
                </g>

                {/* Markers */}
                <defs>
                    <marker id="arrow-solid" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-gray-400 dark:fill-gray-500" />
                    </marker>
                </defs>
            </svg>
        </div>
    );
}
