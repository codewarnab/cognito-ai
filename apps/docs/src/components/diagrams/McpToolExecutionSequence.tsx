export function McpToolExecutionSequence() {
    return (
        <div className="not-prose my-6 font-mono text-sm">
            <svg viewBox="0 0 900 620" className="w-full max-w-5xl">
                {/* Participants */}
                <g className="fill-white dark:fill-gray-800 stroke-gray-300 dark:stroke-gray-600">
                    <rect x={50} y={10} width={80} height={40} rx={6} className="shadow-sm" strokeWidth={1.5} />
                    <rect x={190} y={10} width={100} height={40} rx={6} className="shadow-sm" strokeWidth={1.5} />
                    <rect x={370} y={10} width={110} height={40} rx={6} className="shadow-sm" strokeWidth={1.5} />
                    <rect x={560} y={10} width={120} height={40} rx={6} className="shadow-sm" strokeWidth={1.5} />
                    <rect x={760} y={10} width={100} height={40} rx={6} className="shadow-sm" strokeWidth={1.5} />
                </g>

                {/* Participant Labels */}
                <g className="fill-gray-800 dark:fill-gray-200 text-xs font-bold font-sans">
                    <text x={90} y={35} textAnchor="middle">Chat UI</text>
                    <text x={240} y={35} textAnchor="middle">AI Model</text>
                    <text x={425} y={35} textAnchor="middle">Approval Layer</text>
                    <text x={620} y={35} textAnchor="middle">Background SW</text>
                    <text x={810} y={35} textAnchor="middle">MCP Server</text>
                </g>

                {/* Lifelines */}
                <g className="stroke-gray-300 dark:stroke-gray-600" strokeWidth={1.5} strokeDasharray="6 4">
                    <line x1={90} y1={50} x2={90} y2={600} />
                    <line x1={240} y1={50} x2={240} y2={600} />
                    <line x1={425} y1={50} x2={425} y2={600} />
                    <line x1={620} y1={50} x2={620} y2={600} />
                    <line x1={810} y1={50} x2={810} y2={600} />
                </g>

                {/* 1. User sends message */}
                <g>
                    <line x1={90} y1={75} x2={235} y2={75} className="stroke-gray-600 dark:stroke-gray-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-exec)" />
                    <text x={162} y={68} textAnchor="middle" className="text-[11px] fill-gray-700 dark:fill-gray-300 font-sans font-medium">User message</text>
                    <text x={162} y={88} textAnchor="middle" className="text-[10px] fill-gray-500 dark:fill-gray-400 italic font-sans">"Search for React docs"</text>
                </g>

                {/* 2. AI selects MCP tool (self-call) */}
                <g>
                    <path d="M 240 115 Q 290 115 290 135 Q 290 155 240 155" className="fill-none stroke-gray-600 dark:stroke-gray-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-exec)" />
                    <text x={310} y={130} className="text-[11px] fill-gray-700 dark:fill-gray-300 font-sans">Select MCP tool</text>
                    <text x={310} y={145} className="text-[10px] fill-gray-500 dark:fill-gray-400 italic font-sans">brave_search</text>
                </g>

                {/* 3. Tool call to approval layer */}
                <g>
                    <line x1={240} y1={185} x2={420} y2={185} className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-blue-exec)" />
                    <text x={330} y={178} textAnchor="middle" className="text-[11px] fill-blue-700 dark:fill-blue-300 font-sans font-medium">Tool call (pending)</text>

                    {/* Tool call details note */}
                    <rect x={260} y={195} width={140} height={40} rx={4} className="fill-blue-50 stroke-blue-200 dark:fill-blue-900/30 dark:stroke-blue-700" strokeWidth={1} />
                    <text x={330} y={212} textAnchor="middle" className="text-[10px] fill-blue-700 dark:fill-blue-300 font-mono">name: "brave_search"</text>
                    <text x={330} y={226} textAnchor="middle" className="text-[10px] fill-blue-700 dark:fill-blue-300 font-mono">args: {'{query: "..."}'}</text>
                </g>

                {/* 4. Show approval UI to user */}
                <g>
                    <line x1={425} y1={260} x2={95} y2={260} className="stroke-amber-600 dark:stroke-amber-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-amber-exec)" />
                    <text x={260} y={253} textAnchor="middle" className="text-[11px] fill-amber-700 dark:fill-amber-300 font-sans font-medium">Show approval UI</text>
                    <text x={260} y={273} textAnchor="middle" className="text-[10px] fill-gray-500 dark:fill-gray-400 italic font-sans">Display tool details + approval buttons</text>
                </g>

                {/* 5. User approves */}
                <g>
                    <line x1={90} y1={305} x2={420} y2={305} className="stroke-gray-600 dark:stroke-gray-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-exec)" />
                    <text x={255} y={298} textAnchor="middle" className="text-[11px] fill-gray-700 dark:fill-gray-300 font-sans font-medium">User clicks "Allow"</text>
                </g>

                {/* 6. Execute tool in background */}
                <g>
                    <line x1={425} y1={345} x2={615} y2={345} className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-blue-exec)" />
                    <text x={520} y={338} textAnchor="middle" className="text-[11px] fill-blue-700 dark:fill-blue-300 font-sans font-medium">Execute tool</text>
                    <text x={520} y={358} textAnchor="middle" className="text-[10px] fill-gray-500 dark:fill-gray-400 italic font-sans">Via chrome.runtime messaging</text>
                </g>

                {/* 7. Background calls MCP server */}
                <g>
                    <line x1={620} y1={390} x2={805} y2={390} className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-blue-exec)" />
                    <text x={712} y={383} textAnchor="middle" className="text-[11px] fill-blue-700 dark:fill-blue-300 font-sans font-medium">POST tools/call</text>
                    <text x={712} y={403} textAnchor="middle" className="text-[10px] fill-gray-500 dark:fill-gray-400 italic font-sans">JSON-RPC over SSE/HTTP</text>
                </g>

                {/* 8. MCP server returns result */}
                <g>
                    <line x1={810} y1={440} x2={625} y2={440} className="stroke-gray-500 dark:stroke-gray-400" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrow-open-exec)" />
                    <text x={717} y={433} textAnchor="middle" className="text-[11px] fill-gray-600 dark:fill-gray-400 font-sans">Tool result</text>
                    <text x={717} y={453} textAnchor="middle" className="text-[10px] fill-gray-500 dark:fill-gray-400 font-mono">{'{content: [...], isError: false}'}</text>
                </g>

                {/* 9. Result back to approval layer */}
                <g>
                    <line x1={620} y1={485} x2={430} y2={485} className="stroke-gray-500 dark:stroke-gray-400" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrow-open-exec)" />
                    <text x={525} y={478} textAnchor="middle" className="text-[11px] fill-gray-600 dark:fill-gray-400 font-sans">Tool result</text>
                </g>

                {/* 10. Add tool output to AI */}
                <g>
                    <line x1={425} y1={525} x2={245} y2={525} className="stroke-green-600 dark:stroke-green-400" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrow-open-green-exec)" />
                    <text x={335} y={518} textAnchor="middle" className="text-[11px] fill-green-700 dark:fill-green-300 font-sans font-medium">addToolResult(result)</text>
                    <text x={335} y={538} textAnchor="middle" className="text-[10px] fill-gray-500 dark:fill-gray-400 italic font-sans">AI continues with tool output</text>
                </g>

                {/* 11. AI responds to user */}
                <g>
                    <line x1={240} y1={570} x2={95} y2={570} className="stroke-green-600 dark:stroke-green-400" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrow-open-green-exec)" />
                    <text x={167} y={563} textAnchor="middle" className="text-[11px] fill-green-700 dark:fill-green-300 font-sans font-medium">Response with results</text>
                    <text x={167} y={583} textAnchor="middle" className="text-[10px] fill-gray-500 dark:fill-gray-400 italic font-sans">"Here's what I found..."</text>
                </g>

                {/* Arrow Definitions */}
                <defs>
                    <marker id="arrow-filled-exec" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-gray-600 dark:fill-gray-400" />
                    </marker>
                    <marker id="arrow-filled-blue-exec" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-blue-600 dark:fill-blue-400" />
                    </marker>
                    <marker id="arrow-filled-amber-exec" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-amber-600 dark:fill-amber-400" />
                    </marker>
                    <marker id="arrow-open-exec" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-none stroke-gray-500 dark:stroke-gray-400" strokeWidth="1.5" />
                    </marker>
                    <marker id="arrow-open-green-exec" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-none stroke-green-600 dark:stroke-green-400" strokeWidth="1.5" />
                    </marker>
                </defs>
            </svg>
        </div>
    );
}
