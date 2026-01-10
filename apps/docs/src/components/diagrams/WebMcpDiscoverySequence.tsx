export function WebMcpDiscoverySequence() {
    return (
        <div className="not-prose my-6 font-mono text-sm">
            <svg viewBox="0 0 600 340" className="w-full max-w-2xl">
                {/* Participants */}
                <g className="fill-current text-gray-800 dark:text-gray-200">
                    <rect x="40" y="10" width="80" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="80" y="30" textAnchor="middle" className="text-[10px] font-medium">Web Page</text>

                    <rect x="175" y="10" width="100" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="225" y="30" textAnchor="middle" className="text-[10px] font-medium">Content Script</text>

                    <rect x="330" y="10" width="80" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="370" y="30" textAnchor="middle" className="text-[10px] font-medium">Background</text>

                    <rect x="465" y="10" width="80" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="505" y="30" textAnchor="middle" className="text-[10px] font-medium">Side Panel</text>
                </g>

                {/* Lifelines */}
                <g className="stroke-gray-400 dark:stroke-gray-500" strokeWidth="1" strokeDasharray="4 3">
                    <line x1="80" y1="40" x2="80" y2="330" />
                    <line x1="225" y1="40" x2="225" y2="330" />
                    <line x1="370" y1="40" x2="370" y2="330" />
                    <line x1="505" y1="40" x2="505" y2="330" />
                </g>

                {/* Messages */}
                <g className="fill-current text-gray-700 dark:text-gray-300">
                    {/* Note: Page loads */}
                    <rect x="190" y="55" width="70" height="18" rx="2" className="fill-blue-50 stroke-blue-400 dark:fill-blue-900/30 dark:stroke-blue-500" strokeWidth="1" />
                    <text x="225" y="68" textAnchor="middle" className="text-[9px] fill-blue-700 dark:fill-blue-400">Page loads</text>

                    {/* 1. Connect via postMessage */}
                    <line x1="225" y1="90" x2="85" y2="90" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-discovery)" />
                    <text x="155" y="83" textAnchor="middle" className="text-[10px]">Connect (postMessage)</text>

                    {/* 2. Connection accepted */}
                    <line x1="80" y1="115" x2="220" y2="115" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-discovery)" />
                    <text x="150" y="108" textAnchor="middle" className="text-[10px]">Connection accepted</text>

                    {/* 3. listTools() */}
                    <line x1="225" y1="145" x2="85" y2="145" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-discovery)" />
                    <text x="155" y="138" textAnchor="middle" className="text-[10px]">listTools()</text>

                    {/* 4. Tool list response */}
                    <line x1="80" y1="170" x2="220" y2="170" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-discovery)" />
                    <text x="150" y="163" textAnchor="middle" className="text-[10px]">Tool definitions</text>

                    {/* 5. Register tools with BG */}
                    <line x1="225" y1="200" x2="365" y2="200" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-discovery)" />
                    <text x="295" y="193" textAnchor="middle" className="text-[10px]">webmcp/tools/register</text>

                    {/* Note: Includes domain, tabId, favicon */}
                    <rect x="240" y="210" width="130" height="28" rx="2" className="fill-amber-50 stroke-amber-400 dark:fill-amber-900/30 dark:stroke-amber-500" strokeWidth="1" />
                    <text x="305" y="223" textAnchor="middle" className="text-[8px] fill-amber-700 dark:fill-amber-400">Includes: domain, tabId</text>
                    <text x="305" y="233" textAnchor="middle" className="text-[8px] fill-amber-700 dark:fill-amber-400">favicon, url</text>

                    {/* 6. Store tools in state */}
                    <path d="M 370 255 Q 410 255 410 268 Q 410 281 370 281" className="fill-none stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-discovery)" />
                    <text x="425" y="271" className="text-[10px]">Store in state</text>

                    {/* 7. Broadcast update */}
                    <line x1="370" y1="300" x2="500" y2="300" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-discovery)" />
                    <text x="435" y="293" textAnchor="middle" className="text-[10px]">webmcp/tools/updated</text>

                    {/* 8. Update UI */}
                    <path d="M 505 315 Q 545 315 545 322 Q 545 329 505 329" className="fill-none stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-discovery)" />
                    <text x="520" y="325" className="text-[9px]">Update UI</text>
                </g>

                {/* Arrow marker */}
                <defs>
                    <marker id="arrow-discovery" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                        <path d="M 0 0 L 8 4 L 0 8 z" className="fill-gray-800 dark:fill-gray-300" />
                    </marker>
                </defs>
            </svg>
        </div>
    );
}
