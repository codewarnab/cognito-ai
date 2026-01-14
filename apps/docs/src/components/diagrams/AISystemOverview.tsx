export function AISystemOverview() {
    return (
        <div className="not-prose my-6">
            <svg viewBox="0 0 600 300" className="w-full max-w-2xl">
                {/* Central AI Core */}
                <g>
                    <circle cx="300" cy="150" r="50" className="fill-blue-100 stroke-blue-500 dark:fill-blue-900/40 dark:stroke-blue-400" strokeWidth="2" />
                    <text x="300" y="145" textAnchor="middle" className="text-sm font-semibold fill-blue-700 dark:fill-blue-300">AI Core</text>
                    <text x="300" y="162" textAnchor="middle" className="text-[10px] fill-blue-600 dark:fill-blue-400">Vercel AI SDK</text>
                </g>

                {/* Providers (Left) */}
                <g>
                    <rect x="40" y="70" width="100" height="35" rx="6" className="fill-purple-100 stroke-purple-500 dark:fill-purple-900/40 dark:stroke-purple-400" strokeWidth="1.5" />
                    <text x="90" y="92" textAnchor="middle" className="text-xs font-medium fill-purple-700 dark:fill-purple-300">Chrome AI</text>

                    <rect x="40" y="125" width="100" height="35" rx="6" className="fill-purple-100 stroke-purple-500 dark:fill-purple-900/40 dark:stroke-purple-400" strokeWidth="1.5" />
                    <text x="90" y="147" textAnchor="middle" className="text-xs font-medium fill-purple-700 dark:fill-purple-300">Your API Keys</text>

                    <rect x="40" y="180" width="100" height="35" rx="6" className="fill-purple-100 stroke-purple-500 dark:fill-purple-900/40 dark:stroke-purple-400" strokeWidth="1.5" />
                    <text x="90" y="202" textAnchor="middle" className="text-xs font-medium fill-purple-700 dark:fill-purple-300">Cloud Backend</text>

                    {/* Label */}
                    <text x="90" y="55" textAnchor="middle" className="text-[10px] font-semibold fill-gray-500 dark:fill-gray-400 uppercase tracking-wider">Providers</text>
                </g>

                {/* Tools (Right) */}
                <g>
                    <rect x="460" y="50" width="100" height="35" rx="6" className="fill-green-100 stroke-green-500 dark:fill-green-900/40 dark:stroke-green-400" strokeWidth="1.5" />
                    <text x="510" y="72" textAnchor="middle" className="text-xs font-medium fill-green-700 dark:fill-green-300">Browser Tools</text>

                    <rect x="460" y="100" width="100" height="35" rx="6" className="fill-green-100 stroke-green-500 dark:fill-green-900/40 dark:stroke-green-400" strokeWidth="1.5" />
                    <text x="510" y="122" textAnchor="middle" className="text-xs font-medium fill-green-700 dark:fill-green-300">Server Tools</text>

                    <rect x="460" y="150" width="100" height="35" rx="6" className="fill-green-100 stroke-green-500 dark:fill-green-900/40 dark:stroke-green-400" strokeWidth="1.5" />
                    <text x="510" y="172" textAnchor="middle" className="text-xs font-medium fill-green-700 dark:fill-green-300">MCP Tools</text>

                    <rect x="460" y="200" width="100" height="35" rx="6" className="fill-green-100 stroke-green-500 dark:fill-green-900/40 dark:stroke-green-400" strokeWidth="1.5" />
                    <text x="510" y="222" textAnchor="middle" className="text-xs font-medium fill-green-700 dark:fill-green-300">WebMCP Tools</text>

                    {/* Label */}
                    <text x="510" y="35" textAnchor="middle" className="text-[10px] font-semibold fill-gray-500 dark:fill-gray-400 uppercase tracking-wider">Tools</text>
                </g>

                {/* Modes (Bottom) */}
                <g>
                    <rect x="180" y="250" width="60" height="28" rx="4" className="fill-amber-100 stroke-amber-500 dark:fill-amber-900/40 dark:stroke-amber-400" strokeWidth="1.5" />
                    <text x="210" y="268" textAnchor="middle" className="text-[10px] font-medium fill-amber-700 dark:fill-amber-300">Chat</text>

                    <rect x="250" y="250" width="60" height="28" rx="4" className="fill-amber-100 stroke-amber-500 dark:fill-amber-900/40 dark:stroke-amber-400" strokeWidth="1.5" />
                    <text x="280" y="268" textAnchor="middle" className="text-[10px] font-medium fill-amber-700 dark:fill-amber-300">Agent</text>

                    <rect x="320" y="250" width="60" height="28" rx="4" className="fill-amber-100 stroke-amber-500 dark:fill-amber-900/40 dark:stroke-amber-400" strokeWidth="1.5" />
                    <text x="350" y="268" textAnchor="middle" className="text-[10px] font-medium fill-amber-700 dark:fill-amber-300">Adaptive</text>

                    {/* Label */}
                    <text x="280" y="295" textAnchor="middle" className="text-[10px] font-semibold fill-gray-500 dark:fill-gray-400 uppercase tracking-wider">Modes</text>
                </g>

                {/* Connection lines */}
                <g className="stroke-gray-400 dark:stroke-gray-500" strokeWidth="1.5">
                    {/* Providers to Core */}
                    <line x1="140" y1="87" x2="250" y2="130" />
                    <line x1="140" y1="142" x2="250" y2="150" />
                    <line x1="140" y1="197" x2="250" y2="170" />

                    {/* Core to Tools */}
                    <line x1="350" y1="130" x2="460" y2="67" />
                    <line x1="350" y1="140" x2="460" y2="117" />
                    <line x1="350" y1="160" x2="460" y2="167" />
                    <line x1="350" y1="170" x2="460" y2="217" />

                    {/* Core to Modes */}
                    <line x1="280" y1="200" x2="240" y2="250" />
                    <line x1="300" y1="200" x2="300" y2="250" />
                    <line x1="320" y1="200" x2="360" y2="250" />
                </g>
            </svg>
        </div>
    );
}
