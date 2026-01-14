export function ToolFlowDiagram() {
    return (
        <div className="not-prose my-6">
            <svg viewBox="0 0 500 220" className="w-full max-w-xl">
                {/* Step boxes */}
                <g>
                    {/* Step 1: User Request */}
                    <rect x="20" y="80" width="90" height="60" rx="8" className="fill-blue-100 stroke-blue-500 dark:fill-blue-900/40 dark:stroke-blue-400" strokeWidth="1.5" />
                    <text x="65" y="105" textAnchor="middle" className="text-xs font-medium fill-blue-700 dark:fill-blue-300">User</text>
                    <text x="65" y="120" textAnchor="middle" className="text-xs font-medium fill-blue-700 dark:fill-blue-300">Request</text>
                    <text x="65" y="35" textAnchor="middle" className="text-[10px] font-semibold fill-gray-500 dark:fill-gray-400">1</text>
                    <circle cx="65" cy="55" r="15" className="fill-gray-100 stroke-gray-400 dark:fill-gray-800 dark:stroke-gray-500" strokeWidth="1" />
                    <text x="65" y="59" textAnchor="middle" className="text-xs font-bold fill-gray-600 dark:fill-gray-300">1</text>
                </g>

                <g>
                    {/* Step 2: AI Analysis */}
                    <rect x="140" y="80" width="90" height="60" rx="8" className="fill-purple-100 stroke-purple-500 dark:fill-purple-900/40 dark:stroke-purple-400" strokeWidth="1.5" />
                    <text x="185" y="105" textAnchor="middle" className="text-xs font-medium fill-purple-700 dark:fill-purple-300">AI</text>
                    <text x="185" y="120" textAnchor="middle" className="text-xs font-medium fill-purple-700 dark:fill-purple-300">Analysis</text>
                    <circle cx="185" cy="55" r="15" className="fill-gray-100 stroke-gray-400 dark:fill-gray-800 dark:stroke-gray-500" strokeWidth="1" />
                    <text x="185" y="59" textAnchor="middle" className="text-xs font-bold fill-gray-600 dark:fill-gray-300">2</text>
                </g>

                <g>
                    {/* Step 3: Tool Selection */}
                    <rect x="260" y="80" width="90" height="60" rx="8" className="fill-green-100 stroke-green-500 dark:fill-green-900/40 dark:stroke-green-400" strokeWidth="1.5" />
                    <text x="305" y="105" textAnchor="middle" className="text-xs font-medium fill-green-700 dark:fill-green-300">Tool</text>
                    <text x="305" y="120" textAnchor="middle" className="text-xs font-medium fill-green-700 dark:fill-green-300">Selection</text>
                    <circle cx="305" cy="55" r="15" className="fill-gray-100 stroke-gray-400 dark:fill-gray-800 dark:stroke-gray-500" strokeWidth="1" />
                    <text x="305" y="59" textAnchor="middle" className="text-xs font-bold fill-gray-600 dark:fill-gray-300">3</text>
                </g>

                <g>
                    {/* Step 4: Execution */}
                    <rect x="380" y="80" width="90" height="60" rx="8" className="fill-amber-100 stroke-amber-500 dark:fill-amber-900/40 dark:stroke-amber-400" strokeWidth="1.5" />
                    <text x="425" y="105" textAnchor="middle" className="text-xs font-medium fill-amber-700 dark:fill-amber-300">Execute</text>
                    <text x="425" y="120" textAnchor="middle" className="text-xs font-medium fill-amber-700 dark:fill-amber-300">& Respond</text>
                    <circle cx="425" cy="55" r="15" className="fill-gray-100 stroke-gray-400 dark:fill-gray-800 dark:stroke-gray-500" strokeWidth="1" />
                    <text x="425" y="59" textAnchor="middle" className="text-xs font-bold fill-gray-600 dark:fill-gray-300">4</text>
                </g>

                {/* Arrows */}
                <g className="stroke-gray-400 dark:stroke-gray-500" strokeWidth="2" markerEnd="url(#arrowTool)">
                    <line x1="110" y1="110" x2="135" y2="110" />
                    <line x1="230" y1="110" x2="255" y2="110" />
                    <line x1="350" y1="110" x2="375" y2="110" />
                </g>

                {/* Labels below */}
                <g className="text-[9px] fill-gray-500 dark:fill-gray-400">
                    <text x="65" y="160" textAnchor="middle">"Search for X"</text>
                    <text x="185" y="160" textAnchor="middle">Determines intent</text>
                    <text x="305" y="160" textAnchor="middle">Picks web_search</text>
                    <text x="425" y="160" textAnchor="middle">Returns results</text>
                </g>

                {/* Loop indicator */}
                <path d="M 425 145 C 425 190 65 190 65 145" className="fill-none stroke-gray-300 dark:stroke-gray-600" strokeWidth="1" strokeDasharray="4 2" />
                <text x="245" y="200" textAnchor="middle" className="text-[9px] fill-gray-400 dark:fill-gray-500">Multi-step tasks loop back</text>

                {/* Arrow marker */}
                <defs>
                    <marker id="arrowTool" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                        <path d="M 0 0 L 8 4 L 0 8 z" className="fill-gray-400 dark:fill-gray-500" />
                    </marker>
                </defs>
            </svg>
        </div>
    );
}
