/**
 * ToolApprovalSequence - SVG-based sequence diagram for tool approval flow
 * 
 * Shows the human-in-the-loop (HITL) approval process for sensitive tools
 * Covers built-in tools, MCP tools, and WebMCP tools
 * 
 * Based on actual implementation in:
 * - CompactToolRenderer.tsx (approval UI logic)
 * - approvalStore.ts (preference persistence)
 * - streamExecutor.ts (stripping execute for HITL)
 */

export function ToolApprovalSequence() {
    return (
        <div className="not-prose my-6 font-mono text-sm">
            <svg viewBox="0 0 600 380" className="w-full max-w-2xl">
                {/* Participants */}
                <g className="fill-current text-gray-800 dark:text-gray-200">
                    <rect x="30" y="10" width="70" height="30" rx="4" className="fill-blue-100 stroke-blue-500 dark:fill-blue-900/40 dark:stroke-blue-400" strokeWidth="1.5" />
                    <text x="65" y="30" textAnchor="middle" className="text-[10px] font-medium">AI Model</text>

                    <rect x="150" y="10" width="90" height="30" rx="4" className="fill-purple-100 stroke-purple-500 dark:fill-purple-900/40 dark:stroke-purple-400" strokeWidth="1.5" />
                    <text x="195" y="30" textAnchor="middle" className="text-[10px] font-medium">Tool Executor</text>

                    <rect x="290" y="10" width="90" height="30" rx="4" className="fill-amber-100 stroke-amber-500 dark:fill-amber-900/40 dark:stroke-amber-400" strokeWidth="1.5" />
                    <text x="335" y="30" textAnchor="middle" className="text-[10px] font-medium">Approval UI</text>

                    <rect x="430" y="10" width="60" height="30" rx="4" className="fill-green-100 stroke-green-500 dark:fill-green-900/40 dark:stroke-green-400" strokeWidth="1.5" />
                    <text x="460" y="30" textAnchor="middle" className="text-[10px] font-medium">User</text>

                    <rect x="530" y="10" width="55" height="30" rx="4" className="fill-gray-100 stroke-gray-500 dark:fill-gray-800 dark:stroke-gray-400" strokeWidth="1.5" />
                    <text x="557" y="30" textAnchor="middle" className="text-[10px] font-medium">Store</text>
                </g>

                {/* Lifelines */}
                <g className="stroke-gray-400 dark:stroke-gray-500" strokeWidth="1" strokeDasharray="4 3">
                    <line x1="65" y1="40" x2="65" y2="370" />
                    <line x1="195" y1="40" x2="195" y2="370" />
                    <line x1="335" y1="40" x2="335" y2="370" />
                    <line x1="460" y1="40" x2="460" y2="370" />
                    <line x1="557" y1="40" x2="557" y2="370" />
                </g>

                {/* Messages */}
                <g className="fill-current text-gray-700 dark:text-gray-300">
                    {/* 1. Tool call request */}
                    <line x1="65" y1="70" x2="190" y2="70" className="stroke-blue-500 dark:stroke-blue-400" strokeWidth="1.5" markerEnd="url(#arrow-approval-flow)" />
                    <text x="127" y="62" textAnchor="middle" className="text-[10px]">Tool call request</text>

                    {/* 2. Check: requires approval? */}
                    <rect x="135" y="85" width="120" height="22" rx="3" className="fill-purple-50 stroke-purple-400 dark:fill-purple-900/25 dark:stroke-purple-500" strokeWidth="1" />
                    <text x="195" y="100" textAnchor="middle" className="text-[9px] fill-purple-700 dark:fill-purple-300">Requires approval?</text>

                    {/* Note about tool types */}
                    <rect x="10" y="115" width="110" height="32" rx="2" className="fill-blue-50/50 dark:fill-blue-900/20" />
                    <text x="65" y="128" textAnchor="middle" className="text-[8px] fill-blue-600 dark:fill-blue-400">Built-in sensitive</text>
                    <text x="65" y="140" textAnchor="middle" className="text-[8px] fill-blue-600 dark:fill-blue-400">MCP / WebMCP tools</text>

                    {/* 3. Forward to UI (strip execute) */}
                    <line x1="195" y1="160" x2="330" y2="160" className="stroke-purple-500 dark:stroke-purple-400" strokeWidth="1.5" markerEnd="url(#arrow-approval-flow)" />
                    <text x="262" y="152" textAnchor="middle" className="text-[10px]">Pending (no execute)</text>

                    {/* 4. Check auto-approved */}
                    <line x1="335" y1="185" x2="552" y2="185" className="stroke-amber-500 dark:stroke-amber-400" strokeWidth="1.5" markerEnd="url(#arrow-approval-flow)" />
                    <text x="443" y="177" textAnchor="middle" className="text-[10px]">Check auto-approved?</text>

                    {/* 5. Store response */}
                    <line x1="557" y1="205" x2="340" y2="205" className="stroke-gray-500 dark:stroke-gray-400" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-approval-flow)" />
                    <text x="448" y="218" textAnchor="middle" className="text-[9px]">Session / Domain / Always</text>

                    {/* Alt box for approval decision */}
                    <rect x="275" y="230" width="205" height="80" rx="3" className="fill-none stroke-gray-500 dark:stroke-gray-400" strokeWidth="1" strokeDasharray="3 2" />
                    <text x="285" y="245" className="text-[9px] font-semibold fill-gray-600 dark:fill-gray-400">alt</text>
                    <text x="360" y="245" className="text-[8px] fill-gray-500 dark:fill-gray-400">[Not auto-approved]</text>

                    {/* 6. Show approval buttons */}
                    <line x1="335" y1="260" x2="455" y2="260" className="stroke-amber-500 dark:stroke-amber-400" strokeWidth="1.5" markerEnd="url(#arrow-approval-flow)" />
                    <text x="395" y="252" textAnchor="middle" className="text-[9px]">Show buttons</text>

                    {/* Approval options note */}
                    <rect x="408" y="268" width="70" height="35" rx="2" className="fill-amber-50 stroke-amber-400 dark:fill-amber-900/30 dark:stroke-amber-500" strokeWidth="1" />
                    <text x="443" y="282" textAnchor="middle" className="text-[8px] fill-amber-700 dark:fill-amber-400">Allow | Deny</text>
                    <text x="443" y="295" textAnchor="middle" className="text-[8px] fill-amber-700 dark:fill-amber-400">+ Auto options ▼</text>

                    {/* 7. User approves */}
                    <line x1="460" y1="320" x2="340" y2="320" className="stroke-green-500 dark:stroke-green-400" strokeWidth="1.5" markerEnd="url(#arrow-approval-flow)" />
                    <text x="400" y="332" textAnchor="middle" className="text-[9px]">Click "Allow"</text>

                    {/* 8. Execute and return */}
                    <line x1="335" y1="345" x2="200" y2="345" className="stroke-amber-500 dark:stroke-amber-400" strokeWidth="1.5" markerEnd="url(#arrow-approval-flow)" />
                    <text x="267" y="337" textAnchor="middle" className="text-[9px]">Execute + addToolOutput</text>

                    {/* 9. Result back to AI */}
                    <line x1="195" y1="365" x2="70" y2="365" className="stroke-purple-500 dark:stroke-purple-400" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-approval-flow)" />
                    <text x="132" y="357" textAnchor="middle" className="text-[9px]">Tool result</text>
                </g>

                {/* Arrow marker */}
                <defs>
                    <marker id="arrow-approval-flow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                        <path d="M 0 0 L 8 4 L 0 8 z" className="fill-gray-800 dark:fill-gray-300" />
                    </marker>
                </defs>
            </svg>
        </div>
    );
}
