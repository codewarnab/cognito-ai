export function OAuthFlowSequence() {
    return (
        <div className="not-prose my-6">
            <svg viewBox="0 0 950 720" className="w-full max-w-5xl">
                {/* Participants */}
                <g className="fill-white dark:fill-gray-800 stroke-gray-300 dark:stroke-gray-600">
                    <rect x={50} y={10} width={100} height={40} rx={6} strokeWidth={1.5} />
                    <rect x={220} y={10} width={100} height={40} rx={6} strokeWidth={1.5} />
                    <rect x={430} y={10} width={110} height={40} rx={6} strokeWidth={1.5} />
                    <rect x={680} y={10} width={110} height={40} rx={6} strokeWidth={1.5} />
                </g>

                {/* Participant Labels */}
                <g className="fill-gray-800 dark:fill-gray-200 text-base font-bold font-sans">
                    <text x={100} y={36} textAnchor="middle">Extension</text>
                    <text x={270} y={36} textAnchor="middle">Discovery</text>
                    <text x={485} y={36} textAnchor="middle">Auth Server</text>
                    <text x={735} y={36} textAnchor="middle">MCP Server</text>
                </g>

                {/* Lifelines */}
                <g className="stroke-gray-300 dark:stroke-gray-600" strokeWidth={1.5} strokeDasharray="6 4">
                    <line x1={100} y1={50} x2={100} y2={710} />
                    <line x1={270} y1={50} x2={270} y2={710} />
                    <line x1={485} y1={50} x2={485} y2={710} />
                    <line x1={735} y1={50} x2={735} y2={710} />
                </g>

                {/* Discovery Phase */}
                <text x={40} y={95} className="text-[13px] fill-gray-500 dark:fill-gray-400 italic font-sans">Discovery</text>

                {/* 1. discoverOAuthEndpoints() */}
                <line x1={100} y1={120} x2={265} y2={120} className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={1.5} markerEnd="url(#arrow-oauth-blue)" />
                <text x={182} y={110} textAnchor="middle" className="text-sm fill-blue-700 dark:fill-blue-300 font-sans font-medium">discoverOAuthEndpoints()</text>

                {/* 2. GET protected resource metadata */}
                <line x1={270} y1={180} x2={730} y2={180} className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={1.5} markerEnd="url(#arrow-oauth-blue)" />
                <text x={500} y={170} textAnchor="middle" className="text-sm fill-blue-700 dark:fill-blue-300 font-mono font-medium">GET /.well-known/oauth-protected-resource</text>

                {/* 3. GET auth server metadata */}
                <line x1={270} y1={240} x2={480} y2={240} className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={1.5} markerEnd="url(#arrow-oauth-blue)" />
                <text x={375} y={230} textAnchor="middle" className="text-sm fill-blue-700 dark:fill-blue-300 font-mono font-medium">GET /.well-known/oauth-authorization-server</text>

                {/* 4. Return OAuthEndpoints */}
                <line x1={265} y1={300} x2={105} y2={300} className="stroke-gray-500 dark:stroke-gray-400" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrow-oauth-open)" />
                <text x={185} y={290} textAnchor="middle" className="text-sm fill-gray-600 dark:fill-gray-400 font-sans">OAuthEndpoints</text>

                {/* Registration Phase Divider */}
                <line x1={40} y1={350} x2={900} y2={350} className="stroke-gray-200 dark:stroke-gray-700" strokeWidth={1} />
                <text x={40} y={380} className="text-[13px] fill-gray-500 dark:fill-gray-400 italic font-sans">Registration</text>

                {/* 5. POST registration_endpoint */}
                <line x1={100} y1={410} x2={480} y2={410} className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={1.5} markerEnd="url(#arrow-oauth-blue)" />
                <text x={290} y={400} textAnchor="middle" className="text-sm fill-blue-700 dark:fill-blue-300 font-mono font-medium">POST registration_endpoint</text>

                {/* Note: Dynamic Client Registration */}
                <rect x={510} y={395} width={185} height={30} rx={4} className="fill-amber-50 stroke-amber-300 dark:fill-amber-900/30 dark:stroke-amber-600" strokeWidth={1} />
                <text x={602} y={415} textAnchor="middle" className="text-sm fill-amber-700 dark:fill-amber-300 font-sans">Dynamic Client Registration</text>

                {/* 6. Return client credentials */}
                <line x1={480} y1={470} x2={105} y2={470} className="stroke-gray-500 dark:stroke-gray-400" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrow-oauth-open)" />
                <text x={292} y={460} textAnchor="middle" className="text-sm fill-gray-600 dark:fill-gray-400 font-mono">client_id, client_secret</text>

                {/* Authorization Phase Divider */}
                <line x1={40} y1={515} x2={900} y2={515} className="stroke-gray-200 dark:stroke-gray-700" strokeWidth={1} />
                <text x={40} y={545} className="text-[13px] fill-gray-500 dark:fill-gray-400 italic font-sans">Authorization</text>

                {/* 7. Open authorization URL */}
                <line x1={100} y1={575} x2={480} y2={575} className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={1.5} markerEnd="url(#arrow-oauth-blue)" />
                <text x={290} y={565} textAnchor="middle" className="text-sm fill-blue-700 dark:fill-blue-300 font-sans font-medium">Open authorization URL</text>

                {/* Note: User consent screen */}
                <rect x={510} y={560} width={160} height={30} rx={4} className="fill-amber-50 stroke-amber-300 dark:fill-amber-900/30 dark:stroke-amber-600" strokeWidth={1} />
                <text x={590} y={580} textAnchor="middle" className="text-sm fill-amber-700 dark:fill-amber-300 font-sans">User consent screen</text>

                {/* 8. Return authorization_code */}
                <line x1={480} y1={625} x2={105} y2={625} className="stroke-gray-500 dark:stroke-gray-400" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrow-oauth-open)" />
                <text x={292} y={615} textAnchor="middle" className="text-sm fill-gray-600 dark:fill-gray-400 font-mono">authorization_code</text>

                {/* 9. POST token_endpoint */}
                <line x1={100} y1={675} x2={480} y2={675} className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={1.5} markerEnd="url(#arrow-oauth-blue)" />
                <text x={290} y={665} textAnchor="middle" className="text-sm fill-blue-700 dark:fill-blue-300 font-mono font-medium">POST token_endpoint</text>

                {/* 10. Return tokens */}
                <line x1={480} y1={720} x2={105} y2={720} className="stroke-green-600 dark:stroke-green-400" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrow-oauth-green)" />
                <text x={292} y={710} textAnchor="middle" className="text-sm fill-green-600 dark:fill-green-400 font-mono">access_token, refresh_token</text>

                {/* Arrow Markers */}
                <defs>
                    <marker id="arrow-oauth-blue" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-blue-600 dark:fill-blue-400" />
                    </marker>
                    <marker id="arrow-oauth-open" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-none stroke-gray-500 dark:stroke-gray-400" strokeWidth="1.5" />
                    </marker>
                    <marker id="arrow-oauth-green" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-none stroke-green-600 dark:stroke-green-400" strokeWidth="1.5" />
                    </marker>
                </defs>
            </svg>
        </div>
    );
}
