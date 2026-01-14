export function CliBridgeConnectionSequence() {
    return (
        <div className="not-prose my-6 font-mono text-sm">
            <svg viewBox="0 0 800 550" className="w-full max-w-4xl">
                {/* Backgrounds for Alt/Opt blocks to make them solid areas */}
                <rect x={20} y={160} width={760} height={130} rx={4} className="fill-blue-50/50 dark:fill-blue-900/10" />
                <rect x={20} y={310} width={760} height={150} rx={4} className="fill-amber-50/50 dark:fill-amber-900/10" />

                {/* Participants */}
                <g className="fill-white dark:fill-gray-800 stroke-gray-300 dark:stroke-gray-600">
                    <rect x={50} y={10} width={120} height={40} rx={6} className="shadow-sm" strokeWidth={1.5} />
                    <rect x={220} y={10} width={120} height={40} rx={6} className="shadow-sm" strokeWidth={1.5} />
                    <rect x={420} y={10} width={120} height={40} rx={6} className="shadow-sm" strokeWidth={1.5} />
                    <rect x={620} y={10} width={120} height={40} rx={6} className="shadow-sm" strokeWidth={1.5} />
                </g>

                {/* Participant Labels */}
                <g className="fill-gray-800 dark:fill-gray-200 text-xs font-bold font-sans">
                    <text x={110} y={35} textAnchor="middle">Extension UI</text>
                    <text x={280} y={35} textAnchor="middle">cliModeStore</text>
                    <text x={480} y={35} textAnchor="middle">CLI Bridge Server</text>
                    <text x={680} y={35} textAnchor="middle">Token Storage</text>
                </g>

                {/* Lifelines */}
                <g className="stroke-gray-300 dark:stroke-gray-600" strokeWidth={1.5} strokeDasharray="6 4">
                    <line x1={110} y1={50} x2={110} y2={520} />
                    <line x1={280} y1={50} x2={280} y2={520} />
                    <line x1={480} y1={50} x2={480} y2={520} />
                    <line x1={680} y1={50} x2={680} y2={520} />
                </g>

                {/* Connection check phase */}
                <g>
                    <text x={195} y={70} className="text-[10px] font-semibold uppercase fill-gray-400 dark:fill-gray-500 tracking-wider">Health Check</text>

                    <line x1={110} y1={85} x2={280} y2={85} className="stroke-gray-600 dark:stroke-gray-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-seq)" />
                    <text x={195} y={80} textAnchor="middle" className="text-[11px] fill-gray-700 dark:fill-gray-300 font-sans">1. checkBridgeHealth()</text>

                    <line x1={280} y1={115} x2={480} y2={115} className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-blue-seq)" />
                    <text x={380} y={110} textAnchor="middle" className="text-[11px] fill-blue-700 dark:fill-blue-300 font-sans font-medium">2. GET /health</text>

                    <line x1={480} y1={145} x2={280} y2={145} className="stroke-gray-500 dark:stroke-gray-400" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrow-open-seq)" />
                    <text x={380} y={140} textAnchor="middle" className="text-[11px] fill-gray-600 dark:fill-gray-400 font-mono">{`{ ok: true, version, cwd }`}</text>
                </g>

                {/* Opt Block - Existing Token */}
                <g>
                    <rect x={20} y={160} width={70} height={20} rx={0} className="fill-blue-100 dark:fill-blue-900/40 opacity-80" />
                    <path d="M 20 160 L 90 160 L 90 174 L 80 180 L 20 180 Z" className="fill-blue-100 dark:fill-blue-900/40 stroke-none" />
                    <text x={30} y={174} className="text-[10px] font-bold fill-blue-800 dark:fill-blue-200">OPT</text>
                    <text x={100} y={174} className="text-[10px] fill-blue-700 dark:fill-blue-300 italic">[Has Saved Token]</text>
                    <rect x={20} y={160} width={760} height={130} rx={4} className="fill-none stroke-blue-200 dark:stroke-blue-800" strokeWidth={1} />

                    <line x1={280} y1={205} x2={480} y2={205} className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-blue-seq)" />
                    <text x={380} y={200} textAnchor="middle" className="text-[11px] fill-blue-700 dark:fill-blue-300 font-sans">3. POST /validate</text>
                    <text x={380} y={215} textAnchor="middle" className="text-[9px] fill-gray-500 font-mono">Header: Authorization: Bearer &lt;token&gt;</text>

                    <line x1={480} y1={235} x2={680} y2={235} className="stroke-gray-600 dark:stroke-gray-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-seq)" />
                    <text x={580} y={230} textAnchor="middle" className="text-[11px] fill-gray-700 dark:fill-gray-300 font-sans">4. validateToken(hash)</text>

                    <line x1={680} y1={265} x2={280} y2={265} className="stroke-green-600 dark:stroke-green-400" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrow-open-green-seq)" />
                    <text x={480} y={260} textAnchor="middle" className="text-[11px] fill-green-700 dark:fill-green-300 font-mono">{`{ valid: true }`}</text>
                </g>

                {/* Alt Block - New Connection */}
                <g>
                    <rect x={20} y={310} width={70} height={20} rx={0} className="fill-amber-100 dark:fill-amber-900/40 opacity-80" />
                    <text x={30} y={324} className="text-[10px] font-bold fill-amber-800 dark:fill-amber-200">ALT</text>
                    <text x={100} y={324} className="text-[10px] fill-amber-700 dark:fill-amber-300 italic">[No Valid Token / Reconnect]</text>
                    <rect x={20} y={310} width={760} height={150} rx={4} className="fill-none stroke-amber-200 dark:stroke-amber-800" strokeWidth={1} />

                    {/* FIXED: Explicitly use numeric values for coordinates to prevent diagonal artifact */}
                    <line x1={280} y1={350} x2={480} y2={350} className="stroke-amber-600 dark:stroke-amber-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-amber-seq)" />
                    <text x={380} y={345} textAnchor="middle" className="text-[11px] fill-amber-700 dark:fill-amber-300 font-sans">5. POST /connect</text>
                    <text x={380} y={360} textAnchor="middle" className="text-[9px] fill-gray-500 font-mono">Origin Checked (chrome-extension://...)</text>

                    <line x1={480} y1={380} x2={680} y2={380} className="stroke-gray-600 dark:stroke-gray-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-seq)" />
                    <text x={580} y={375} textAnchor="middle" className="text-[11px] fill-gray-700 dark:fill-gray-300 font-sans">6. addToken(hash)</text>

                    <line x1={480} y1={410} x2={280} y2={410} className="stroke-gray-500 dark:stroke-gray-400" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrow-open-seq)" />
                    <text x={380} y={405} textAnchor="middle" className="text-[11px] fill-gray-600 dark:fill-gray-400 font-mono">{`{ token: "...", extensionId }`}</text>
                </g>

                {/* Final Success State */}
                <g>
                    <line x1={280} y1={480} x2={110} y2={480} className="stroke-green-600 dark:stroke-green-400" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrow-open-green-seq)" />
                    <text x={195} y={475} textAnchor="middle" className="text-[11px] fill-green-700 dark:fill-green-300 font-bold">Bridge Connected</text>

                    <line x1={280} y1={500} x2={480} y2={500} className="stroke-gray-600 dark:stroke-gray-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-seq)" />
                    <text x={380} y={495} textAnchor="middle" className="text-[11px] fill-gray-700 dark:fill-gray-300 font-sans">7. GET /agents (Fetch Tools)</text>
                </g>

                {/* Definitions - Renamed IDs to prevent caching collisions */}
                <defs>
                    <marker id="arrow-filled-seq" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-gray-600 dark:fill-gray-400" />
                    </marker>
                    <marker id="arrow-filled-blue-seq" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-blue-600 dark:fill-blue-400" />
                    </marker>
                    <marker id="arrow-filled-amber-seq" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-amber-600 dark:fill-amber-400" />
                    </marker>
                    <marker id="arrow-open-seq" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-none stroke-gray-500 dark:stroke-gray-400" strokeWidth="1.5" />
                    </marker>
                    <marker id="arrow-open-green-seq" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-none stroke-green-600 dark:stroke-green-400" strokeWidth="1.5" />
                    </marker>
                </defs>
            </svg>
        </div>
    );
}
