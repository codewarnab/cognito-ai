/**
 * WebMCP Tool Approval Sequence Diagram
 * 
 * Shows the Human-in-the-Loop (HITL) approval flow for WebMCP tools.
 * WebMCP tools execute on third-party websites and require user approval
 * before execution for security reasons.
 * 
 * Flow verified against:
 * - apps/extension/src/ai/tools/webmcpTools.ts (tool conversion, HITL pattern)
 * - apps/extension/src/stores/approval/approvalStore.ts (approval checks)
 * - apps/extension/src/ai/tools/components/CompactToolRenderer.tsx (UI approval)
 */
export function WebMcpApprovalSequence() {
    return (
        <div className="not-prose my-6 font-mono text-sm">
            <svg viewBox="0 0 920 580" className="w-full max-w-5xl">
                {/* ALT block background - drawn first so it's behind everything */}
                <rect x={40} y={195} width={830} height={130} rx={4} className="fill-blue-50/50 dark:fill-blue-900/10" />

                {/* Participants */}
                <g className="fill-white dark:fill-gray-800 stroke-gray-300 dark:stroke-gray-600">
                    <rect x={50} y={10} width={100} height={40} rx={6} strokeWidth={1.5} />
                    <rect x={200} y={10} width={120} height={40} rx={6} strokeWidth={1.5} />
                    <rect x={380} y={10} width={120} height={40} rx={6} strokeWidth={1.5} />
                    <rect x={560} y={10} width={120} height={40} rx={6} strokeWidth={1.5} />
                    <rect x={750} y={10} width={120} height={40} rx={6} strokeWidth={1.5} />
                </g>

                {/* Participant Labels */}
                <g className="fill-gray-800 dark:fill-gray-200 text-xs font-bold font-sans">
                    <text x={100} y={28} textAnchor="middle">AI Model</text>
                    <text x={100} y={42} textAnchor="middle" className="text-[10px] font-normal fill-gray-500 dark:fill-gray-400">LLM Response</text>
                    <text x={260} y={28} textAnchor="middle">Approval Store</text>
                    <text x={260} y={42} textAnchor="middle" className="text-[10px] font-normal fill-gray-500 dark:fill-gray-400">Zustand State</text>
                    <text x={440} y={28} textAnchor="middle">Tool Renderer</text>
                    <text x={440} y={42} textAnchor="middle" className="text-[10px] font-normal fill-gray-500 dark:fill-gray-400">React UI</text>
                    <text x={620} y={28} textAnchor="middle">Background SW</text>
                    <text x={620} y={42} textAnchor="middle" className="text-[10px] font-normal fill-gray-500 dark:fill-gray-400">WebMCP Manager</text>
                    <text x={810} y={28} textAnchor="middle">Content Script</text>
                    <text x={810} y={42} textAnchor="middle" className="text-[10px] font-normal fill-gray-500 dark:fill-gray-400">Page Context</text>
                </g>

                {/* Lifelines */}
                <g className="stroke-gray-300 dark:stroke-gray-600" strokeWidth={1.5} strokeDasharray="6 4">
                    <line x1={100} y1={50} x2={100} y2={560} />
                    <line x1={260} y1={50} x2={260} y2={560} />
                    <line x1={440} y1={50} x2={440} y2={560} />
                    <line x1={620} y1={50} x2={620} y2={560} />
                    <line x1={810} y1={50} x2={810} y2={560} />
                </g>

                {/* 1. Tool call from LLM (no execute function) */}
                <g>
                    <line x1={100} y1={80} x2={435} y2={80} className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-blue-webmcp-approval)" />
                    <text x={267} y={73} textAnchor="middle" className="text-[11px] fill-blue-700 dark:fill-blue-300 font-sans font-medium">Tool call (pending approval)</text>
                    <text x={267} y={93} textAnchor="middle" className="text-[10px] fill-gray-500 dark:fill-gray-400 italic font-sans">No execute function - HITL pattern</text>
                </g>

                {/* Tool call note box */}
                <rect x={55} y={105} width={180} height={45} rx={4} className="fill-blue-50 stroke-blue-200 dark:fill-blue-900/30 dark:stroke-blue-700" strokeWidth={1} />
                <text x={145} y={120} textAnchor="middle" className="text-[10px] fill-blue-700 dark:fill-blue-300 font-mono">{`{ toolName: "webmcp_site_search",`}</text>
                <text x={145} y={133} textAnchor="middle" className="text-[10px] fill-blue-700 dark:fill-blue-300 font-mono">{`  args: { query: "..." } }`}</text>
                <text x={145} y={146} textAnchor="middle" className="text-[10px] fill-gray-500 dark:fill-gray-400 italic font-sans">Awaiting addToolOutput()</text>

                {/* 2. Check auto-approval */}
                <g>
                    <line x1={440} y1={170} x2={265} y2={170} className="stroke-gray-600 dark:stroke-gray-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-webmcp-approval)" />
                    <text x={352} y={163} textAnchor="middle" className="text-[11px] fill-gray-700 dark:fill-gray-300 font-sans">isWebmcpAutoApproved()</text>
                    <text x={352} y={183} textAnchor="middle" className="text-[10px] fill-gray-500 dark:fill-gray-400 italic font-sans">Check domain/tool/session approvals</text>
                </g>

                {/* ALT Block */}
                <g>
                    <rect x={40} y={195} width={70} height={20} rx={0} className="fill-blue-100 dark:fill-blue-900/40 opacity-80" />
                    <text x={50} y={209} className="text-[10px] font-bold fill-blue-800 dark:fill-blue-200">ALT</text>
                    <text x={120} y={209} className="text-[10px] fill-blue-700 dark:fill-blue-300 italic font-sans">[not auto-approved]</text>
                    <rect x={40} y={195} width={830} height={130} rx={4} className="fill-none stroke-blue-200 dark:stroke-blue-800" strokeWidth={1} />
                </g>

                {/* 3. Show approval dialog */}
                <g>
                    <path d="M 440 230 Q 490 230 490 250 Q 490 270 440 270" className="fill-none stroke-gray-600 dark:stroke-gray-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-webmcp-approval)" />
                    <text x={510} y={245} className="text-[11px] fill-gray-700 dark:fill-gray-300 font-sans">Show approval UI</text>
                    <text x={510} y={260} className="text-[10px] fill-gray-500 dark:fill-gray-400 italic font-sans">CompactToolCard</text>
                </g>

                {/* Approval options note */}
                <rect x={530} y={275} width={160} height={45} rx={4} className="fill-amber-50 stroke-amber-200 dark:fill-amber-900/30 dark:stroke-amber-700" strokeWidth={1} />
                <text x={610} y={290} textAnchor="middle" className="text-[10px] fill-amber-700 dark:fill-amber-300 font-sans font-medium">Approval Options:</text>
                <text x={610} y={303} textAnchor="middle" className="text-[10px] fill-amber-700 dark:fill-amber-300 font-mono">Allow | Trust Domain</text>
                <text x={610} y={316} textAnchor="middle" className="text-[10px] fill-amber-700 dark:fill-amber-300 font-mono">Always Allow | Session</text>

                {/* 4. User approves - execute tool */}
                <g>
                    <line x1={440} y1={350} x2={615} y2={350} className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-blue-webmcp-approval)" />
                    <text x={527} y={343} textAnchor="middle" className="text-[11px] fill-blue-700 dark:fill-blue-300 font-sans font-medium">webmcp/tool/call</text>
                    <text x={527} y={363} textAnchor="middle" className="text-[10px] fill-gray-500 dark:fill-gray-400 italic font-sans">Execute via background SW</text>
                </g>

                {/* 5. Validate & forward to content script */}
                <g>
                    <line x1={620} y1={395} x2={805} y2={395} className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-blue-webmcp-approval)" />
                    <text x={712} y={388} textAnchor="middle" className="text-[11px] fill-blue-700 dark:fill-blue-300 font-sans font-medium">webmcp/tool/execute</text>
                    <text x={712} y={408} textAnchor="middle" className="text-[10px] fill-gray-500 dark:fill-gray-400 italic font-sans">After origin + tabId validation</text>
                </g>

                {/* Security validation note */}
                <rect x={625} y={420} width={175} height={45} rx={4} className="fill-green-50 stroke-green-200 dark:fill-green-900/30 dark:stroke-green-700" strokeWidth={1} />
                <text x={712} y={435} textAnchor="middle" className="text-[10px] fill-green-700 dark:fill-green-300 font-sans font-medium">Security Checks:</text>
                <text x={712} y={448} textAnchor="middle" className="text-[10px] fill-green-700 dark:fill-green-300 font-mono">validateToolOrigin()</text>
                <text x={712} y={461} textAnchor="middle" className="text-[10px] fill-green-700 dark:fill-green-300 font-mono">validateToolTabId()</text>

                {/* 6. Execute on page */}
                <g>
                    <path d="M 810 480 Q 860 480 860 495 Q 860 510 810 510" className="fill-none stroke-gray-600 dark:stroke-gray-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-webmcp-approval)" />
                    <text x={875} y={495} className="text-[10px] fill-gray-700 dark:fill-gray-300 font-sans">client.callTool()</text>
                </g>

                {/* 7. Tool result returns */}
                <g>
                    <line x1={810} y1={530} x2={445} y2={530} className="stroke-green-600 dark:stroke-green-400" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrow-open-green-webmcp-approval)" />
                    <text x={627} y={523} textAnchor="middle" className="text-[11px] fill-green-700 dark:fill-green-300 font-sans font-medium">Tool result</text>
                </g>

                {/* 8. addToolOutput to AI */}
                <g>
                    <line x1={440} y1={555} x2={105} y2={555} className="stroke-green-600 dark:stroke-green-400" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrow-open-green-webmcp-approval)" />
                    <text x={272} y={548} textAnchor="middle" className="text-[11px] fill-green-700 dark:fill-green-300 font-sans font-medium">addToolOutput(result)</text>
                    <text x={272} y={568} textAnchor="middle" className="text-[10px] fill-gray-500 dark:fill-gray-400 italic font-sans">Resume AI generation</text>
                </g>

                {/* Arrow Definitions - unique IDs for this component */}
                <defs>
                    <marker id="arrow-filled-webmcp-approval" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-gray-600 dark:fill-gray-400" />
                    </marker>
                    <marker id="arrow-filled-blue-webmcp-approval" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-blue-600 dark:fill-blue-400" />
                    </marker>
                    <marker id="arrow-open-green-webmcp-approval" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-none stroke-green-600 dark:stroke-green-400" strokeWidth="1.5" />
                    </marker>
                </defs>
            </svg>
        </div>
    );
}
