export function McpOAuthSequence() {
    return (
        <div className="not-prose my-6 font-mono text-sm">
            <svg viewBox="0 0 580 400" className="w-full max-w-2xl">
                {/* Participants */}
                <g className="fill-current text-gray-800 dark:text-gray-200">
                    <rect x="40" y="10" width="70" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="75" y="30" textAnchor="middle" className="text-[10px] font-medium">User</text>

                    <rect x="160" y="10" width="80" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="200" y="30" textAnchor="middle" className="text-[10px] font-medium">Extension</text>

                    <rect x="320" y="10" width="80" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="360" y="30" textAnchor="middle" className="text-[10px] font-medium">Auth Server</text>

                    <rect x="470" y="10" width="80" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="510" y="30" textAnchor="middle" className="text-[10px] font-medium">MCP Server</text>
                </g>

                {/* Lifelines */}
                <g className="stroke-gray-400 dark:stroke-gray-500" strokeWidth="1" strokeDasharray="4 3">
                    <line x1="75" y1="40" x2="75" y2="390" />
                    <line x1="200" y1="40" x2="200" y2="390" />
                    <line x1="360" y1="40" x2="360" y2="390" />
                    <line x1="510" y1="40" x2="510" y2="390" />
                </g>

                {/* Messages */}
                <g className="fill-current text-gray-700 dark:text-gray-300">
                    {/* 1. Click Connect */}
                    <line x1="75" y1="65" x2="195" y2="65" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-mcp-oauth)" />
                    <text x="135" y="58" textAnchor="middle" className="text-[10px]">Click Connect</text>

                    {/* 2. Discover OAuth endpoints */}
                    <line x1="200" y1="95" x2="505" y2="95" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-mcp-oauth)" />
                    <text x="352" y="88" textAnchor="middle" className="text-[10px]">Discover OAuth endpoints</text>

                    {/* 3. Return endpoints */}
                    <line x1="510" y1="125" x2="205" y2="125" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-mcp-oauth)" />
                    <text x="357" y="118" textAnchor="middle" className="text-[10px]">Authorization URL, Token URL</text>

                    {/* 4. Register dynamic client */}
                    <path d="M 200 150 Q 240 150 240 165 Q 240 180 200 180" className="fill-none stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-mcp-oauth)" />
                    <text x="260" y="168" className="text-[9px]">Register client (RFC 7591)</text>

                    {/* 5. Open consent screen */}
                    <line x1="200" y1="205" x2="355" y2="205" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-mcp-oauth)" />
                    <text x="277" y="198" textAnchor="middle" className="text-[10px]">Open consent screen</text>

                    {/* 6. User approves */}
                    <line x1="75" y1="235" x2="355" y2="235" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-mcp-oauth)" />
                    <text x="215" y="228" textAnchor="middle" className="text-[10px]">Approve permissions</text>

                    {/* 7. Auth code */}
                    <line x1="360" y1="265" x2="205" y2="265" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-mcp-oauth)" />
                    <text x="282" y="258" textAnchor="middle" className="text-[10px]">Authorization code</text>

                    {/* 8. Exchange for tokens */}
                    <line x1="200" y1="295" x2="355" y2="295" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-mcp-oauth)" />
                    <text x="277" y="288" textAnchor="middle" className="text-[10px]">Exchange for tokens</text>

                    {/* 9. Return tokens */}
                    <line x1="360" y1="325" x2="205" y2="325" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-mcp-oauth)" />
                    <text x="282" y="318" textAnchor="middle" className="text-[10px]">Access + refresh tokens</text>

                    {/* 10. Connect with token */}
                    <line x1="200" y1="355" x2="505" y2="355" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-mcp-oauth)" />
                    <text x="352" y="348" textAnchor="middle" className="text-[10px]">Connect with token</text>

                    {/* 11. Connection ready */}
                    <line x1="510" y1="380" x2="205" y2="380" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-mcp-oauth)" />
                    <text x="357" y="373" textAnchor="middle" className="text-[10px]">Connection ready</text>
                </g>

                {/* Arrow marker */}
                <defs>
                    <marker id="arrow-mcp-oauth" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                        <path d="M 0 0 L 8 4 L 0 8 z" className="fill-gray-800 dark:fill-gray-300" />
                    </marker>
                </defs>
            </svg>
        </div>
    );
}
