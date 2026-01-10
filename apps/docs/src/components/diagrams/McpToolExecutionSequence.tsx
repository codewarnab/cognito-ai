export function McpToolExecutionSequence() {
    return (
        <div className="not-prose my-6 font-mono text-sm">
            <svg viewBox="0 0 580 360" className="w-full max-w-2xl">
                {/* Participants */}
                <g className="fill-current text-gray-800 dark:text-gray-200">
                    <rect x="40" y="10" width="70" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="75" y="30" textAnchor="middle" className="text-[10px] font-medium">Chat UI</text>

                    <rect x="155" y="10" width="70" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="190" y="30" textAnchor="middle" className="text-[10px] font-medium">AI Model</text>

                    <rect x="275" y="10" width="80" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="315" y="30" textAnchor="middle" className="text-[10px] font-medium">Approval Layer</text>

                    <rect x="400" y="10" width="80" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="440" y="30" textAnchor="middle" className="text-[10px] font-medium">Background SW</text>

                    <rect x="510" y="10" width="55" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="537" y="30" textAnchor="middle" className="text-[10px] font-medium">MCP</text>
                </g>

                {/* Lifelines */}
                <g className="stroke-gray-400 dark:stroke-gray-500" strokeWidth="1" strokeDasharray="4 3">
                    <line x1="75" y1="40" x2="75" y2="350" />
                    <line x1="190" y1="40" x2="190" y2="350" />
                    <line x1="315" y1="40" x2="315" y2="350" />
                    <line x1="440" y1="40" x2="440" y2="350" />
                    <line x1="537" y1="40" x2="537" y2="350" />
                </g>

                {/* Messages */}
                <g className="fill-current text-gray-700 dark:text-gray-300">
                    {/* 1. User message */}
                    <line x1="75" y1="65" x2="185" y2="65" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-execution)" />
                    <text x="130" y="58" textAnchor="middle" className="text-[10px]">User message</text>

                    {/* 2. AI selects tool */}
                    <path d="M 190 85 Q 220 85 220 100 Q 220 115 190 115" className="fill-none stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-execution)" />
                    <text x="235" y="103" className="text-[9px]">Select MCP tool</text>

                    {/* 3. Tool call pending */}
                    <line x1="190" y1="140" x2="310" y2="140" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-execution)" />
                    <text x="250" y="133" textAnchor="middle" className="text-[10px]">Tool call (pending)</text>

                    {/* 4. Show approval UI */}
                    <line x1="315" y1="170" x2="80" y2="170" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-execution)" />
                    <text x="197" y="163" textAnchor="middle" className="text-[10px]">Show approval UI</text>

                    {/* Note */}
                    <rect x="25" y="180" width="100" height="18" rx="2" className="fill-amber-50 stroke-amber-400 dark:fill-amber-900/30 dark:stroke-amber-500" strokeWidth="1" />
                    <text x="75" y="192" textAnchor="middle" className="text-[8px] fill-amber-700 dark:fill-amber-400">User clicks Allow</text>

                    {/* 5. Execute tool */}
                    <line x1="315" y1="215" x2="435" y2="215" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-execution)" />
                    <text x="375" y="208" textAnchor="middle" className="text-[10px]">Execute tool</text>

                    {/* 6. POST tools/call */}
                    <line x1="440" y1="245" x2="532" y2="245" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-execution)" />
                    <text x="486" y="238" textAnchor="middle" className="text-[10px]">POST tools/call</text>

                    {/* 7. Result */}
                    <line x1="537" y1="275" x2="445" y2="275" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-execution)" />
                    <text x="491" y="268" textAnchor="middle" className="text-[10px]">Result</text>

                    {/* 8. Tool result to approval */}
                    <line x1="440" y1="300" x2="320" y2="300" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-execution)" />
                    <text x="380" y="293" textAnchor="middle" className="text-[10px]">Tool result</text>

                    {/* 9. addToolOutput */}
                    <line x1="315" y1="325" x2="195" y2="325" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-execution)" />
                    <text x="255" y="318" textAnchor="middle" className="text-[10px]">addToolOutput(result)</text>

                    {/* 10. Response */}
                    <line x1="190" y1="345" x2="80" y2="345" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-execution)" />
                    <text x="135" y="338" textAnchor="middle" className="text-[10px]">Response with result</text>
                </g>

                {/* Arrow marker */}
                <defs>
                    <marker id="arrow-execution" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                        <path d="M 0 0 L 8 4 L 0 8 z" className="fill-gray-800 dark:fill-gray-300" />
                    </marker>
                </defs>
            </svg>
        </div>
    );
}
