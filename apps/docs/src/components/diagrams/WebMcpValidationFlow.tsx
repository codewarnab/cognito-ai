/**
 * WebMCP Security Validation Flow Diagram
 * 
 * Shows the multi-layer security validation that WebMCP tools go through
 * before execution. Each check can reject the tool call.
 * 
 * Flow verified against:
 * - apps/extension/src/background/webmcp/manager.ts (validateToolOrigin, validateToolTabId, validateArgsAgainstSchema)
 * - apps/extension/src/entrypoints/webmcp-proxy.content.ts (rate limiting, arg validation)
 */
export function WebMcpValidationFlow() {
    return (
        <div className="not-prose my-6 font-mono text-sm">
            <svg viewBox="0 0 920 180" className="w-full max-w-5xl">
                {/* Main flow boxes */}
                <g>
                    {/* Tool Call - Start */}
                    <rect x={50} y={20} width={100} height={50} rx={6} className="fill-blue-100 stroke-blue-600 dark:fill-blue-900/40 dark:stroke-blue-400" strokeWidth={1.5} />
                    <text x={100} y={42} textAnchor="middle" className="text-[11px] font-bold fill-blue-800 dark:fill-blue-200">Tool Call</text>
                    <text x={100} y={57} textAnchor="middle" className="text-[10px] fill-blue-600 dark:fill-blue-300 font-sans">webmcp/tool/call</text>

                    {/* Arrow 1 */}
                    <line x1={150} y1={45} x2={195} y2={45} className="stroke-gray-600 dark:stroke-gray-400" strokeWidth={1.5} markerEnd="url(#arrow-validation-flow)" />

                    {/* Origin Check */}
                    <rect x={200} y={20} width={120} height={50} rx={6} className="fill-white stroke-gray-300 dark:fill-gray-800 dark:stroke-gray-600" strokeWidth={1.5} />
                    <text x={260} y={42} textAnchor="middle" className="text-[11px] font-bold fill-gray-800 dark:fill-gray-200">Origin Check</text>
                    <text x={260} y={57} textAnchor="middle" className="text-[10px] fill-gray-500 dark:fill-gray-400 font-sans">validateToolOrigin()</text>

                    {/* Arrow 2 */}
                    <line x1={320} y1={45} x2={365} y2={45} className="stroke-gray-600 dark:stroke-gray-400" strokeWidth={1.5} markerEnd="url(#arrow-validation-flow)" />

                    {/* Tab ID Check */}
                    <rect x={370} y={20} width={120} height={50} rx={6} className="fill-white stroke-gray-300 dark:fill-gray-800 dark:stroke-gray-600" strokeWidth={1.5} />
                    <text x={430} y={42} textAnchor="middle" className="text-[11px] font-bold fill-gray-800 dark:fill-gray-200">Tab ID Check</text>
                    <text x={430} y={57} textAnchor="middle" className="text-[10px] fill-gray-500 dark:fill-gray-400 font-sans">validateToolTabId()</text>

                    {/* Arrow 3 */}
                    <line x1={490} y1={45} x2={535} y2={45} className="stroke-gray-600 dark:stroke-gray-400" strokeWidth={1.5} markerEnd="url(#arrow-validation-flow)" />

                    {/* Schema Check */}
                    <rect x={540} y={20} width={130} height={50} rx={6} className="fill-white stroke-gray-300 dark:fill-gray-800 dark:stroke-gray-600" strokeWidth={1.5} />
                    <text x={605} y={42} textAnchor="middle" className="text-[11px] font-bold fill-gray-800 dark:fill-gray-200">Schema Check</text>
                    <text x={605} y={57} textAnchor="middle" className="text-[10px] fill-gray-500 dark:fill-gray-400 font-sans">validateArgsAgainstSchema()</text>

                    {/* Arrow 4 */}
                    <line x1={670} y1={45} x2={715} y2={45} className="stroke-gray-600 dark:stroke-gray-400" strokeWidth={1.5} markerEnd="url(#arrow-validation-flow)" />

                    {/* Rate Limit Check */}
                    <rect x={720} y={20} width={100} height={50} rx={6} className="fill-white stroke-gray-300 dark:fill-gray-800 dark:stroke-gray-600" strokeWidth={1.5} />
                    <text x={770} y={42} textAnchor="middle" className="text-[11px] font-bold fill-gray-800 dark:fill-gray-200">Rate Limit</text>
                    <text x={770} y={57} textAnchor="middle" className="text-[10px] fill-gray-500 dark:fill-gray-400 font-sans">isRateLimited()</text>

                    {/* Arrow 5 - Success */}
                    <line x1={820} y1={45} x2={855} y2={45} className="stroke-green-600 dark:stroke-green-400" strokeWidth={1.5} markerEnd="url(#arrow-validation-flow-green)" />

                    {/* Execute - Success */}
                    <rect x={860} y={20} width={50} height={50} rx={6} className="fill-green-100 stroke-green-600 dark:fill-green-900/40 dark:stroke-green-400" strokeWidth={1.5} />
                    <text x={885} y={50} textAnchor="middle" className="text-[11px] font-bold fill-green-800 dark:fill-green-200">✓</text>
                </g>

                {/* Rejection arrows and labels */}
                <g>
                    {/* Origin Check → Reject */}
                    <line x1={260} y1={70} x2={260} y2={115} className="stroke-red-500 dark:stroke-red-400" strokeWidth={1.5} />
                    <polygon points="260,123 255,115 265,115" className="fill-red-500 dark:fill-red-400" />
                    <rect x={195} y={128} width={130} height={45} rx={4} className="fill-red-50 stroke-red-200 dark:fill-red-900/20 dark:stroke-red-800" strokeWidth={1} />
                    <text x={260} y={145} textAnchor="middle" className="text-[10px] font-bold fill-red-600 dark:fill-red-400">Reject</text>
                    <text x={260} y={160} textAnchor="middle" className="text-[10px] fill-red-500 dark:fill-red-400 font-mono">"Tool origin mismatch"</text>

                    {/* Tab ID Check → Reject */}
                    <line x1={430} y1={70} x2={430} y2={115} className="stroke-red-500 dark:stroke-red-400" strokeWidth={1.5} />
                    <polygon points="430,123 425,115 435,115" className="fill-red-500 dark:fill-red-400" />
                    <rect x={365} y={128} width={130} height={45} rx={4} className="fill-red-50 stroke-red-200 dark:fill-red-900/20 dark:stroke-red-800" strokeWidth={1} />
                    <text x={430} y={145} textAnchor="middle" className="text-[10px] font-bold fill-red-600 dark:fill-red-400">Reject</text>
                    <text x={430} y={160} textAnchor="middle" className="text-[10px] fill-red-500 dark:fill-red-400 font-mono">"Tool tab mismatch"</text>

                    {/* Schema Check → Reject */}
                    <line x1={605} y1={70} x2={605} y2={115} className="stroke-red-500 dark:stroke-red-400" strokeWidth={1.5} />
                    <polygon points="605,123 600,115 610,115" className="fill-red-500 dark:fill-red-400" />
                    <rect x={535} y={128} width={140} height={45} rx={4} className="fill-red-50 stroke-red-200 dark:fill-red-900/20 dark:stroke-red-800" strokeWidth={1} />
                    <text x={605} y={145} textAnchor="middle" className="text-[10px] font-bold fill-red-600 dark:fill-red-400">Reject</text>
                    <text x={605} y={160} textAnchor="middle" className="text-[10px] fill-red-500 dark:fill-red-400 font-mono">"Schema validation failed"</text>

                    {/* Rate Limit → Reject */}
                    <line x1={770} y1={70} x2={770} y2={115} className="stroke-red-500 dark:stroke-red-400" strokeWidth={1.5} />
                    <polygon points="770,123 765,115 775,115" className="fill-red-500 dark:fill-red-400" />
                    <rect x={705} y={128} width={130} height={45} rx={4} className="fill-red-50 stroke-red-200 dark:fill-red-900/20 dark:stroke-red-800" strokeWidth={1} />
                    <text x={770} y={145} textAnchor="middle" className="text-[10px] font-bold fill-red-600 dark:fill-red-400">Reject</text>
                    <text x={770} y={160} textAnchor="middle" className="text-[10px] fill-red-500 dark:fill-red-400 font-mono">"Rate limited (100ms)"</text>
                </g>

                {/* Arrow markers */}
                <defs>
                    <marker id="arrow-validation-flow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-gray-600 dark:fill-gray-400" />
                    </marker>
                    <marker id="arrow-validation-flow-green" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-green-600 dark:fill-green-400" />
                    </marker>
                </defs>
            </svg>
        </div>
    );
}
