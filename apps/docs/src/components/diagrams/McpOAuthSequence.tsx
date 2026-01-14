export function McpOAuthSequence() {
    return (
        <div className="not-prose my-6 font-mono text-sm">
            <svg viewBox="0 0 900 820" className="w-full max-w-5xl">
                {/* Participants */}
                <g className="fill-white dark:fill-gray-800 stroke-gray-300 dark:stroke-gray-600">
                    <rect x={50} y={10} width={80} height={40} rx={6} className="shadow-sm" strokeWidth={1.5} />
                    <rect x={200} y={10} width={100} height={40} rx={6} className="shadow-sm" strokeWidth={1.5} />
                    <rect x={400} y={10} width={100} height={40} rx={6} className="shadow-sm" strokeWidth={1.5} />
                    <rect x={620} y={10} width={100} height={40} rx={6} className="shadow-sm" strokeWidth={1.5} />
                    <rect x={790} y={10} width={90} height={40} rx={6} className="shadow-sm" strokeWidth={1.5} />
                </g>

                {/* Participant Labels */}
                <g className="fill-gray-800 dark:fill-gray-200 text-xs font-bold font-sans">
                    <text x={90} y={35} textAnchor="middle">User</text>
                    <text x={250} y={35} textAnchor="middle">Extension</text>
                    <text x={450} y={35} textAnchor="middle">Auth Server</text>
                    <text x={670} y={35} textAnchor="middle">MCP Server</text>
                    <text x={835} y={35} textAnchor="middle">Storage</text>
                </g>

                {/* Lifelines */}
                <g className="stroke-gray-300 dark:stroke-gray-600" strokeWidth={1.5} strokeDasharray="6 4">
                    <line x1={90} y1={50} x2={90} y2={800} />
                    <line x1={250} y1={50} x2={250} y2={800} />
                    <line x1={450} y1={50} x2={450} y2={800} />
                    <line x1={670} y1={50} x2={670} y2={800} />
                    <line x1={835} y1={50} x2={835} y2={800} />
                </g>

                {/* 1. User clicks Connect */}
                <g>
                    <line x1={90} y1={75} x2={245} y2={75} className="stroke-gray-600 dark:stroke-gray-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-oauth)" />
                    <text x={167} y={68} textAnchor="middle" className="text-[11px] fill-gray-700 dark:fill-gray-300 font-sans font-medium">Click "Connect"</text>
                </g>

                {/* 2. Discover OAuth endpoints (parallel) */}
                <g>
                    <line x1={250} y1={105} x2={665} y2={105} className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-blue-oauth)" />
                    <text x={457} y={98} textAnchor="middle" className="text-[11px] fill-blue-700 dark:fill-blue-300 font-sans font-medium">GET /.well-known/oauth-protected-resource</text>
                    <text x={457} y={118} textAnchor="middle" className="text-[10px] fill-gray-500 dark:fill-gray-400 italic font-sans">RFC 9728 Protected Resource Metadata discovery</text>
                </g>

                {/* 3. Return endpoints */}
                <g>
                    <line x1={670} y1={145} x2={255} y2={145} className="stroke-gray-500 dark:stroke-gray-400" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrow-open-oauth)" />
                    <text x={462} y={138} textAnchor="middle" className="text-[11px] fill-gray-600 dark:fill-gray-400 font-sans">OAuth endpoints discovered</text>

                    {/* Endpoints note */}
                    <rect x={280} y={155} width={200} height={50} rx={4} className="fill-blue-50 stroke-blue-200 dark:fill-blue-900/30 dark:stroke-blue-700" strokeWidth={1} />
                    <text x={380} y={172} textAnchor="middle" className="text-[10px] fill-blue-700 dark:fill-blue-300 font-mono">authorization_endpoint</text>
                    <text x={380} y={186} textAnchor="middle" className="text-[10px] fill-blue-700 dark:fill-blue-300 font-mono">token_endpoint</text>
                    <text x={380} y={200} textAnchor="middle" className="text-[10px] fill-blue-700 dark:fill-blue-300 font-mono">registration_endpoint</text>
                </g>

                {/* 4. Register dynamic client */}
                <g>
                    <line x1={250} y1={230} x2={445} y2={230} className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-blue-oauth)" />
                    <text x={347} y={223} textAnchor="middle" className="text-[11px] fill-blue-700 dark:fill-blue-300 font-sans font-medium">POST /register</text>
                    <text x={347} y={243} textAnchor="middle" className="text-[10px] fill-gray-500 dark:fill-gray-400 italic font-sans">RFC 7591 Dynamic Client Registration</text>
                </g>

                {/* 5. Return client credentials */}
                <g>
                    <line x1={450} y1={270} x2={255} y2={270} className="stroke-gray-500 dark:stroke-gray-400" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrow-open-oauth)" />
                    <text x={352} y={263} textAnchor="middle" className="text-[11px] fill-gray-600 dark:fill-gray-400 font-sans">client_id, client_secret</text>
                </g>

                {/* 6. Generate state (self-call) */}
                <g>
                    <path d="M 250 300 Q 300 300 300 320 Q 300 340 250 340" className="fill-none stroke-gray-600 dark:stroke-gray-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-oauth)" />
                    <text x={320} y={315} className="text-[11px] fill-gray-700 dark:fill-gray-300 font-sans">Generate state</text>
                    <text x={320} y={330} className="text-[10px] fill-gray-500 dark:fill-gray-400 italic font-sans">CSRF protection</text>
                </g>

                {/* 7. Open consent screen */}
                <g>
                    <line x1={250} y1={370} x2={445} y2={370} className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-blue-oauth)" />
                    <text x={347} y={363} textAnchor="middle" className="text-[11px] fill-blue-700 dark:fill-blue-300 font-sans font-medium">chrome.identity.launchWebAuthFlow()</text>
                    <text x={347} y={383} textAnchor="middle" className="text-[10px] fill-gray-500 dark:fill-gray-400 italic font-sans">Opens authorization URL in popup</text>
                </g>

                {/* 8. Show consent screen to user */}
                <g>
                    <line x1={450} y1={410} x2={95} y2={410} className="stroke-amber-600 dark:stroke-amber-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-amber-oauth)" />
                    <text x={272} y={403} textAnchor="middle" className="text-[11px] fill-amber-700 dark:fill-amber-300 font-sans font-medium">Display consent screen</text>
                    <text x={272} y={423} textAnchor="middle" className="text-[10px] fill-gray-500 dark:fill-gray-400 italic font-sans">Request permission scopes</text>
                </g>

                {/* 9. User approves */}
                <g>
                    <line x1={90} y1={455} x2={445} y2={455} className="stroke-gray-600 dark:stroke-gray-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-oauth)" />
                    <text x={267} y={448} textAnchor="middle" className="text-[11px] fill-gray-700 dark:fill-gray-300 font-sans font-medium">Approve permissions</text>
                </g>

                {/* 10. Redirect with auth code */}
                <g>
                    <line x1={450} y1={490} x2={255} y2={490} className="stroke-gray-500 dark:stroke-gray-400" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrow-open-oauth)" />
                    <text x={352} y={483} textAnchor="middle" className="text-[11px] fill-gray-600 dark:fill-gray-400 font-sans">Redirect with ?code=...&state=...</text>
                </g>

                {/* 11. Validate state (self-call) */}
                <g>
                    <path d="M 250 520 Q 300 520 300 540 Q 300 560 250 560" className="fill-none stroke-gray-600 dark:stroke-gray-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-oauth)" />
                    <text x={320} y={535} className="text-[11px] fill-gray-700 dark:fill-gray-300 font-sans">Validate state param</text>
                    <text x={320} y={550} className="text-[10px] fill-gray-500 dark:fill-gray-400 italic font-sans">Prevent CSRF attacks</text>
                </g>

                {/* 12. Exchange code for tokens */}
                <g>
                    <line x1={250} y1={590} x2={445} y2={590} className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-blue-oauth)" />
                    <text x={347} y={583} textAnchor="middle" className="text-[11px] fill-blue-700 dark:fill-blue-300 font-sans font-medium">POST /token</text>
                    <text x={347} y={603} textAnchor="middle" className="text-[10px] fill-gray-500 dark:fill-gray-400 italic font-sans">grant_type=authorization_code</text>
                </g>

                {/* 13. Return tokens */}
                <g>
                    <line x1={450} y1={635} x2={255} y2={635} className="stroke-green-600 dark:stroke-green-400" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrow-open-green-oauth)" />
                    <text x={352} y={628} textAnchor="middle" className="text-[11px] fill-green-700 dark:fill-green-300 font-sans font-medium">access_token, refresh_token</text>
                </g>

                {/* 14. Store credentials */}
                <g>
                    <line x1={250} y1={665} x2={830} y2={665} className="stroke-gray-600 dark:stroke-gray-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-oauth)" />
                    <text x={540} y={658} textAnchor="middle" className="text-[11px] fill-gray-700 dark:fill-gray-300 font-sans">Store tokens + client credentials</text>
                    <text x={540} y={678} textAnchor="middle" className="text-[10px] fill-gray-500 dark:fill-gray-400 italic font-sans">chrome.storage.local</text>
                </g>

                {/* 15. Connect to MCP Server */}
                <g>
                    <line x1={250} y1={710} x2={665} y2={710} className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-blue-oauth)" />
                    <text x={457} y={703} textAnchor="middle" className="text-[11px] fill-blue-700 dark:fill-blue-300 font-sans font-medium">Connect with Bearer token</text>
                    <text x={457} y={723} textAnchor="middle" className="text-[10px] fill-gray-500 dark:fill-gray-400 italic font-sans">Authorization: Bearer {'{access_token}'}</text>
                </g>

                {/* 16. Connection ready */}
                <g>
                    <line x1={670} y1={755} x2={255} y2={755} className="stroke-green-600 dark:stroke-green-400" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrow-open-green-oauth)" />
                    <text x={462} y={748} textAnchor="middle" className="text-[11px] fill-green-700 dark:fill-green-300 font-sans font-medium">Connection established</text>
                    <text x={462} y={768} textAnchor="middle" className="text-[10px] fill-gray-500 dark:fill-gray-400 italic font-sans">Tools now available</text>
                </g>

                {/* Arrow Definitions */}
                <defs>
                    <marker id="arrow-filled-oauth" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-gray-600 dark:fill-gray-400" />
                    </marker>
                    <marker id="arrow-filled-blue-oauth" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-blue-600 dark:fill-blue-400" />
                    </marker>
                    <marker id="arrow-filled-amber-oauth" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-amber-600 dark:fill-amber-400" />
                    </marker>
                    <marker id="arrow-open-oauth" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-none stroke-gray-500 dark:stroke-gray-400" strokeWidth="1.5" />
                    </marker>
                    <marker id="arrow-open-green-oauth" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-none stroke-green-600 dark:stroke-green-400" strokeWidth="1.5" />
                    </marker>
                </defs>
            </svg>
        </div>
    );
}
