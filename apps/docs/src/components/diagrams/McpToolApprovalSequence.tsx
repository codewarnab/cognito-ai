export function McpToolApprovalSequence() {
    return (
        <div className="not-prose my-6 font-mono text-sm">
            <svg viewBox="0 0 900 580" className="w-full max-w-5xl">
                {/* OPT block background for auto-approve check */}
                <rect x={30} y={165} width={840} height={100} rx={4} className="fill-blue-50/50 dark:fill-blue-900/10" />

                {/* Participants */}
                <g className="fill-white dark:fill-gray-800 stroke-gray-300 dark:stroke-gray-600">
                    <rect x={50} y={10} width={80} height={40} rx={6} className="shadow-sm" strokeWidth={1.5} />
                    <rect x={200} y={10} width={100} height={40} rx={6} className="shadow-sm" strokeWidth={1.5} />
                    <rect x={400} y={10} width={100} height={40} rx={6} className="shadow-sm" strokeWidth={1.5} />
                    <rect x={600} y={10} width={100} height={40} rx={6} className="shadow-sm" strokeWidth={1.5} />
                    <rect x={780} y={10} width={90} height={40} rx={6} className="shadow-sm" strokeWidth={1.5} />
                </g>

                {/* Participant Labels */}
                <g className="fill-gray-800 dark:fill-gray-200 text-xs font-bold font-sans">
                    <text x={90} y={35} textAnchor="middle">User</text>
                    <text x={250} y={35} textAnchor="middle">AI Model</text>
                    <text x={450} y={35} textAnchor="middle">Approval UI</text>
                    <text x={650} y={35} textAnchor="middle">MCP Proxy</text>
                    <text x={825} y={35} textAnchor="middle">MCP Server</text>
                </g>

                {/* Lifelines */}
                <g className="stroke-gray-300 dark:stroke-gray-600" strokeWidth={1.5} strokeDasharray="6 4">
                    <line x1={90} y1={50} x2={90} y2={560} />
                    <line x1={250} y1={50} x2={250} y2={560} />
                    <line x1={450} y1={50} x2={450} y2={560} />
                    <line x1={650} y1={50} x2={650} y2={560} />
                    <line x1={825} y1={50} x2={825} y2={560} />
                </g>

                {/* 1. User sends request */}
                <g>
                    <line x1={90} y1={75} x2={245} y2={75} className="stroke-gray-600 dark:stroke-gray-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-approval)" />
                    <text x={167} y={68} textAnchor="middle" className="text-[11px] fill-gray-700 dark:fill-gray-300 font-sans font-medium">"Create a Notion page"</text>
                </g>

                {/* 2. AI selects MCP tool */}
                <g>
                    <line x1={250} y1={110} x2={445} y2={110} className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-blue-approval)" />
                    <text x={347} y={103} textAnchor="middle" className="text-[11px] fill-blue-700 dark:fill-blue-300 font-sans font-medium">Tool call: notion_create_page</text>
                    <text x={347} y={123} textAnchor="middle" className="text-[10px] fill-gray-500 dark:fill-gray-400 italic font-sans">Pending approval</text>
                </g>

                {/* OPT Block - Auto-approve check */}
                <g>
                    <rect x={30} y={165} width={50} height={20} rx={0} className="fill-blue-100 dark:fill-blue-900/40 opacity-80" />
                    <text x={40} y={179} className="text-[10px] font-bold fill-blue-800 dark:fill-blue-200">OPT</text>
                    <text x={90} y={179} className="text-[10px] fill-blue-700 dark:fill-blue-300 italic">[if tool is auto-approved in settings]</text>
                    <rect x={30} y={165} width={840} height={100} rx={4} className="fill-none stroke-blue-200 dark:stroke-blue-800" strokeWidth={1} />
                </g>

                {/* 3a. Check auto-approve (self-call) */}
                <g>
                    <path d="M 450 200 Q 500 200 500 220 Q 500 240 450 240" className="fill-none stroke-gray-600 dark:stroke-gray-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-approval)" />
                    <text x={520} y={215} className="text-[11px] fill-gray-700 dark:fill-gray-300 font-sans">Check approval store</text>
                    <text x={520} y={230} className="text-[10px] fill-gray-500 dark:fill-gray-400 italic font-sans">Server trusted? Tool allowed?</text>
                </g>

                {/* 4. Show approval buttons to user (if not auto-approved) */}
                <g>
                    <line x1={450} y1={295} x2={95} y2={295} className="stroke-amber-600 dark:stroke-amber-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-amber-approval)" />
                    <text x={272} y={288} textAnchor="middle" className="text-[11px] fill-amber-700 dark:fill-amber-300 font-sans font-medium">Display approval buttons</text>

                    {/* Approval options note */}
                    <rect x={55} y={305} width={180} height={55} rx={4} className="fill-amber-50 stroke-amber-200 dark:fill-amber-900/30 dark:stroke-amber-700" strokeWidth={1} />
                    <text x={145} y={322} textAnchor="middle" className="text-[10px] fill-amber-700 dark:fill-amber-300 font-mono">Allow (once)</text>
                    <text x={145} y={336} textAnchor="middle" className="text-[10px] fill-amber-700 dark:fill-amber-300 font-mono">Trust this server (permanent)</text>
                    <text x={145} y={350} textAnchor="middle" className="text-[10px] fill-amber-700 dark:fill-amber-300 font-mono">Always allow | Deny</text>
                </g>

                {/* 5. User clicks Allow */}
                <g>
                    <line x1={90} y1={385} x2={445} y2={385} className="stroke-gray-600 dark:stroke-gray-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-approval)" />
                    <text x={267} y={378} textAnchor="middle" className="text-[11px] fill-gray-700 dark:fill-gray-300 font-sans font-medium">Click "Allow"</text>
                </g>

                {/* 6. Execute tool via proxy */}
                <g>
                    <line x1={450} y1={420} x2={645} y2={420} className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-blue-approval)" />
                    <text x={547} y={413} textAnchor="middle" className="text-[11px] fill-blue-700 dark:fill-blue-300 font-sans font-medium">Execute approved tool</text>
                </g>

                {/* 7. Proxy calls MCP server */}
                <g>
                    <line x1={650} y1={455} x2={820} y2={455} className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-blue-approval)" />
                    <text x={735} y={448} textAnchor="middle" className="text-[11px] fill-blue-700 dark:fill-blue-300 font-sans font-medium">tools/call</text>
                    <text x={735} y={468} textAnchor="middle" className="text-[10px] fill-gray-500 dark:fill-gray-400 italic font-sans">JSON-RPC request</text>
                </g>

                {/* 8. MCP server returns result */}
                <g>
                    <line x1={825} y1={495} x2={655} y2={495} className="stroke-gray-500 dark:stroke-gray-400" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrow-open-approval)" />
                    <text x={740} y={488} textAnchor="middle" className="text-[11px] fill-gray-600 dark:fill-gray-400 font-sans">Tool result</text>
                </g>

                {/* 9. Result back to AI */}
                <g>
                    <line x1={650} y1={525} x2={255} y2={525} className="stroke-green-600 dark:stroke-green-400" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrow-open-green-approval)" />
                    <text x={452} y={518} textAnchor="middle" className="text-[11px] fill-green-700 dark:fill-green-300 font-sans font-medium">addToolResult(result)</text>
                </g>

                {/* 10. AI responds to user */}
                <g>
                    <line x1={250} y1={555} x2={95} y2={555} className="stroke-green-600 dark:stroke-green-400" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrow-open-green-approval)" />
                    <text x={172} y={548} textAnchor="middle" className="text-[11px] fill-green-700 dark:fill-green-300 font-sans font-medium">"I've created the page"</text>
                </g>

                {/* Arrow Definitions */}
                <defs>
                    <marker id="arrow-filled-approval" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-gray-600 dark:fill-gray-400" />
                    </marker>
                    <marker id="arrow-filled-blue-approval" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-blue-600 dark:fill-blue-400" />
                    </marker>
                    <marker id="arrow-filled-amber-approval" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-amber-600 dark:fill-amber-400" />
                    </marker>
                    <marker id="arrow-open-approval" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-none stroke-gray-500 dark:stroke-gray-400" strokeWidth="1.5" />
                    </marker>
                    <marker id="arrow-open-green-approval" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-none stroke-green-600 dark:stroke-green-400" strokeWidth="1.5" />
                    </marker>
                </defs>
            </svg>
        </div>
    );
}
