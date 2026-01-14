export function CliBridgeArchitectureDiagram() {
    return (
        <div className="not-prose my-6 font-mono text-sm">
            <svg viewBox="0 0 700 450" className="w-full max-w-3xl">
                {/* Title */}
                <text x="350" y="25" textAnchor="middle" className="text-sm font-bold fill-gray-800 dark:fill-gray-200">CLI Bridge Architecture Overview</text>

                {/* Extension Box */}
                <rect x="30" y="50" width="200" height="350" rx="8" className="fill-blue-50 stroke-blue-400 dark:fill-blue-900/20 dark:stroke-blue-500" strokeWidth="2" />
                <text x="130" y="75" textAnchor="middle" className="text-xs font-semibold fill-blue-700 dark:fill-blue-400">Chrome Extension</text>

                {/* Extension Components */}
                <rect x="50" y="95" width="160" height="35" rx="4" className="fill-white stroke-gray-400 dark:fill-gray-800 dark:stroke-gray-500" strokeWidth="1" />
                <text x="130" y="117" textAnchor="middle" className="text-[10px] fill-gray-700 dark:fill-gray-300">Extension UI (Sidepanel)</text>

                <rect x="50" y="145" width="160" height="35" rx="4" className="fill-white stroke-gray-400 dark:fill-gray-800 dark:stroke-gray-500" strokeWidth="1" />
                <text x="130" y="167" textAnchor="middle" className="text-[10px] fill-gray-700 dark:fill-gray-300">cliModeStore (Zustand)</text>

                <rect x="50" y="195" width="160" height="35" rx="4" className="fill-white stroke-gray-400 dark:fill-gray-800 dark:stroke-gray-500" strokeWidth="1" />
                <text x="130" y="217" textAnchor="middle" className="text-[10px] fill-gray-700 dark:fill-gray-300">toolBridgeClient</text>

                <rect x="50" y="245" width="160" height="35" rx="4" className="fill-white stroke-gray-400 dark:fill-gray-800 dark:stroke-gray-500" strokeWidth="1" />
                <text x="130" y="267" textAnchor="middle" className="text-[10px] fill-gray-700 dark:fill-gray-300">cliBridgeClient</text>

                <rect x="50" y="295" width="160" height="35" rx="4" className="fill-white stroke-gray-400 dark:fill-gray-800 dark:stroke-gray-500" strokeWidth="1" />
                <text x="130" y="317" textAnchor="middle" className="text-[10px] fill-gray-700 dark:fill-gray-300">cliToolApproval</text>

                <rect x="50" y="345" width="160" height="35" rx="4" className="fill-amber-50 stroke-amber-400 dark:fill-amber-900/30 dark:stroke-amber-500" strokeWidth="1" />
                <text x="130" y="367" textAnchor="middle" className="text-[10px] fill-amber-700 dark:fill-amber-400">Browser Tools</text>

                {/* CLI Bridge Box */}
                <rect x="290" y="50" width="200" height="350" rx="8" className="fill-green-50 stroke-green-400 dark:fill-green-900/20 dark:stroke-green-500" strokeWidth="2" />
                <text x="390" y="75" textAnchor="middle" className="text-xs font-semibold fill-green-700 dark:fill-green-400">CLI Bridge (localhost:8787)</text>

                {/* Bridge Components */}
                <rect x="310" y="95" width="160" height="35" rx="4" className="fill-white stroke-gray-400 dark:fill-gray-800 dark:stroke-gray-500" strokeWidth="1" />
                <text x="390" y="117" textAnchor="middle" className="text-[10px] fill-gray-700 dark:fill-gray-300">HTTP Server</text>

                <rect x="310" y="145" width="160" height="35" rx="4" className="fill-white stroke-gray-400 dark:fill-gray-800 dark:stroke-gray-500" strokeWidth="1" />
                <text x="390" y="167" textAnchor="middle" className="text-[10px] fill-gray-700 dark:fill-gray-300">Token Store</text>

                <rect x="310" y="195" width="160" height="35" rx="4" className="fill-white stroke-gray-400 dark:fill-gray-800 dark:stroke-gray-500" strokeWidth="1" />
                <text x="390" y="217" textAnchor="middle" className="text-[10px] fill-gray-700 dark:fill-gray-300">Agent Handlers</text>

                <rect x="310" y="245" width="160" height="35" rx="4" className="fill-white stroke-gray-400 dark:fill-gray-800 dark:stroke-gray-500" strokeWidth="1" />
                <text x="390" y="267" textAnchor="middle" className="text-[10px] fill-gray-700 dark:fill-gray-300">Tool Store</text>

                <rect x="310" y="295" width="160" height="35" rx="4" className="fill-white stroke-gray-400 dark:fill-gray-800 dark:stroke-gray-500" strokeWidth="1" />
                <text x="390" y="317" textAnchor="middle" className="text-[10px] fill-gray-700 dark:fill-gray-300">MCP Server</text>

                <rect x="310" y="345" width="160" height="35" rx="4" className="fill-white stroke-gray-400 dark:fill-gray-800 dark:stroke-gray-500" strokeWidth="1" />
                <text x="390" y="367" textAnchor="middle" className="text-[10px] fill-gray-700 dark:fill-gray-300">AI SDK Tools Builder</text>

                {/* External Box */}
                <rect x="550" y="50" width="130" height="200" rx="8" className="fill-purple-50 stroke-purple-400 dark:fill-purple-900/20 dark:stroke-purple-500" strokeWidth="2" />
                <text x="615" y="75" textAnchor="middle" className="text-xs font-semibold fill-purple-700 dark:fill-purple-400">External</text>

                {/* External Components */}
                <rect x="560" y="95" width="110" height="30" rx="4" className="fill-white stroke-gray-400 dark:fill-gray-800 dark:stroke-gray-500" strokeWidth="1" />
                <text x="615" y="114" textAnchor="middle" className="text-[10px] fill-gray-700 dark:fill-gray-300">Gemini CLI</text>

                <rect x="560" y="135" width="110" height="30" rx="4" className="fill-white stroke-gray-400 dark:fill-gray-800 dark:stroke-gray-500" strokeWidth="1" />
                <text x="615" y="154" textAnchor="middle" className="text-[10px] fill-gray-700 dark:fill-gray-300">Claude Code</text>

                <rect x="560" y="175" width="110" height="30" rx="4" className="fill-white stroke-gray-400 dark:fill-gray-800 dark:stroke-gray-500" strokeWidth="1" />
                <text x="615" y="194" textAnchor="middle" className="text-[10px] fill-gray-700 dark:fill-gray-300">Codex CLI</text>

                <rect x="560" y="215" width="110" height="25" rx="4" className="fill-gray-100 stroke-gray-400 dark:fill-gray-700 dark:stroke-gray-500" strokeWidth="1" />
                <text x="615" y="231" textAnchor="middle" className="text-[9px] fill-gray-600 dark:fill-gray-400">LLM APIs</text>

                {/* MCP Clients Box */}
                <rect x="550" y="270" width="130" height="80" rx="8" className="fill-orange-50 stroke-orange-400 dark:fill-orange-900/20 dark:stroke-orange-500" strokeWidth="2" />
                <text x="615" y="295" textAnchor="middle" className="text-xs font-semibold fill-orange-700 dark:fill-orange-400">MCP Clients</text>

                <rect x="560" y="305" width="110" height="35" rx="4" className="fill-white stroke-gray-400 dark:fill-gray-800 dark:stroke-gray-500" strokeWidth="1" />
                <text x="615" y="327" textAnchor="middle" className="text-[10px] fill-gray-700 dark:fill-gray-300">Any MCP Client</text>

                {/* Arrows */}
                {/* Extension to Bridge */}
                <line x1="210" y1="112" x2="308" y2="112" className="stroke-gray-500 dark:stroke-gray-400" strokeWidth="1.5" markerEnd="url(#arrow-arch)" />
                <text x="259" y="105" textAnchor="middle" className="text-[8px] fill-gray-500">HTTP/SSE</text>

                {/* toolBridgeClient to Tool Store */}
                <line x1="210" y1="212" x2="308" y2="262" className="stroke-gray-500 dark:stroke-gray-400" strokeWidth="1.5" markerEnd="url(#arrow-arch)" />

                {/* Tool Store bidirectional */}
                <line x1="308" y1="270" x2="210" y2="220" className="stroke-gray-500 dark:stroke-gray-400" strokeWidth="1.5" strokeDasharray="4 2" markerEnd="url(#arrow-arch)" />
                <text x="259" y="250" textAnchor="middle" className="text-[8px] fill-gray-500">Tools SSE</text>

                {/* Bridge to Agents */}
                <line x1="470" y1="212" x2="558" y2="130" className="stroke-gray-500 dark:stroke-gray-400" strokeWidth="1.5" markerEnd="url(#arrow-arch)" />

                {/* MCP Server to MCP Clients */}
                <line x1="470" y1="312" x2="558" y2="320" className="stroke-gray-500 dark:stroke-gray-400" strokeWidth="1.5" markerEnd="url(#arrow-arch)" />
                <text x="514" y="305" textAnchor="middle" className="text-[8px] fill-gray-500">MCP</text>

                {/* Legend */}
                <rect x="30" y="415" width="640" height="30" rx="4" className="fill-gray-50 stroke-gray-300 dark:fill-gray-800 dark:stroke-gray-600" strokeWidth="1" />
                <line x1="50" y1="430" x2="80" y2="430" className="stroke-gray-500" strokeWidth="1.5" />
                <text x="90" y="434" className="text-[9px] fill-gray-600 dark:fill-gray-400">HTTP Request</text>

                <line x1="170" y1="430" x2="200" y2="430" className="stroke-gray-500" strokeWidth="1.5" strokeDasharray="4 2" />
                <text x="210" y="434" className="text-[9px] fill-gray-600 dark:fill-gray-400">SSE Stream</text>

                <rect x="290" y="423" width="40" height="14" rx="2" className="fill-blue-50 stroke-blue-400 dark:fill-blue-900/30" strokeWidth="1" />
                <text x="340" y="434" className="text-[9px] fill-gray-600 dark:fill-gray-400">Extension</text>

                <rect x="410" y="423" width="40" height="14" rx="2" className="fill-green-50 stroke-green-400 dark:fill-green-900/30" strokeWidth="1" />
                <text x="460" y="434" className="text-[9px] fill-gray-600 dark:fill-gray-400">Bridge</text>

                <rect x="520" y="423" width="40" height="14" rx="2" className="fill-purple-50 stroke-purple-400 dark:fill-purple-900/30" strokeWidth="1" />
                <text x="570" y="434" className="text-[9px] fill-gray-600 dark:fill-gray-400">External</text>

                {/* Arrow marker */}
                <defs>
                    <marker id="arrow-arch" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                        <path d="M 0 0 L 8 4 L 0 8 z" className="fill-gray-500 dark:fill-gray-400" />
                    </marker>
                </defs>
            </svg>
        </div>
    );
}
