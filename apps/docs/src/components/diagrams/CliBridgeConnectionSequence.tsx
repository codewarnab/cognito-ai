export function CliBridgeConnectionSequence() {
    return (
        <div className="not-prose my-6 font-mono text-sm">
            <svg viewBox="0 0 700 420" className="w-full max-w-3xl">
                {/* Participants */}
                <g className="fill-current text-gray-800 dark:text-gray-200">
                    <rect x="40" y="10" width="90" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="85" y="30" textAnchor="middle" className="text-[11px] font-medium">Extension UI</text>

                    <rect x="180" y="10" width="110" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="235" y="30" textAnchor="middle" className="text-[11px] font-medium">cliModeStore</text>

                    <rect x="350" y="10" width="100" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="400" y="30" textAnchor="middle" className="text-[11px] font-medium">CLI Bridge</text>

                    <rect x="510" y="10" width="110" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="565" y="30" textAnchor="middle" className="text-[11px] font-medium">Token Storage</text>
                </g>

                {/* Lifelines */}
                <g className="stroke-gray-400 dark:stroke-gray-500" strokeWidth="1" strokeDasharray="4 3">
                    <line x1="85" y1="40" x2="85" y2="410" />
                    <line x1="235" y1="40" x2="235" y2="410" />
                    <line x1="400" y1="40" x2="400" y2="410" />
                    <line x1="565" y1="40" x2="565" y2="410" />
                </g>

                {/* Messages */}
                <g className="fill-current text-gray-700 dark:text-gray-300">
                    {/* 1. Check bridge health */}
                    <line x1="85" y1="65" x2="230" y2="65" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-cli-conn)" />
                    <text x="157" y="58" textAnchor="middle" className="text-[10px]">checkBridgeHealth()</text>

                    {/* 2. GET /health */}
                    <line x1="235" y1="95" x2="395" y2="95" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-cli-conn)" />
                    <text x="315" y="88" textAnchor="middle" className="text-[10px]">GET /health</text>

                    {/* 3. Return cwd, version */}
                    <line x1="400" y1="125" x2="240" y2="125" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-cli-conn)" />
                    <text x="320" y="118" textAnchor="middle" className="text-[10px]">{`{ok, version, cwd}`}</text>

                    {/* Alt box for token validation */}
                    <rect x="30" y="145" width="600" height="110" rx="3" className="fill-none stroke-gray-500 dark:stroke-gray-400" strokeWidth="1" />
                    <text x="40" y="160" className="text-[10px] font-semibold fill-gray-600 dark:fill-gray-400">opt</text>
                    <text x="70" y="160" className="text-[9px] fill-gray-500 dark:fill-gray-400">[existing token]</text>

                    {/* 4. POST /validate */}
                    <line x1="235" y1="180" x2="395" y2="180" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-cli-conn)" />
                    <text x="315" y="173" textAnchor="middle" className="text-[10px]">POST /validate + Bearer token</text>

                    {/* 5. Validate hash */}
                    <line x1="400" y1="205" x2="560" y2="205" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-cli-conn)" />
                    <text x="480" y="198" textAnchor="middle" className="text-[10px]">validateToken()</text>

                    {/* 6. Return valid */}
                    <line x1="565" y1="230" x2="405" y2="230" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-cli-conn)" />
                    <text x="485" y="245" textAnchor="middle" className="text-[10px]">valid: true/false</text>

                    {/* Alt box for new token */}
                    <rect x="30" y="265" width="600" height="80" rx="3" className="fill-none stroke-gray-500 dark:stroke-gray-400" strokeWidth="1" />
                    <text x="40" y="280" className="text-[10px] font-semibold fill-gray-600 dark:fill-gray-400">alt</text>
                    <text x="65" y="280" className="text-[9px] fill-gray-500 dark:fill-gray-400">[no valid token]</text>

                    {/* 7. POST /connect */}
                    <line x1="235" y1="295" x2="395" y2="295" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-cli-conn)" />
                    <text x="315" y="288" textAnchor="middle" className="text-[10px]">POST /connect (Origin validated)</text>

                    {/* 8. Generate & store token */}
                    <line x1="400" y1="318" x2="560" y2="318" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-cli-conn)" />
                    <text x="480" y="311" textAnchor="middle" className="text-[10px]">addToken(hash)</text>

                    {/* 9. Return token */}
                    <line x1="400" y1="335" x2="240" y2="335" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-cli-conn)" />
                    <text x="320" y="328" textAnchor="middle" className="text-[10px]">{`{token, extensionId}`}</text>

                    {/* 10. Set bridgeStatus = connected */}
                    <line x1="235" y1="365" x2="90" y2="365" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-cli-conn)" />
                    <text x="162" y="358" textAnchor="middle" className="text-[10px]">bridgeStatus: connected</text>

                    {/* 11. Fetch agents */}
                    <line x1="235" y1="390" x2="395" y2="390" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-cli-conn)" />
                    <text x="315" y="383" textAnchor="middle" className="text-[10px]">GET /agents</text>
                </g>

                {/* Arrow marker */}
                <defs>
                    <marker id="arrow-cli-conn" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                        <path d="M 0 0 L 8 4 L 0 8 z" className="fill-gray-800 dark:fill-gray-300" />
                    </marker>
                </defs>
            </svg>
        </div>
    );
}
