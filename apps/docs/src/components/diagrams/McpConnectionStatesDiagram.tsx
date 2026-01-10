export function McpConnectionStatesDiagram() {
    return (
        <div className="not-prose my-6">
            <svg viewBox="0 0 780 520" className="w-full max-w-3xl mx-auto" style={{ background: 'transparent' }}>
                {/* Defs for arrows */}
                <defs>
                    <marker id="arrow-mcp" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                        <path d="M 0 0 L 8 4 L 0 8 z" className="fill-gray-600 dark:fill-gray-400" />
                    </marker>
                </defs>

                {/* Legend - top right */}
                <g>
                    <rect x="620" y="10" width="150" height="55" rx="6" className="fill-gray-100/80 stroke-gray-300 dark:fill-gray-800/80 dark:stroke-gray-600" strokeWidth="1" />
                    <text x="635" y="28" className="text-[10px] font-bold fill-gray-700 dark:fill-gray-300">Legend</text>
                    <circle cx="642" cy="42" r="5" className="fill-gray-700 dark:fill-gray-300" />
                    <text x="652" y="45" className="text-[9px] fill-gray-600 dark:fill-gray-400">Initial</text>
                    <rect x="700" y="37" width="12" height="10" rx="2" className="fill-emerald-200 stroke-emerald-600 dark:fill-emerald-800 dark:stroke-emerald-400" strokeWidth="1" />
                    <text x="716" y="45" className="text-[9px] fill-gray-600 dark:fill-gray-400">Success</text>
                </g>

                {/* Row 1: disconnected -> error -> connected -> token_refresh */}

                {/* Initial state dot */}
                <circle cx="30" cy="100" r="8" className="fill-gray-700 dark:fill-gray-300" />
                <line x1="38" y1="100" x2="58" y2="100" className="stroke-gray-600 dark:stroke-gray-400" strokeWidth="1.5" markerEnd="url(#arrow-mcp)" />

                {/* disconnected */}
                <g>
                    <rect x="62" y="80" width="95" height="40" rx="6" className="fill-gray-100 stroke-gray-600 dark:fill-gray-800 dark:stroke-gray-400" strokeWidth="1.5" />
                    <text x="110" y="105" textAnchor="middle" className="text-[11px] font-semibold fill-gray-700 dark:fill-gray-300">disconnected</text>
                </g>

                {/* error */}
                <g>
                    <rect x="250" y="80" width="75" height="40" rx="6" className="fill-red-100 stroke-red-500 dark:fill-red-900/60 dark:stroke-red-400" strokeWidth="1.5" />
                    <text x="288" y="105" textAnchor="middle" className="text-[11px] font-semibold fill-red-700 dark:fill-red-300">error</text>
                </g>

                {/* connected */}
                <g>
                    <rect x="420" y="80" width="90" height="40" rx="6" className="fill-emerald-100 stroke-emerald-600 dark:fill-emerald-900/60 dark:stroke-emerald-400" strokeWidth="2" />
                    <text x="465" y="105" textAnchor="middle" className="text-[11px] font-bold fill-emerald-700 dark:fill-emerald-300">connected</text>
                </g>

                {/* token_refresh */}
                <g>
                    <rect x="580" y="80" width="100" height="40" rx="6" className="fill-purple-100 stroke-purple-500 dark:fill-purple-900/60 dark:stroke-purple-400" strokeWidth="1.5" />
                    <text x="630" y="105" textAnchor="middle" className="text-[11px] font-semibold fill-purple-700 dark:fill-purple-300">token_refresh</text>
                </g>

                {/* Row 2: needs_auth -> cloudflare_error -> connecting -> invalid_token */}

                {/* needs_auth */}
                <g>
                    <rect x="62" y="220" width="95" height="40" rx="6" className="fill-amber-100 stroke-amber-500 dark:fill-amber-900/60 dark:stroke-amber-400" strokeWidth="1.5" />
                    <text x="110" y="245" textAnchor="middle" className="text-[11px] font-semibold fill-amber-700 dark:fill-amber-300">needs_auth</text>
                </g>

                {/* cloudflare_error */}
                <g>
                    <rect x="250" y="220" width="110" height="40" rx="6" className="fill-red-100 stroke-red-500 dark:fill-red-900/60 dark:stroke-red-400" strokeWidth="1.5" />
                    <text x="305" y="245" textAnchor="middle" className="text-[10px] font-semibold fill-red-700 dark:fill-red-300">cloudflare_error</text>
                </g>

                {/* connecting */}
                <g>
                    <rect x="420" y="220" width="90" height="40" rx="6" className="fill-blue-100 stroke-blue-500 dark:fill-blue-900/60 dark:stroke-blue-400" strokeWidth="1.5" />
                    <text x="465" y="245" textAnchor="middle" className="text-[11px] font-semibold fill-blue-700 dark:fill-blue-300">connecting</text>
                </g>

                {/* invalid_token */}
                <g>
                    <rect x="580" y="220" width="100" height="40" rx="6" className="fill-orange-100 stroke-orange-500 dark:fill-orange-900/60 dark:stroke-orange-400" strokeWidth="1.5" />
                    <text x="630" y="245" textAnchor="middle" className="text-[10px] font-semibold fill-orange-700 dark:fill-orange-300">invalid_token</text>
                </g>

                {/* Row 3: registering -> authorizing -> authenticated */}

                {/* registering */}
                <g>
                    <rect x="120" y="340" width="90" height="40" rx="6" className="fill-blue-100 stroke-blue-500 dark:fill-blue-900/60 dark:stroke-blue-400" strokeWidth="1.5" />
                    <text x="165" y="365" textAnchor="middle" className="text-[11px] font-semibold fill-blue-700 dark:fill-blue-300">registering</text>
                </g>

                {/* authorizing */}
                <g>
                    <rect x="280" y="340" width="90" height="40" rx="6" className="fill-blue-100 stroke-blue-500 dark:fill-blue-900/60 dark:stroke-blue-400" strokeWidth="1.5" />
                    <text x="325" y="365" textAnchor="middle" className="text-[11px] font-semibold fill-blue-700 dark:fill-blue-300">authorizing</text>
                </g>

                {/* authenticated */}
                <g>
                    <rect x="440" y="340" width="100" height="40" rx="6" className="fill-blue-100 stroke-blue-500 dark:fill-blue-900/60 dark:stroke-blue-400" strokeWidth="1.5" />
                    <text x="490" y="365" textAnchor="middle" className="text-[10px] font-semibold fill-blue-700 dark:fill-blue-300">authenticated</text>
                </g>

                {/* === TRANSITIONS === */}
                <g className="stroke-gray-500 dark:stroke-gray-500" strokeWidth="1.2">

                    {/* disconnected -> needs_auth (down) */}
                    <path d="M 90 120 L 90 215" fill="none" markerEnd="url(#arrow-mcp)" />
                    <text x="15" y="175" className="text-[9px] fill-gray-600 dark:fill-gray-400">OAuth needed</text>

                    {/* disconnected -> connecting (right, then down via top path) */}
                    <path d="M 157 90 L 200 60 L 410 60 L 410 215" fill="none" markerEnd="url(#arrow-mcp)" />
                    <text x="270" y="52" className="text-[9px] fill-gray-600 dark:fill-gray-400">No auth required</text>

                    {/* error -> disconnected */}
                    <path d="M 250 100 L 162 100" fill="none" markerEnd="url(#arrow-mcp)" />
                    <text x="190" y="115" className="text-[9px] fill-gray-600 dark:fill-gray-400">Reset</text>

                    {/* cloudflare_error -> disconnected */}
                    <path d="M 250 230 L 180 180 L 157 130" fill="none" markerEnd="url(#arrow-mcp)" />
                    <text x="195" y="175" className="text-[9px] fill-gray-600 dark:fill-gray-400">Reset</text>

                    {/* connecting -> connected */}
                    <path d="M 465 220 L 465 125" fill="none" markerEnd="url(#arrow-mcp)" />
                    <text x="472" y="178" className="text-[9px] fill-gray-600 dark:fill-gray-400">OK</text>

                    {/* connecting -> error */}
                    <path d="M 420 230 L 330 115" fill="none" markerEnd="url(#arrow-mcp)" />
                    <text x="385" y="165" className="text-[9px] fill-gray-600 dark:fill-gray-400">Fail</text>

                    {/* connecting -> cloudflare_error */}
                    <path d="M 420 240 L 365 240" fill="none" markerEnd="url(#arrow-mcp)" />
                    <text x="375" y="233" className="text-[9px] fill-gray-600 dark:fill-gray-400">CF err</text>

                    {/* connected -> token_refresh */}
                    <path d="M 510 100 L 575 100" fill="none" markerEnd="url(#arrow-mcp)" />
                    <text x="528" y="93" className="text-[9px] fill-gray-600 dark:fill-gray-400">Expiring</text>

                    {/* token_refresh -> connected (curved back) */}
                    <path d="M 600 80 C 580 50, 500 50, 490 80" fill="none" markerEnd="url(#arrow-mcp)" />
                    <text x="528" y="45" className="text-[9px] fill-gray-600 dark:fill-gray-400">Refreshed</text>

                    {/* token_refresh -> invalid_token */}
                    <path d="M 630 120 L 630 215" fill="none" markerEnd="url(#arrow-mcp)" />
                    <text x="638" y="175" className="text-[9px] fill-gray-600 dark:fill-gray-400">Bad</text>

                    {/* token_refresh -> needs_auth */}
                    <path d="M 580 115 C 500 135, 200 150, 157 220" fill="none" markerEnd="url(#arrow-mcp)" />
                    <text x="360" y="130" className="text-[9px] fill-gray-600 dark:fill-gray-400">Refresh failed</text>

                    {/* invalid_token -> needs_auth */}
                    <path d="M 580 250 C 480 290, 250 295, 157 255" fill="none" markerEnd="url(#arrow-mcp)" />
                    <text x="350" y="310" className="text-[9px] fill-gray-600 dark:fill-gray-400">Re-auth</text>

                    {/* connected -> disconnected */}
                    <path d="M 420 115 C 350 150, 240 165, 157 115" fill="none" markerEnd="url(#arrow-mcp)" />
                    <text x="275" y="180" className="text-[9px] fill-gray-600 dark:fill-gray-400">Disconnect</text>

                    {/* needs_auth -> registering */}
                    <path d="M 110 260 L 110 300 L 145 335" fill="none" markerEnd="url(#arrow-mcp)" />
                    <text x="50" y="310" className="text-[9px] fill-gray-600 dark:fill-gray-400">Start</text>

                    {/* registering -> authorizing */}
                    <path d="M 210 360 L 275 360" fill="none" markerEnd="url(#arrow-mcp)" />
                    <text x="228" y="353" className="text-[9px] fill-gray-600 dark:fill-gray-400">Reg'd</text>

                    {/* authorizing -> authenticated */}
                    <path d="M 370 360 L 435 360" fill="none" markerEnd="url(#arrow-mcp)" />
                    <text x="390" y="353" className="text-[9px] fill-gray-600 dark:fill-gray-400">OK</text>

                    {/* authenticated -> connecting */}
                    <path d="M 490 340 L 480 265" fill="none" markerEnd="url(#arrow-mcp)" />
                    <text x="500" y="310" className="text-[9px] fill-gray-600 dark:fill-gray-400">Auto</text>
                </g>

                {/* Legend bar at bottom */}
                <g className="text-[10px]">
                    <text x="30" y="440" className="fill-blue-600 dark:fill-blue-400 font-medium">● OAuth Flow</text>
                    <text x="130" y="440" className="fill-red-600 dark:fill-red-400 font-medium">● Errors</text>
                    <text x="210" y="440" className="fill-emerald-600 dark:fill-emerald-400 font-medium">● Connected</text>
                    <text x="310" y="440" className="fill-amber-600 dark:fill-amber-400 font-medium">● Auth Needed</text>
                    <text x="420" y="440" className="fill-purple-600 dark:fill-purple-400 font-medium">● Token Mgmt</text>
                    <text x="530" y="440" className="fill-orange-600 dark:fill-orange-400 font-medium">● Invalid Token</text>
                </g>
            </svg>
        </div>
    );
}
