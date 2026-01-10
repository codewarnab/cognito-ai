export function OAuthFlowSequence() {
    return (
        <div className="not-prose my-6 font-mono text-sm">
            <svg viewBox="0 0 700 520" className="w-full max-w-4xl">
                {/* Participants */}
                <g className="fill-current text-gray-800 dark:text-gray-200">
                    <rect x="50" y="15" width="80" height="35" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="90" y="38" textAnchor="middle" className="text-[11px] font-medium">Extension</text>

                    <rect x="195" y="15" width="80" height="35" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="235" y="38" textAnchor="middle" className="text-[11px] font-medium">Discovery</text>

                    <rect x="370" y="15" width="85" height="35" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="412" y="38" textAnchor="middle" className="text-[11px] font-medium">Auth Server</text>

                    <rect x="565" y="15" width="85" height="35" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="607" y="38" textAnchor="middle" className="text-[11px] font-medium">MCP Server</text>
                </g>

                {/* Lifelines */}
                <g className="stroke-gray-400 dark:stroke-gray-500" strokeWidth="1" strokeDasharray="4 3">
                    <line x1="90" y1="50" x2="90" y2="510" />
                    <line x1="235" y1="50" x2="235" y2="510" />
                    <line x1="412" y1="50" x2="412" y2="510" />
                    <line x1="607" y1="50" x2="607" y2="510" />
                </g>

                {/* Messages */}
                <g className="fill-current text-gray-700 dark:text-gray-300">
                    {/* Discovery Phase Label */}
                    <text x="35" y="82" className="text-[10px] fill-gray-500 dark:fill-gray-400 italic">Discovery</text>

                    {/* 1. Discover OAuth endpoints */}
                    <line x1="90" y1="100" x2="230" y2="100" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-oauth)" />
                    <text x="160" y="92" textAnchor="middle" className="text-[11px]">discoverOAuthEndpoints()</text>

                    {/* 2. GET protected resource metadata */}
                    <line x1="235" y1="135" x2="602" y2="135" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-oauth)" />
                    <text x="418" y="127" textAnchor="middle" className="text-[11px]">GET /.well-known/oauth-protected-resource</text>

                    {/* 3. GET auth server metadata */}
                    <line x1="235" y1="170" x2="407" y2="170" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-oauth)" />
                    <text x="321" y="162" textAnchor="middle" className="text-[11px]">GET /.well-known/oauth-authorization-server</text>

                    {/* 4. Return endpoints */}
                    <line x1="235" y1="205" x2="95" y2="205" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-oauth)" />
                    <text x="165" y="197" textAnchor="middle" className="text-[11px]">OAuthEndpoints</text>

                    {/* Registration Phase */}
                    <line x1="35" y1="235" x2="660" y2="235" className="stroke-gray-300 dark:stroke-gray-600" strokeWidth="1" strokeDasharray="8 4" />
                    <text x="35" y="255" className="text-[10px] fill-gray-500 dark:fill-gray-400 italic">Registration</text>

                    {/* 5. Dynamic client registration */}
                    <line x1="90" y1="275" x2="407" y2="275" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-oauth)" />
                    <text x="248" y="267" textAnchor="middle" className="text-[11px]">POST registration_endpoint</text>

                    {/* Note: Dynamic Client Registration */}
                    <rect x="340" y="290" width="145" height="22" rx="2" className="fill-amber-50 stroke-amber-400 dark:fill-amber-900/30 dark:stroke-amber-500" strokeWidth="1" />
                    <text x="412" y="305" textAnchor="middle" className="text-[10px] fill-amber-700 dark:fill-amber-400">Dynamic Client Registration</text>

                    {/* 6. Return client credentials */}
                    <line x1="412" y1="325" x2="95" y2="325" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-oauth)" />
                    <text x="253" y="317" textAnchor="middle" className="text-[11px]">client_id, client_secret</text>

                    {/* Authorization Phase */}
                    <line x1="35" y1="355" x2="660" y2="355" className="stroke-gray-300 dark:stroke-gray-600" strokeWidth="1" strokeDasharray="8 4" />
                    <text x="35" y="375" className="text-[10px] fill-gray-500 dark:fill-gray-400 italic">Authorization</text>

                    {/* 7. Open authorization URL */}
                    <line x1="90" y1="395" x2="407" y2="395" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-oauth)" />
                    <text x="248" y="387" textAnchor="middle" className="text-[11px]">Open authorization URL</text>

                    {/* Note: User consent */}
                    <rect x="340" y="408" width="145" height="22" rx="2" className="fill-amber-50 stroke-amber-400 dark:fill-amber-900/30 dark:stroke-amber-500" strokeWidth="1" />
                    <text x="412" y="423" textAnchor="middle" className="text-[10px] fill-amber-700 dark:fill-amber-400">User consent screen</text>

                    {/* 8. Return auth code */}
                    <line x1="412" y1="445" x2="95" y2="445" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-oauth)" />
                    <text x="253" y="437" textAnchor="middle" className="text-[11px]">authorization_code</text>

                    {/* 9. Exchange for tokens */}
                    <line x1="90" y1="475" x2="407" y2="475" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-oauth)" />
                    <text x="248" y="467" textAnchor="middle" className="text-[11px]">POST token_endpoint</text>

                    {/* 10. Return tokens */}
                    <line x1="412" y1="500" x2="95" y2="500" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-oauth)" />
                    <text x="253" y="492" textAnchor="middle" className="text-[11px]">access_token, refresh_token</text>
                </g>

                {/* Arrow marker */}
                <defs>
                    <marker id="arrow-oauth" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                        <path d="M 0 0 L 8 4 L 0 8 z" className="fill-gray-800 dark:fill-gray-300" />
                    </marker>
                </defs>
            </svg>
        </div>
    );
}
