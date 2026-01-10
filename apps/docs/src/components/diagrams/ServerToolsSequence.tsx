export function ServerToolsSequence() {
    return (
        <div className="not-prose my-6 font-mono text-sm">
            <svg viewBox="0 0 600 420" className="w-full max-w-2xl">
                {/* Participants */}
                <g className="fill-current text-gray-800 dark:text-gray-200">
                    <rect x="60" y="10" width="80" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="100" y="30" textAnchor="middle" className="text-xs font-medium">Extension</text>

                    <rect x="260" y="10" width="80" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="300" y="30" textAnchor="middle" className="text-xs font-medium">Cloud</text>

                    <rect x="460" y="10" width="80" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="500" y="30" textAnchor="middle" className="text-xs font-medium">External</text>
                </g>

                {/* Lifelines */}
                <g className="stroke-gray-400 dark:stroke-gray-500" strokeWidth="1" strokeDasharray="4 3">
                    <line x1="100" y1="40" x2="100" y2="410" />
                    <line x1="300" y1="40" x2="300" y2="410" />
                    <line x1="500" y1="40" x2="500" y2="410" />
                </g>

                {/* Messages */}
                <g className="fill-current text-gray-700 dark:text-gray-300">
                    {/* 1. POST request */}
                    <line x1="100" y1="70" x2="295" y2="70" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow)" />
                    <text x="200" y="63" textAnchor="middle" className="text-[10px]">POST /api/ai/chat-with-tools</text>

                    {/* Note */}
                    <rect x="130" y="80" width="140" height="22" rx="2" className="fill-amber-50 stroke-amber-400 dark:fill-amber-900/30 dark:stroke-amber-500" strokeWidth="1" />
                    <text x="200" y="95" textAnchor="middle" className="text-[9px] fill-amber-700 dark:fill-amber-400">frontendTools: [schemas]</text>

                    {/* 2. AI selects tool */}
                    <path d="M 300 120 Q 340 120 340 140 Q 340 160 300 160" className="fill-none stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow)" />
                    <text x="355" y="143" className="text-[10px]">AI selects tool</text>

                    {/* Alt box */}
                    <rect x="50" y="180" width="500" height="180" rx="3" className="fill-none stroke-gray-500 dark:stroke-gray-400" strokeWidth="1" strokeDasharray="0" />
                    <text x="60" y="195" className="text-[10px] font-semibold fill-gray-600 dark:fill-gray-400">alt</text>

                    {/* Frontend tool path */}
                    <line x1="50" y1="205" x2="550" y2="205" className="stroke-gray-300 dark:stroke-gray-600" strokeWidth="1" strokeDasharray="3 2" />
                    <text x="60" y="220" className="text-[9px] fill-gray-500 dark:fill-gray-400">[Frontend tool]</text>

                    {/* SSE to extension */}
                    <line x1="300" y1="235" x2="105" y2="235" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow)" />
                    <text x="200" y="228" textAnchor="middle" className="text-[10px]">SSE: tool-input-available</text>

                    {/* Execute locally */}
                    <path d="M 100 250 Q 60 250 60 265 Q 60 280 100 280" className="fill-none stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow)" />
                    <text x="25" y="268" className="text-[9px]">Execute</text>

                    {/* addToolOutput */}
                    <line x1="100" y1="295" x2="295" y2="295" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow)" />
                    <text x="200" y="288" textAnchor="middle" className="text-[10px]">addToolOutput()</text>

                    {/* Server tool path */}
                    <line x1="50" y1="315" x2="550" y2="315" className="stroke-gray-300 dark:stroke-gray-600" strokeWidth="1" strokeDasharray="3 2" />
                    <text x="60" y="330" className="text-[9px] fill-gray-500 dark:fill-gray-400">[Server tool]</text>

                    {/* Execute on service */}
                    <line x1="300" y1="345" x2="495" y2="345" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow)" />
                    <text x="400" y="338" textAnchor="middle" className="text-[10px]">Execute (Tavily, Jina)</text>

                    {/* Result back */}
                    <line x1="500" y1="360" x2="305" y2="360" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow)" />
                    <text x="400" y="375" textAnchor="middle" className="text-[10px]">Result</text>

                    {/* Final response */}
                    <line x1="300" y1="395" x2="105" y2="395" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow)" />
                    <text x="200" y="388" textAnchor="middle" className="text-[10px]">SSE: text-delta</text>
                </g>

                {/* Arrow marker */}
                <defs>
                    <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                        <path d="M 0 0 L 8 4 L 0 8 z" className="fill-gray-800 dark:fill-gray-300" />
                    </marker>
                </defs>
            </svg>
        </div>
    );
}
