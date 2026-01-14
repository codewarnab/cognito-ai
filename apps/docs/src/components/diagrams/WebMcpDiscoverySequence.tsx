/**
 * WebMCP Tool Discovery Sequence Diagram
 * 
 * Shows how WebMCP tools are discovered from web pages and registered
 * with the extension. This happens automatically when navigating to
 * WebMCP-enabled websites.
 * 
 * Flow verified against:
 * - apps/extension/src/entrypoints/webmcp-proxy.content.ts (content script discovery)
 * - apps/extension/src/background/webmcp/manager.ts (tool registration, state management)
 */
export function WebMcpDiscoverySequence() {
    return (
        <div className="not-prose my-6 font-mono text-sm">
            <svg viewBox="0 0 1000 750" className="w-full max-w-5xl">
                {/* OPT block background - drawn first */}
                <rect x={40} y={530} width={920} height={100} rx={4} className="fill-blue-50/50 dark:fill-blue-900/10" />

                {/* Participants */}
                <g className="fill-white dark:fill-gray-800 stroke-gray-300 dark:stroke-gray-600">
                    <rect x={50} y={10} width={120} height={50} rx={6} strokeWidth={1.5} />
                    <rect x={230} y={10} width={140} height={50} rx={6} strokeWidth={1.5} />
                    <rect x={440} y={10} width={150} height={50} rx={6} strokeWidth={1.5} />
                    <rect x={660} y={10} width={120} height={50} rx={6} strokeWidth={1.5} />
                    <rect x={850} y={10} width={100} height={50} rx={6} strokeWidth={1.5} />
                </g>

                {/* Participant Labels - using text-base (16px) for main labels */}
                <g className="fill-gray-800 dark:fill-gray-200 text-base font-bold font-sans">
                    <text x={110} y={32} textAnchor="middle">Web Page</text>
                    <text x={110} y={50} textAnchor="middle" className="text-[13px] font-normal fill-gray-500 dark:fill-gray-400">MCP Server</text>
                    <text x={300} y={32} textAnchor="middle">Content Script</text>
                    <text x={300} y={50} textAnchor="middle" className="text-[13px] font-normal fill-gray-500 dark:fill-gray-400">webmcp-proxy</text>
                    <text x={515} y={32} textAnchor="middle">Background SW</text>
                    <text x={515} y={50} textAnchor="middle" className="text-[13px] font-normal fill-gray-500 dark:fill-gray-400">WebMCP Manager</text>
                    <text x={720} y={32} textAnchor="middle">Side Panel</text>
                    <text x={720} y={50} textAnchor="middle" className="text-[13px] font-normal fill-gray-500 dark:fill-gray-400">React UI</text>
                    <text x={900} y={40} textAnchor="middle">AI Chat</text>
                </g>

                {/* Lifelines */}
                <g className="stroke-gray-300 dark:stroke-gray-600" strokeWidth={1.5} strokeDasharray="6 4">
                    <line x1={110} y1={60} x2={110} y2={720} />
                    <line x1={300} y1={60} x2={300} y2={720} />
                    <line x1={515} y1={60} x2={515} y2={720} />
                    <line x1={720} y1={60} x2={720} y2={720} />
                    <line x1={900} y1={60} x2={900} y2={720} />
                </g>

                {/* Page load trigger note */}
                <rect x={225} y={80} width={150} height={30} rx={4} className="fill-blue-50 stroke-blue-200 dark:fill-blue-900/30 dark:stroke-blue-700" strokeWidth={1} />
                <text x={300} y={100} textAnchor="middle" className="text-[13px] fill-blue-700 dark:fill-blue-300 font-sans">Page loads (document_idle)</text>

                {/* 1. Connect via TabClientTransport */}
                <g>
                    <line x1={300} y1={140} x2={115} y2={140} className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-blue-discovery)" />
                    <text x={207} y={130} textAnchor="middle" className="text-sm fill-blue-700 dark:fill-blue-300 font-sans font-medium">MCP Connect</text>
                    <text x={207} y={158} textAnchor="middle" className="text-[13px] fill-gray-500 dark:fill-gray-400 italic font-sans">TabClientTransport (postMessage)</text>
                </g>

                {/* 2. Connection accepted */}
                <g>
                    <line x1={110} y1={200} x2={295} y2={200} className="stroke-gray-500 dark:stroke-gray-400" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrow-open-discovery)" />
                    <text x={202} y={190} textAnchor="middle" className="text-sm fill-gray-600 dark:fill-gray-400 font-sans">Connection accepted</text>
                </g>

                {/* 3. listTools() request */}
                <g>
                    <line x1={300} y1={260} x2={115} y2={260} className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-blue-discovery)" />
                    <text x={207} y={250} textAnchor="middle" className="text-sm fill-blue-700 dark:fill-blue-300 font-sans font-medium">client.listTools()</text>
                    <text x={207} y={278} textAnchor="middle" className="text-[13px] fill-gray-500 dark:fill-gray-400 italic font-sans">Discover available tools</text>
                </g>

                {/* 4. Tool definitions response */}
                <g>
                    <line x1={110} y1={320} x2={295} y2={320} className="stroke-gray-500 dark:stroke-gray-400" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrow-open-discovery)" />
                    <text x={202} y={310} textAnchor="middle" className="text-sm fill-gray-600 dark:fill-gray-400 font-sans">Tool definitions</text>
                </g>

                {/* Tool definitions note */}
                <rect x={55} y={340} width={180} height={65} rx={4} className="fill-gray-50 stroke-gray-200 dark:fill-gray-800/50 dark:stroke-gray-700" strokeWidth={1} />
                <text x={145} y={360} textAnchor="middle" className="text-xs fill-gray-700 dark:fill-gray-300 font-mono">{`{ tools: [`}</text>
                <text x={145} y={378} textAnchor="middle" className="text-xs fill-gray-700 dark:fill-gray-300 font-mono">{`  { name, description,`}</text>
                <text x={145} y={396} textAnchor="middle" className="text-xs fill-gray-700 dark:fill-gray-300 font-mono">{`    inputSchema } ] }`}</text>

                {/* 5. Register tools with background */}
                <g>
                    <line x1={300} y1={440} x2={510} y2={440} className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-blue-discovery)" />
                    <text x={405} y={430} textAnchor="middle" className="text-sm fill-blue-700 dark:fill-blue-300 font-sans font-medium">webmcp/tools/register</text>
                </g>

                {/* Registration payload note */}
                <rect x={520} y={420} width={200} height={70} rx={4} className="fill-amber-50 stroke-amber-200 dark:fill-amber-900/30 dark:stroke-amber-700" strokeWidth={1} />
                <text x={620} y={442} textAnchor="middle" className="text-[13px] fill-amber-700 dark:fill-amber-300 font-sans font-medium">Enriched with metadata:</text>
                <text x={620} y={460} textAnchor="middle" className="text-xs fill-amber-700 dark:fill-amber-300 font-mono">domain, tabId, url, favicon</text>
                <text x={620} y={478} textAnchor="middle" className="text-xs fill-amber-700 dark:fill-amber-300 font-mono">name → webmcp_{'{domain}'}_{'{name}'}</text>

                {/* OPT Block - Tool list change notifications */}
                <g>
                    <rect x={40} y={530} width={70} height={24} rx={0} className="fill-blue-100 dark:fill-blue-900/40 opacity-80" />
                    <text x={50} y={547} className="text-sm font-bold fill-blue-800 dark:fill-blue-200">OPT</text>
                    <text x={120} y={547} className="text-[13px] fill-blue-700 dark:fill-blue-300 italic font-sans">[if server supports listChanged]</text>
                    <rect x={40} y={530} width={920} height={100} rx={4} className="fill-none stroke-blue-200 dark:stroke-blue-800" strokeWidth={1} />
                </g>

                {/* Tool list changed notification */}
                <g>
                    <line x1={110} y1={585} x2={295} y2={585} className="stroke-amber-600 dark:stroke-amber-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-amber-discovery)" />
                    <text x={202} y={575} textAnchor="middle" className="text-sm fill-amber-700 dark:fill-amber-300 font-sans font-medium">ToolListChanged notification</text>
                    <text x={202} y={603} textAnchor="middle" className="text-[13px] fill-gray-500 dark:fill-gray-400 italic font-sans">Re-fetch and re-register tools</text>
                </g>

                {/* 6. Broadcast update to UI */}
                <g>
                    <line x1={515} y1={660} x2={715} y2={660} className="stroke-gray-600 dark:stroke-gray-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-discovery)" />
                    <text x={615} y={650} textAnchor="middle" className="text-sm fill-gray-700 dark:fill-gray-300 font-sans">webmcp/tools/updated</text>
                    <text x={615} y={678} textAnchor="middle" className="text-[13px] fill-gray-500 dark:fill-gray-400 italic font-sans">Broadcast to all contexts</text>
                </g>

                {/* 7. Tools available for AI */}
                <g>
                    <line x1={720} y1={720} x2={895} y2={720} className="stroke-green-600 dark:stroke-green-400" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrow-open-green-discovery)" />
                    <text x={807} y={710} textAnchor="middle" className="text-sm fill-green-700 dark:fill-green-300 font-sans font-medium">Tools ready for AI</text>
                </g>

                {/* Arrow Definitions - unique IDs for this component */}
                <defs>
                    <marker id="arrow-filled-discovery" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-gray-600 dark:fill-gray-400" />
                    </marker>
                    <marker id="arrow-filled-blue-discovery" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-blue-600 dark:fill-blue-400" />
                    </marker>
                    <marker id="arrow-filled-amber-discovery" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-amber-600 dark:fill-amber-400" />
                    </marker>
                    <marker id="arrow-open-discovery" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-none stroke-gray-500 dark:stroke-gray-400" strokeWidth="1.5" />
                    </marker>
                    <marker id="arrow-open-green-discovery" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-none stroke-green-600 dark:stroke-green-400" strokeWidth="1.5" />
                    </marker>
                </defs>
            </svg>
        </div>
    );
}
