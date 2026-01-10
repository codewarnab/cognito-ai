export function McpToolApprovalSequence() {
    return (
        <div className="not-prose my-6 font-mono text-sm">
            <svg viewBox="0 0 520 320" className="w-full max-w-xl">
                {/* Participants */}
                <g className="fill-current text-gray-800 dark:text-gray-200">
                    <rect x="40" y="10" width="70" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="75" y="30" textAnchor="middle" className="text-[10px] font-medium">User</text>

                    <rect x="155" y="10" width="70" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="190" y="30" textAnchor="middle" className="text-[10px] font-medium">AI Model</text>

                    <rect x="280" y="10" width="80" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="320" y="30" textAnchor="middle" className="text-[10px] font-medium">Approval UI</text>

                    <rect x="410" y="10" width="80" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="450" y="30" textAnchor="middle" className="text-[10px] font-medium">MCP Server</text>
                </g>

                {/* Lifelines */}
                <g className="stroke-gray-400 dark:stroke-gray-500" strokeWidth="1" strokeDasharray="4 3">
                    <line x1="75" y1="40" x2="75" y2="310" />
                    <line x1="190" y1="40" x2="190" y2="310" />
                    <line x1="320" y1="40" x2="320" y2="310" />
                    <line x1="450" y1="40" x2="450" y2="310" />
                </g>

                {/* Messages */}
                <g className="fill-current text-gray-700 dark:text-gray-300">
                    {/* 1. User request */}
                    <line x1="75" y1="65" x2="185" y2="65" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-approval)" />
                    <text x="130" y="58" textAnchor="middle" className="text-[10px]">"Create a Notion page"</text>

                    {/* 2. Tool call pending */}
                    <line x1="190" y1="100" x2="315" y2="100" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-approval)" />
                    <text x="252" y="93" textAnchor="middle" className="text-[10px]">notion_create_page (pending)</text>

                    {/* 3. Show approval buttons */}
                    <line x1="320" y1="135" x2="80" y2="135" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-approval)" />
                    <text x="200" y="128" textAnchor="middle" className="text-[10px]">Show approval buttons</text>

                    {/* Note: Approval options */}
                    <rect x="30" y="145" width="120" height="28" rx="2" className="fill-amber-50 stroke-amber-400 dark:fill-amber-900/30 dark:stroke-amber-500" strokeWidth="1" />
                    <text x="90" y="158" textAnchor="middle" className="text-[8px] fill-amber-700 dark:fill-amber-400">Allow | Trust Server</text>
                    <text x="90" y="168" textAnchor="middle" className="text-[8px] fill-amber-700 dark:fill-amber-400">Always Allow | Deny</text>

                    {/* 4. Click Allow */}
                    <line x1="75" y1="195" x2="315" y2="195" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-approval)" />
                    <text x="195" y="188" textAnchor="middle" className="text-[10px]">Click "Allow"</text>

                    {/* 5. Execute tool */}
                    <line x1="320" y1="225" x2="445" y2="225" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-approval)" />
                    <text x="382" y="218" textAnchor="middle" className="text-[10px]">Execute tool</text>

                    {/* 6. Result */}
                    <line x1="450" y1="255" x2="195" y2="255" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-approval)" />
                    <text x="322" y="248" textAnchor="middle" className="text-[10px]">Result</text>

                    {/* 7. Response to user */}
                    <line x1="190" y1="290" x2="80" y2="290" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-approval)" />
                    <text x="135" y="283" textAnchor="middle" className="text-[10px]">"I've created the page"</text>
                </g>

                {/* Arrow marker */}
                <defs>
                    <marker id="arrow-approval" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                        <path d="M 0 0 L 8 4 L 0 8 z" className="fill-gray-800 dark:fill-gray-300" />
                    </marker>
                </defs>
            </svg>
        </div>
    );
}
