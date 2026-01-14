export function CliBridgeToolApprovalSequence() {
    return (
        <div className="not-prose my-6 font-mono text-sm">
            <svg viewBox="0 0 750 400" className="w-full max-w-3xl">
                {/* Participants */}
                <g className="fill-current text-gray-800 dark:text-gray-200">
                    <rect x="30" y="10" width="100" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="80" y="30" textAnchor="middle" className="text-[11px] font-medium">CLI Bridge</text>

                    <rect x="170" y="10" width="120" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="230" y="30" textAnchor="middle" className="text-[11px] font-medium">toolBridgeClient</text>

                    <rect x="340" y="10" width="120" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="400" y="30" textAnchor="middle" className="text-[11px] font-medium">cliToolApproval</text>

                    <rect x="510" y="10" width="100" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="560" y="30" textAnchor="middle" className="text-[11px] font-medium">Approval UI</text>

                    <rect x="650" y="10" width="80" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="690" y="30" textAnchor="middle" className="text-[11px] font-medium">User</text>
                </g>

                {/* Lifelines */}
                <g className="stroke-gray-400 dark:stroke-gray-500" strokeWidth="1" strokeDasharray="4 3">
                    <line x1="80" y1="40" x2="80" y2="390" />
                    <line x1="230" y1="40" x2="230" y2="390" />
                    <line x1="400" y1="40" x2="400" y2="390" />
                    <line x1="560" y1="40" x2="560" y2="390" />
                    <line x1="690" y1="40" x2="690" y2="390" />
                </g>

                {/* Messages */}
                <g className="fill-current text-gray-700 dark:text-gray-300">
                    {/* 1. Tool execution request via SSE */}
                    <line x1="80" y1="65" x2="225" y2="65" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-approval)" />
                    <text x="152" y="58" textAnchor="middle" className="text-[10px]">SSE: tool:execute</text>

                    {/* Note: interactive = true */}
                    <rect x="85" y="73" width="135" height="22" rx="2" className="fill-amber-50 stroke-amber-400 dark:fill-amber-900/30 dark:stroke-amber-500" strokeWidth="1" />
                    <text x="152" y="88" textAnchor="middle" className="text-[9px] fill-amber-700 dark:fill-amber-400">{`{requestId, interactive: true}`}</text>

                    {/* 2. Check if approval required */}
                    <path d="M 230 110 Q 270 110 270 125 Q 270 140 230 140" className="fill-none stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-approval)" />
                    <text x="285" y="128" className="text-[10px]">requiresApproval?</text>

                    {/* Alt box for approval flow */}
                    <rect x="160" y="155" width="570" height="180" rx="3" className="fill-none stroke-gray-500 dark:stroke-gray-400" strokeWidth="1" />
                    <text x="170" y="170" className="text-[10px] font-semibold fill-gray-600 dark:fill-gray-400">alt</text>
                    <text x="195" y="170" className="text-[9px] fill-gray-500 dark:fill-gray-400">[tool requires approval]</text>

                    {/* 3. Wait for approval */}
                    <line x1="230" y1="190" x2="395" y2="190" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-approval)" />
                    <text x="312" y="183" textAnchor="middle" className="text-[10px]">waitForCliToolApproval()</text>

                    {/* Activation box */}
                    <rect x="395" y="190" width="10" height="90" className="fill-gray-200 stroke-gray-400 dark:fill-gray-700 dark:stroke-gray-500" strokeWidth="1" />

                    {/* 4. Show approval card */}
                    <line x1="400" y1="210" x2="555" y2="210" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-approval)" />
                    <text x="477" y="203" textAnchor="middle" className="text-[10px]">Render approval card</text>

                    {/* 5. User decision */}
                    <line x1="560" y1="235" x2="685" y2="235" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-approval)" />
                    <text x="622" y="228" textAnchor="middle" className="text-[10px]">Show card</text>

                    {/* 6. Approve/Deny */}
                    <line x1="690" y1="260" x2="565" y2="260" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-approval)" />
                    <text x="627" y="253" textAnchor="middle" className="text-[10px]">Approve / Deny</text>

                    {/* 7. Resolve promise */}
                    <line x1="560" y1="280" x2="405" y2="280" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-approval)" />
                    <text x="482" y="273" textAnchor="middle" className="text-[10px]">approveCliToolCall(id)</text>

                    {/* End alt - no approval path */}
                    <line x1="160" y1="315" x2="730" y2="315" className="stroke-gray-300 dark:stroke-gray-600" strokeWidth="1" strokeDasharray="3 2" />
                    <text x="170" y="328" className="text-[9px] fill-gray-500 dark:fill-gray-400">[no approval needed]</text>

                    {/* 8. Execute tool */}
                    <path d="M 230 345 Q 270 345 270 360 Q 270 375 230 375" className="fill-none stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-approval)" />
                    <text x="285" y="363" className="text-[10px]">executeToolLocally()</text>

                    {/* 9. Return result */}
                    <line x1="230" y1="390" x2="85" y2="390" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-approval)" />
                    <text x="157" y="383" textAnchor="middle" className="text-[10px]">POST /bridge/tools/result</text>
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
