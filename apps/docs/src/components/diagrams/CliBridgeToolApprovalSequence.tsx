export function CliBridgeToolApprovalSequence() {
    return (
        <div className="not-prose my-6 font-mono text-sm">
            <svg viewBox="0 0 950 850" className="w-full max-w-5xl">
                {/* Alt block background for approval flow */}
                <rect x={50} y={250} width={870} height={380} rx={4} className="fill-amber-50/50 dark:fill-amber-900/10" />

                {/* Participants */}
                <g className="fill-white dark:fill-gray-800 stroke-gray-300 dark:stroke-gray-600">
                    <rect x={60} y={10} width={100} height={40} rx={6} className="shadow-sm" strokeWidth={1.5} />
                    <rect x={210} y={10} width={130} height={40} rx={6} className="shadow-sm" strokeWidth={1.5} />
                    <rect x={400} y={10} width={130} height={40} rx={6} className="shadow-sm" strokeWidth={1.5} />
                    <rect x={600} y={10} width={120} height={40} rx={6} className="shadow-sm" strokeWidth={1.5} />
                    <rect x={790} y={10} width={80} height={40} rx={6} className="shadow-sm" strokeWidth={1.5} />
                </g>

                {/* Participant Labels */}
                <g className="fill-gray-800 dark:fill-gray-200 text-xs font-bold font-sans">
                    <text x={110} y={35} textAnchor="middle">CLI Bridge</text>
                    <text x={275} y={35} textAnchor="middle">toolBridgeClient</text>
                    <text x={465} y={35} textAnchor="middle">cliToolApproval</text>
                    <text x={660} y={35} textAnchor="middle">Approval UI</text>
                    <text x={830} y={35} textAnchor="middle">User</text>
                </g>

                {/* Lifelines */}
                <g className="stroke-gray-300 dark:stroke-gray-600" strokeWidth={1.5} strokeDasharray="6 4">
                    <line x1={110} y1={50} x2={110} y2={830} />
                    <line x1={275} y1={50} x2={275} y2={830} />
                    <line x1={465} y1={50} x2={465} y2={830} />
                    <line x1={660} y1={50} x2={660} y2={830} />
                    <line x1={830} y1={50} x2={830} y2={830} />
                </g>

                {/* 1. SSE tool:execute event from CLI Bridge */}
                <g>
                    <line x1={110} y1={80} x2={270} y2={80} className="stroke-amber-600 dark:stroke-amber-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-amber-approval)" />
                    <text x={190} y={72} textAnchor="middle" className="text-[11px] fill-amber-700 dark:fill-amber-300 font-sans font-medium">SSE: tool:execute</text>

                    {/* Request payload note - positioned with more space */}
                    <rect x={115} y={95} width={155} height={70} rx={4} className="fill-amber-50 stroke-amber-200 dark:fill-amber-900/30 dark:stroke-amber-700" strokeWidth={1} />
                    <text x={192} y={112} textAnchor="middle" className="text-[10px] fill-amber-700 dark:fill-amber-300 font-mono">{`{ requestId: "abc123",`}</text>
                    <text x={192} y={127} textAnchor="middle" className="text-[10px] fill-amber-700 dark:fill-amber-300 font-mono">{`  toolName: "clickByText",`}</text>
                    <text x={192} y={142} textAnchor="middle" className="text-[10px] fill-amber-700 dark:fill-amber-300 font-mono">{`  args: {...},`}</text>
                    <text x={192} y={157} textAnchor="middle" className="text-[10px] fill-amber-700 dark:fill-amber-300 font-mono">{`  interactive: true }`}</text>
                </g>

                {/* 2. Check if approval required (self-call) */}
                <g>
                    <path d="M 275 195 Q 330 195 330 212 Q 330 229 275 229" className="fill-none stroke-gray-600 dark:stroke-gray-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-approval)" />
                    <text x={350} y={207} className="text-[11px] fill-gray-700 dark:fill-gray-300 font-sans">Check requiresApproval()</text>
                    <text x={350} y={222} className="text-[10px] fill-gray-500 dark:fill-gray-400 italic font-sans">Check tool list & MCP status</text>
                </g>

                {/* ALT Block for approval flow */}
                <g>
                    <rect x={50} y={250} width={60} height={20} rx={0} className="fill-amber-100 dark:fill-amber-900/40 opacity-80" />
                    <text x={60} y={264} className="text-[10px] font-bold fill-amber-800 dark:fill-amber-200">ALT</text>
                    <text x={120} y={264} className="text-[10px] fill-amber-700 dark:fill-amber-300 italic font-sans">[requires approval + interactive + CLI mode]</text>
                    <rect x={50} y={250} width={870} height={380} rx={4} className="fill-none stroke-amber-200 dark:stroke-amber-800" strokeWidth={1} />
                </g>

                {/* 3. Wait for approval - creates pending promise */}
                <g>
                    <line x1={275} y1={295} x2={460} y2={295} className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-blue-approval)" />
                    <text x={367} y={287} textAnchor="middle" className="text-[11px] fill-blue-700 dark:fill-blue-300 font-sans font-medium">waitForCliToolApproval(requestId)</text>

                    {/* Activation box for cliToolApproval */}
                    <rect x={460} y={295} width={10} height={200} className="fill-blue-100 stroke-blue-300 dark:fill-blue-900/50 dark:stroke-blue-700" strokeWidth={1} />

                    {/* Note about promise */}
                    <rect x={280} y={305} width={170} height={25} rx={4} className="fill-blue-50 stroke-blue-200 dark:fill-blue-900/30 dark:stroke-blue-700" strokeWidth={1} />
                    <text x={365} y={322} textAnchor="middle" className="text-[10px] fill-blue-700 dark:fill-blue-300 font-mono">Stores in pendingApprovals Map</text>
                </g>

                {/* 4. UI renders approval card */}
                <g>
                    <line x1={465} y1={355} x2={655} y2={355} className="stroke-gray-600 dark:stroke-gray-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-approval)" />
                    <text x={560} y={347} textAnchor="middle" className="text-[11px] fill-gray-700 dark:fill-gray-300 font-sans">Render CompactToolRenderer</text>

                    {/* Note about toolCallId alignment */}
                    <rect x={485} y={365} width={170} height={35} rx={4} className="fill-gray-50 stroke-gray-200 dark:fill-gray-800/50 dark:stroke-gray-700" strokeWidth={1} />
                    <text x={570} y={382} textAnchor="middle" className="text-[10px] fill-gray-600 dark:fill-gray-400 font-mono">toolCallId === requestId</text>
                    <text x={570} y={395} textAnchor="middle" className="text-[10px] fill-gray-500 dark:fill-gray-400 italic font-sans">IDs aligned for matching</text>
                </g>

                {/* 5. Show approval card to user */}
                <g>
                    <line x1={660} y1={420} x2={825} y2={420} className="stroke-gray-600 dark:stroke-gray-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-approval)" />
                    <text x={742} y={412} textAnchor="middle" className="text-[11px] fill-gray-700 dark:fill-gray-300 font-sans">Display approval card</text>
                    <text x={742} y={435} textAnchor="middle" className="text-[10px] fill-gray-500 dark:fill-gray-400 italic font-sans">"Allow clickByText?"</text>
                </g>

                {/* 6. User clicks Approve or Deny */}
                <g>
                    <line x1={830} y1={465} x2={665} y2={465} className="stroke-green-600 dark:stroke-green-400" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrow-open-green-approval)" />
                    <text x={747} y={457} textAnchor="middle" className="text-[11px] fill-green-700 dark:fill-green-300 font-sans font-medium">Click "Approve"</text>
                    <text x={747} y={480} textAnchor="middle" className="text-[10px] fill-gray-500 dark:fill-gray-400 italic font-sans">or "Deny" with reason</text>
                </g>

                {/* 7. UI calls approveCliToolCall */}
                <g>
                    <line x1={660} y1={515} x2={470} y2={515} className="stroke-green-600 dark:stroke-green-400" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrow-open-green-approval)" />
                    <text x={565} y={507} textAnchor="middle" className="text-[11px] fill-green-700 dark:fill-green-300 font-sans font-medium">approveCliToolCall(requestId)</text>
                    <text x={565} y={530} textAnchor="middle" className="text-[10px] fill-gray-500 dark:fill-gray-400 italic font-sans">Resolves pending Promise</text>
                </g>

                {/* 8. Promise resolves, returns to toolBridgeClient */}
                <g>
                    <line x1={465} y1={565} x2={280} y2={565} className="stroke-green-600 dark:stroke-green-400" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrow-open-green-approval)" />
                    <text x={372} y={557} textAnchor="middle" className="text-[11px] fill-green-700 dark:fill-green-300 font-sans">Promise resolved</text>
                    <text x={372} y={580} textAnchor="middle" className="text-[10px] fill-gray-500 dark:fill-gray-400 italic font-sans">Approval granted, continue</text>
                </g>

                {/* Alt divider - no approval needed path */}
                <g>
                    <line x1={50} y1={610} x2={920} y2={610} className="stroke-gray-300 dark:stroke-gray-600" strokeWidth={1} strokeDasharray="3 2" />
                    <text x={60} y={625} className="text-[10px] fill-gray-500 dark:fill-gray-400 font-sans">[no approval needed]</text>
                </g>

                {/* 9. Execute tool locally */}
                <g>
                    <path d="M 275 670 Q 330 670 330 690 Q 330 710 275 710" className="fill-none stroke-gray-600 dark:stroke-gray-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-approval)" />
                    <text x={350} y={685} className="text-[11px] fill-gray-700 dark:fill-gray-300 font-sans">executeToolLocally(toolCall)</text>
                    <text x={350} y={700} className="text-[10px] fill-gray-500 dark:fill-gray-400 italic font-sans">Run tool in browser</text>

                    {/* Tool call structure note */}
                    <rect x={285} y={720} width={140} height={50} rx={4} className="fill-gray-50 stroke-gray-200 dark:fill-gray-800/50 dark:stroke-gray-700" strokeWidth={1} />
                    <text x={355} y={737} textAnchor="middle" className="text-[10px] fill-gray-700 dark:fill-gray-300 font-mono">{`{ id: requestId,`}</text>
                    <text x={355} y={752} textAnchor="middle" className="text-[10px] fill-gray-700 dark:fill-gray-300 font-mono">{`  name: toolName,`}</text>
                    <text x={355} y={767} textAnchor="middle" className="text-[10px] fill-gray-700 dark:fill-gray-300 font-mono">{`  arguments: args }`}</text>
                </g>

                {/* 10. Send result back to CLI Bridge */}
                <g>
                    <line x1={275} y1={800} x2={115} y2={800} className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrow-open-blue-approval)" />
                    <text x={195} y={792} textAnchor="middle" className="text-[11px] fill-blue-700 dark:fill-blue-300 font-sans font-medium">POST /bridge/tools/result</text>

                    {/* Result payload note */}
                    <rect x={120} y={810} width={155} height={35} rx={4} className="fill-blue-50 stroke-blue-200 dark:fill-blue-900/30 dark:stroke-blue-700" strokeWidth={1} />
                    <text x={197} y={827} textAnchor="middle" className="text-[10px] fill-blue-700 dark:fill-blue-300 font-mono">{`{ requestId, success,`}</text>
                    <text x={197} y={842} textAnchor="middle" className="text-[10px] fill-blue-700 dark:fill-blue-300 font-mono">{`  result: {...} }`}</text>
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
                    <marker id="arrow-open-blue-approval" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-none stroke-blue-600 dark:stroke-blue-400" strokeWidth="1.5" />
                    </marker>
                </defs>
            </svg>
        </div>
    );
}
