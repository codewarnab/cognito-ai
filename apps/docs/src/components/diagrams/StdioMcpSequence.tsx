/**
 * StdIO MCP Sequence Diagram
 *
 * Shows how the extension communicates with StdIO MCP servers through the backend proxy.
 * Browsers cannot spawn local processes, so the backend acts as a proxy.
 *
 * Flow verified against:
 * - packages/backend-vercel/src/routes/ai/mcp.hono.ts (discover/execute endpoints)
 * - packages/backend-vercel/src/services/mcp/stdio.ts (StdioMcpService)
 * - apps/extension/src/mcp/client/ (extension MCP client)
 */
export function StdioMcpSequence() {
    return (
        <div className="not-prose my-6">
            <svg viewBox="0 0 920 620" className="w-full max-w-4xl">
                {/* Participants */}
                <g className="fill-white dark:fill-gray-800 stroke-gray-300 dark:stroke-gray-600">
                    <rect x={50} y={10} width={130} height={40} rx={6} strokeWidth={1.5} />
                    <rect x={240} y={10} width={140} height={40} rx={6} strokeWidth={1.5} />
                    <rect x={450} y={10} width={150} height={40} rx={6} strokeWidth={1.5} />
                    <rect x={680} y={10} width={140} height={40} rx={6} strokeWidth={1.5} />
                </g>

                {/* Participant Labels */}
                <g className="fill-gray-800 dark:fill-gray-200 text-xs font-bold font-sans">
                    <text x={115} y={28} textAnchor="middle">Extension UI</text>
                    <text x={115} y={42} textAnchor="middle" className="text-[10px] font-normal fill-gray-500 dark:fill-gray-400">Side Panel</text>
                    <text x={310} y={28} textAnchor="middle">Background SW</text>
                    <text x={310} y={42} textAnchor="middle" className="text-[10px] font-normal fill-gray-500 dark:fill-gray-400">MCP Client</text>
                    <text x={525} y={28} textAnchor="middle">Vercel Backend</text>
                    <text x={525} y={42} textAnchor="middle" className="text-[10px] font-normal fill-gray-500 dark:fill-gray-400">/api/ai/mcp/*</text>
                    <text x={750} y={28} textAnchor="middle">MCP Process</text>
                    <text x={750} y={42} textAnchor="middle" className="text-[10px] font-normal fill-gray-500 dark:fill-gray-400">StdIO Server</text>
                </g>

                {/* Lifelines */}
                <g className="stroke-gray-300 dark:stroke-gray-600" strokeWidth={1.5} strokeDasharray="6 4">
                    <line x1={115} y1={50} x2={115} y2={600} />
                    <line x1={310} y1={50} x2={310} y2={600} />
                    <line x1={525} y1={50} x2={525} y2={600} />
                    <line x1={750} y1={50} x2={750} y2={600} />
                </g>

                {/* ===== DISCOVERY PHASE ===== */}
                <rect x={30} y={70} width={860} height={200} rx={4} className="fill-blue-50/50 dark:fill-blue-900/10" />
                <rect x={30} y={70} width={90} height={20} rx={0} className="fill-blue-100 dark:fill-blue-900/40 opacity-80" />
                <text x={40} y={84} className="text-[10px] font-bold fill-blue-800 dark:fill-blue-200">DISCOVERY</text>
                <text x={130} y={84} className="text-[10px] fill-blue-700 dark:fill-blue-300 italic">[on MCP server enable]</text>
                <rect x={30} y={70} width={860} height={200} rx={4} className="fill-none stroke-blue-200 dark:stroke-blue-800" strokeWidth={1} />

                {/* 1. User enables MCP server */}
                <line x1={115} y1={105} x2={300} y2={105} className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={1.5} markerEnd="url(#arrow-stdio-blue)" />
                <text x={207} y={98} textAnchor="middle" className="text-[11px] fill-blue-700 dark:fill-blue-300 font-sans font-medium">discoverTools(serverId)</text>
                <text x={207} y={118} textAnchor="middle" className="text-[10px] fill-gray-500 dark:fill-gray-400 italic font-sans">User enables server in settings</text>

                {/* 2. Background sends to backend */}
                <line x1={310} y1={145} x2={515} y2={145} className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={1.5} markerEnd="url(#arrow-stdio-blue)" />
                <text x={412} y={138} textAnchor="middle" className="text-[11px] fill-blue-700 dark:fill-blue-300 font-sans font-medium">POST /api/ai/mcp/discover</text>

                {/* Request payload note */}
                <rect x={335} y={155} width={155} height={45} rx={4} className="fill-blue-50 stroke-blue-200 dark:fill-blue-900/30 dark:stroke-blue-700" strokeWidth={1} />
                <text x={412} y={172} textAnchor="middle" className="text-[10px] fill-blue-700 dark:fill-blue-300 font-mono">{`{ serverId, credentials }`}</text>
                <text x={412} y={188} textAnchor="middle" className="text-[10px] fill-gray-500 dark:fill-gray-400 italic">No raw commands sent</text>

                {/* 3. Backend spawns process */}
                <line x1={525} y1={215} x2={740} y2={215} className="stroke-gray-600 dark:stroke-gray-400" strokeWidth={1.5} markerEnd="url(#arrow-stdio-gray)" />
                <text x={632} y={208} textAnchor="middle" className="text-[11px] fill-gray-700 dark:fill-gray-300 font-sans font-medium">Spawn via StdioMCPTransport</text>
                <text x={632} y={228} textAnchor="middle" className="text-[10px] fill-gray-500 dark:fill-gray-400 italic font-sans">Registry lookup → command + args</text>

                {/* 4. Tool schemas returned */}
                <line x1={750} y1={250} x2={535} y2={250} className="stroke-green-600 dark:stroke-green-400" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrow-stdio-green)" />
                <text x={642} y={243} textAnchor="middle" className="text-[11px] fill-green-700 dark:fill-green-300 font-sans font-medium">Tool schemas (JSON)</text>

                {/* ===== EXECUTION PHASE ===== */}
                <rect x={30} y={290} width={860} height={290} rx={4} className="fill-amber-50/50 dark:fill-amber-900/10" />
                <rect x={30} y={290} width={90} height={20} rx={0} className="fill-amber-100 dark:fill-amber-900/40 opacity-80" />
                <text x={40} y={304} className="text-[10px] font-bold fill-amber-800 dark:fill-amber-200">EXECUTION</text>
                <text x={130} y={304} className="text-[10px] fill-amber-700 dark:fill-amber-300 italic">[when AI calls MCP tool]</text>
                <rect x={30} y={290} width={860} height={290} rx={4} className="fill-none stroke-amber-200 dark:stroke-amber-800" strokeWidth={1} />

                {/* 5. AI requests tool execution */}
                <line x1={115} y1={330} x2={300} y2={330} className="stroke-amber-600 dark:stroke-amber-400" strokeWidth={1.5} markerEnd="url(#arrow-stdio-amber)" />
                <text x={207} y={323} textAnchor="middle" className="text-[11px] fill-amber-700 dark:fill-amber-300 font-sans font-medium">executeTool(name, args)</text>
                <text x={207} y={343} textAnchor="middle" className="text-[10px] fill-gray-500 dark:fill-gray-400 italic font-sans">Tool call from AI response</text>

                {/* 6. Background sends execute request */}
                <line x1={310} y1={375} x2={515} y2={375} className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={1.5} markerEnd="url(#arrow-stdio-blue)" />
                <text x={412} y={368} textAnchor="middle" className="text-[11px] fill-blue-700 dark:fill-blue-300 font-sans font-medium">POST /api/ai/mcp/execute</text>

                {/* Execute payload note */}
                <rect x={335} y={385} width={155} height={55} rx={4} className="fill-blue-50 stroke-blue-200 dark:fill-blue-900/30 dark:stroke-blue-700" strokeWidth={1} />
                <text x={412} y={402} textAnchor="middle" className="text-[10px] fill-blue-700 dark:fill-blue-300 font-mono">{`{ serverId, toolName,`}</text>
                <text x={412} y={418} textAnchor="middle" className="text-[10px] fill-blue-700 dark:fill-blue-300 font-mono">{`  toolArgs, credentials }`}</text>
                <text x={412} y={434} textAnchor="middle" className="text-[10px] fill-gray-500 dark:fill-gray-400 italic">Secure server-side exec</text>

                {/* 7. Backend calls tool via stdin */}
                <line x1={525} y1={460} x2={740} y2={460} className="stroke-gray-600 dark:stroke-gray-400" strokeWidth={1.5} markerEnd="url(#arrow-stdio-gray)" />
                <text x={632} y={453} textAnchor="middle" className="text-[11px] fill-gray-700 dark:fill-gray-300 font-sans font-medium">tool.execute(args) via stdin</text>
                <text x={632} y={473} textAnchor="middle" className="text-[10px] fill-gray-500 dark:fill-gray-400 italic font-sans">JSON-RPC over stdio</text>

                {/* 8. Result via stdout */}
                <line x1={750} y1={505} x2={535} y2={505} className="stroke-green-600 dark:stroke-green-400" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrow-stdio-green)" />
                <text x={642} y={498} textAnchor="middle" className="text-[11px] fill-green-700 dark:fill-green-300 font-sans font-medium">Result via stdout</text>

                {/* 9. Result to background */}
                <line x1={525} y1={540} x2={320} y2={540} className="stroke-green-600 dark:stroke-green-400" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrow-stdio-green)" />
                <text x={422} y={533} textAnchor="middle" className="text-[11px] fill-green-700 dark:fill-green-300 font-sans font-medium">{`{ result: ... }`}</text>

                {/* 10. Result to UI */}
                <line x1={310} y1={570} x2={125} y2={570} className="stroke-green-600 dark:stroke-green-400" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrow-stdio-green)" />
                <text x={217} y={563} textAnchor="middle" className="text-[11px] fill-green-700 dark:fill-green-300 font-sans font-medium">Tool result → AI continues</text>

                {/* Arrow markers with unique IDs */}
                <defs>
                    <marker id="arrow-stdio-blue" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-blue-600 dark:fill-blue-400" />
                    </marker>
                    <marker id="arrow-stdio-gray" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-gray-600 dark:fill-gray-400" />
                    </marker>
                    <marker id="arrow-stdio-amber" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-amber-600 dark:fill-amber-400" />
                    </marker>
                    <marker id="arrow-stdio-green" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-none stroke-green-600 dark:stroke-green-400" strokeWidth="1.5" />
                    </marker>
                </defs>
            </svg>
        </div>
    );
}
