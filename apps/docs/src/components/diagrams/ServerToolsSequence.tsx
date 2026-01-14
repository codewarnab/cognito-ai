export function ServerToolsSequence() {
    return (
        <div className="not-prose my-6 font-mono text-sm">
            <svg viewBox="0 0 620 520" className="w-full max-w-2xl">
                {/* Participants */}
                <g className="fill-current text-gray-800 dark:text-gray-200">
                    <rect x="60" y="10" width="80" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="100" y="30" textAnchor="middle" className="text-xs font-medium">Extension</text>

                    <rect x="260" y="10" width="80" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="300" y="30" textAnchor="middle" className="text-xs font-medium">Backend</text>

                    <rect x="460" y="10" width="80" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="500" y="30" textAnchor="middle" className="text-xs font-medium">External API</text>
                </g>

                {/* Lifelines */}
                <g className="stroke-gray-400 dark:stroke-gray-500" strokeWidth="1" strokeDasharray="4 3">
                    <line x1="100" y1="40" x2="100" y2="510" />
                    <line x1="300" y1="40" x2="300" y2="510" />
                    <line x1="500" y1="40" x2="500" y2="510" />
                </g>

                {/* Messages */}
                <g className="fill-current text-gray-700 dark:text-gray-300">
                    {/* 1. Prepare tools */}
                    <path d="M 100 60 Q 60 60 60 75 Q 60 90 100 90" className="fill-none stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrowST)" />
                    <text x="15" y="78" className="text-[9px]">prepareTools()</text>

                    {/* 2. POST request */}
                    <line x1="100" y1="115" x2="295" y2="115" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrowST)" />
                    <text x="200" y="108" textAnchor="middle" className="text-[10px]">POST /api/ai/chat-with-tools</text>

                    {/* Note: request body */}
                    <rect x="115" y="125" width="170" height="35" rx="2" className="fill-gray-50 stroke-gray-300 dark:fill-gray-800/50 dark:stroke-gray-600" strokeWidth="1" />
                    <text x="200" y="140" textAnchor="middle" className="text-[9px] fill-gray-600 dark:fill-gray-400">messages, toolSchemas,</text>
                    <text x="200" y="152" textAnchor="middle" className="text-[9px] fill-gray-600 dark:fill-gray-400">searchEnabled, systemPrompt</text>

                    {/* 3. Backend merges tools */}
                    <path d="M 300 175 Q 340 175 340 190 Q 340 205 300 205" className="fill-none stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrowST)" />
                    <text x="355" y="188" className="text-[10px]">Merge frontend +</text>
                    <text x="355" y="200" className="text-[10px]">server tools</text>

                    {/* 4. AI selects tool */}
                    <path d="M 300 225 Q 340 225 340 240 Q 340 255 300 255" className="fill-none stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrowST)" />
                    <text x="355" y="243" className="text-[10px]">AI selects tool</text>

                    {/* Alt box */}
                    <rect x="50" y="275" width="520" height="200" rx="3" className="fill-none stroke-gray-500 dark:stroke-gray-400" strokeWidth="1" />
                    <text x="60" y="290" className="text-[10px] font-semibold fill-gray-600 dark:fill-gray-400">alt</text>

                    {/* Frontend tool path */}
                    <line x1="50" y1="305" x2="570" y2="305" className="stroke-gray-300 dark:stroke-gray-600" strokeWidth="1" strokeDasharray="3 2" />
                    <text x="60" y="320" className="text-[9px] fill-gray-500 dark:fill-gray-400">[Frontend tool - browser, MCP, WebMCP]</text>

                    {/* SSE to extension */}
                    <line x1="300" y1="340" x2="105" y2="340" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrowST)" />
                    <text x="200" y="333" textAnchor="middle" className="text-[10px]">SSE: tool-input-available</text>

                    {/* Execute locally */}
                    <path d="M 100 360 Q 60 360 60 375 Q 60 390 100 390" className="fill-none stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrowST)" />
                    <text x="10" y="378" className="text-[9px]">executeToolLocally()</text>

                    {/* addToolOutput */}
                    <line x1="100" y1="410" x2="295" y2="410" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrowST)" />
                    <text x="200" y="403" textAnchor="middle" className="text-[10px]">POST tool result (continue stream)</text>

                    {/* Server tool path */}
                    <line x1="50" y1="430" x2="570" y2="430" className="stroke-gray-300 dark:stroke-gray-600" strokeWidth="1" strokeDasharray="3 2" />
                    <text x="60" y="445" className="text-[9px] fill-gray-500 dark:fill-gray-400">[Server tool - webSearch, retrieve, deepWebSearch]</text>

                    {/* Execute on service */}
                    <line x1="300" y1="465" x2="495" y2="465" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrowST)" />
                    <text x="400" y="458" textAnchor="middle" className="text-[10px]">Tavily / Jina API call</text>

                    {/* Result back to backend */}
                    <line x1="500" y1="485" x2="305" y2="485" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrowST)" />
                    <text x="400" y="500" textAnchor="middle" className="text-[10px]">Result</text>

                    {/* Final response */}
                    <line x1="300" y1="505" x2="105" y2="505" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrowST)" />
                    <text x="200" y="518" textAnchor="middle" className="text-[10px]">SSE: text-delta (AI response)</text>
                </g>

                {/* Arrow marker */}
                <defs>
                    <marker id="arrowST" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                        <path d="M 0 0 L 8 4 L 0 8 z" className="fill-gray-800 dark:fill-gray-300" />
                    </marker>
                </defs>
            </svg>
        </div>
    );
}
