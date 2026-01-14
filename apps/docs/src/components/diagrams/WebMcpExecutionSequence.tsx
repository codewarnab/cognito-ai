/**
 * WebMCP Tool Execution Sequence Diagram
 * 
 * Shows the complete flow of executing a WebMCP tool, including
 * security validation, HITL approval, and result handling.
 * 
 * Flow verified against:
 * - apps/extension/src/ai/tools/webmcpTools.ts (tool execution via background)
 * - apps/extension/src/background/webmcp/manager.ts (executeWebMCPTool, validation)
 * - apps/extension/src/entrypoints/webmcp-proxy.content.ts (executeTool)
 */
export function WebMcpExecutionSequence() {
    return (
        <div className="not-prose my-6 font-mono text-sm">
            <svg viewBox="0 0 1000 850" className="w-full max-w-5xl">
                {/* HITL approval block background */}
                <rect x={40} y={260} width={920} height={160} rx={4} className="fill-amber-50/50 dark:fill-amber-900/10" />

                {/* Participants */}
                <g className="fill-white dark:fill-gray-800 stroke-gray-300 dark:stroke-gray-600">
                    <rect x={50} y={10} width={110} height={50} rx={6} strokeWidth={1.5} />
                    <rect x={210} y={10} width={140} height={50} rx={6} strokeWidth={1.5} />
                    <rect x={410} y={10} width={150} height={50} rx={6} strokeWidth={1.5} />
                    <rect x={620} y={10} width={140} height={50} rx={6} strokeWidth={1.5} />
                    <rect x={820} y={10} width={120} height={50} rx={6} strokeWidth={1.5} />
                </g>

                {/* Participant Labels - text-base (16px) for main, text-[13px] for subtitle */}
                <g className="fill-gray-800 dark:fill-gray-200 text-base font-bold font-sans">
                    <text x={105} y={32} textAnchor="middle">AI Model</text>
                    <text x={105} y={50} textAnchor="middle" className="text-[13px] font-normal fill-gray-500 dark:fill-gray-400">Tool Call</text>
                    <text x={280} y={32} textAnchor="middle">Tool Renderer</text>
                    <text x={280} y={50} textAnchor="middle" className="text-[13px] font-normal fill-gray-500 dark:fill-gray-400">HITL UI</text>
                    <text x={485} y={32} textAnchor="middle">Background SW</text>
                    <text x={485} y={50} textAnchor="middle" className="text-[13px] font-normal fill-gray-500 dark:fill-gray-400">WebMCP Manager</text>
                    <text x={690} y={32} textAnchor="middle">Content Script</text>
                    <text x={690} y={50} textAnchor="middle" className="text-[13px] font-normal fill-gray-500 dark:fill-gray-400">webmcp-proxy</text>
                    <text x={880} y={32} textAnchor="middle">Web Page</text>
                    <text x={880} y={50} textAnchor="middle" className="text-[13px] font-normal fill-gray-500 dark:fill-gray-400">MCP Server</text>
                </g>

                {/* Lifelines */}
                <g className="stroke-gray-300 dark:stroke-gray-600" strokeWidth={1.5} strokeDasharray="6 4">
                    <line x1={105} y1={60} x2={105} y2={820} />
                    <line x1={280} y1={60} x2={280} y2={820} />
                    <line x1={485} y1={60} x2={485} y2={820} />
                    <line x1={690} y1={60} x2={690} y2={820} />
                    <line x1={880} y1={60} x2={880} y2={820} />
                </g>

                {/* 1. AI selects WebMCP tool (no execute function) */}
                <g>
                    <line x1={105} y1={100} x2={275} y2={100} className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-blue-exec)" />
                    <text x={190} y={90} textAnchor="middle" className="text-sm fill-blue-700 dark:fill-blue-300 font-sans font-medium">Tool call (pending)</text>
                    <text x={190} y={118} textAnchor="middle" className="text-[13px] fill-gray-500 dark:fill-gray-400 italic font-sans">No execute - HITL pattern</text>
                </g>

                {/* Tool call note */}
                <rect x={55} y={135} width={190} height={50} rx={4} className="fill-blue-50 stroke-blue-200 dark:fill-blue-900/30 dark:stroke-blue-700" strokeWidth={1} />
                <text x={150} y={155} textAnchor="middle" className="text-xs fill-blue-700 dark:fill-blue-300 font-mono">{`webmcp_example_com_search`}</text>
                <text x={150} y={173} textAnchor="middle" className="text-xs fill-blue-700 dark:fill-blue-300 font-mono">{`args: { query: "..." }`}</text>

                {/* 2. Check auto-approval */}
                <g>
                    <path d="M 280 210 Q 340 210 340 230 Q 340 250 280 250" className="fill-none stroke-gray-600 dark:stroke-gray-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-exec)" />
                    <text x={360} y={225} className="text-sm fill-gray-700 dark:fill-gray-300 font-sans">isWebmcpAutoApproved()</text>
                    <text x={360} y={245} className="text-[13px] fill-gray-500 dark:fill-gray-400 italic font-sans">Check approval store</text>
                </g>

                {/* HITL Approval Block */}
                <g>
                    <rect x={40} y={260} width={70} height={24} rx={0} className="fill-amber-100 dark:fill-amber-900/40 opacity-80" />
                    <text x={50} y={277} className="text-sm font-bold fill-amber-800 dark:fill-amber-200">ALT</text>
                    <text x={120} y={277} className="text-[13px] fill-amber-700 dark:fill-amber-300 italic font-sans">[not auto-approved → show approval UI]</text>
                    <rect x={40} y={260} width={920} height={160} rx={4} className="fill-none stroke-amber-200 dark:stroke-amber-800" strokeWidth={1} />
                </g>

                {/* Show approval dialog */}
                <g>
                    <path d="M 280 310 Q 340 310 340 335 Q 340 360 280 360" className="fill-none stroke-gray-600 dark:stroke-gray-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-exec)" />
                    <text x={360} y={330} className="text-sm fill-gray-700 dark:fill-gray-300 font-sans">Show CompactToolCard</text>
                    <text x={360} y={350} className="text-[13px] fill-gray-500 dark:fill-gray-400 italic font-sans">User reviews tool action</text>
                </g>

                {/* Approval options note */}
                <rect x={360} y={370} width={170} height={45} rx={4} className="fill-amber-50 stroke-amber-200 dark:fill-amber-900/30 dark:stroke-amber-700" strokeWidth={1} />
                <text x={445} y={390} textAnchor="middle" className="text-xs fill-amber-700 dark:fill-amber-300 font-mono">Allow | Trust Domain</text>
                <text x={445} y={408} textAnchor="middle" className="text-xs fill-amber-700 dark:fill-amber-300 font-mono">Always Allow | Session</text>

                {/* 3. Execute via background (after approval) */}
                <g>
                    <line x1={280} y1={460} x2={480} y2={460} className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-blue-exec)" />
                    <text x={380} y={450} textAnchor="middle" className="text-sm fill-blue-700 dark:fill-blue-300 font-sans font-medium">webmcp/tool/call</text>
                    <text x={380} y={478} textAnchor="middle" className="text-[13px] fill-gray-500 dark:fill-gray-400 italic font-sans">Execute via chrome.runtime</text>
                </g>

                {/* 4. Security validation */}
                <g>
                    <path d="M 485 520 Q 545 520 545 545 Q 545 570 485 570" className="fill-none stroke-gray-600 dark:stroke-gray-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-exec)" />
                    <text x={565} y={540} className="text-sm fill-gray-700 dark:fill-gray-300 font-sans">Security validation</text>
                    <text x={565} y={560} className="text-[13px] fill-gray-500 dark:fill-gray-400 italic font-sans">Origin + TabId + Schema</text>
                </g>

                {/* 5. Forward to content script */}
                <g>
                    <line x1={485} y1={610} x2={685} y2={610} className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-blue-exec)" />
                    <text x={585} y={600} textAnchor="middle" className="text-sm fill-blue-700 dark:fill-blue-300 font-sans font-medium">webmcp/tool/execute</text>
                    <text x={585} y={628} textAnchor="middle" className="text-[13px] fill-gray-500 dark:fill-gray-400 italic font-sans">chrome.tabs.sendMessage</text>
                </g>

                {/* 6. Execute on page */}
                <g>
                    <line x1={690} y1={670} x2={875} y2={670} className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-blue-exec)" />
                    <text x={782} y={660} textAnchor="middle" className="text-sm fill-blue-700 dark:fill-blue-300 font-sans font-medium">client.callTool()</text>
                    <text x={782} y={688} textAnchor="middle" className="text-[13px] fill-gray-500 dark:fill-gray-400 italic font-sans">MCP protocol call</text>
                </g>

                {/* 7. Result from page */}
                <g>
                    <line x1={880} y1={720} x2={695} y2={720} className="stroke-gray-500 dark:stroke-gray-400" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrow-open-exec)" />
                    <text x={787} y={710} textAnchor="middle" className="text-sm fill-gray-600 dark:fill-gray-400 font-sans">Tool result</text>
                </g>

                {/* 8. Result to background */}
                <g>
                    <line x1={690} y1={760} x2={490} y2={760} className="stroke-gray-500 dark:stroke-gray-400" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrow-open-exec)" />
                    <text x={590} y={750} textAnchor="middle" className="text-sm fill-gray-600 dark:fill-gray-400 font-sans">webmcp/tool/result</text>
                </g>

                {/* 9. addToolOutput to AI */}
                <g>
                    <line x1={485} y1={810} x2={110} y2={810} className="stroke-green-600 dark:stroke-green-400" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrow-open-green-exec)" />
                    <text x={297} y={800} textAnchor="middle" className="text-sm fill-green-700 dark:fill-green-300 font-sans font-medium">addToolOutput(result)</text>
                    <text x={297} y={828} textAnchor="middle" className="text-[13px] fill-gray-500 dark:fill-gray-400 italic font-sans">Resume AI generation</text>
                </g>

                {/* Arrow Definitions - unique IDs for this component */}
                <defs>
                    <marker id="arrow-filled-exec" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-gray-600 dark:fill-gray-400" />
                    </marker>
                    <marker id="arrow-filled-blue-exec" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-blue-600 dark:fill-blue-400" />
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
