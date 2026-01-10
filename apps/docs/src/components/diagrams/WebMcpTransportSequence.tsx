export function WebMcpTransportSequence() {
    return (
        <div className="not-prose my-6 font-mono text-sm">
            <svg viewBox="0 0 400 180" className="w-full max-w-md">
                {/* Participants */}
                <g className="fill-current text-gray-800 dark:text-gray-200">
                    <rect x="60" y="10" width="100" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="110" y="30" textAnchor="middle" className="text-[10px] font-medium">Content Script</text>

                    <rect x="240" y="10" width="100" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="290" y="30" textAnchor="middle" className="text-[10px] font-medium">Web Page</text>
                </g>

                {/* Lifelines */}
                <g className="stroke-gray-400 dark:stroke-gray-500" strokeWidth="1" strokeDasharray="4 3">
                    <line x1="110" y1="40" x2="110" y2="170" />
                    <line x1="290" y1="40" x2="290" y2="170" />
                </g>

                {/* Messages */}
                <g className="fill-current text-gray-700 dark:text-gray-300">
                    {/* 1. mcp-request */}
                    <line x1="115" y1="80" x2="285" y2="80" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-transport)" />
                    <text x="200" y="73" textAnchor="middle" className="text-[10px]">mcp-request</text>

                    {/* 2. mcp-response */}
                    <line x1="285" y1="120" x2="115" y2="120" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-transport)" />
                    <text x="200" y="113" textAnchor="middle" className="text-[10px]">mcp-response</text>
                </g>

                {/* Arrow marker */}
                <defs>
                    <marker id="arrow-transport" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" className="fill-gray-800 dark:fill-gray-300" />
                    </marker>
                </defs>
            </svg>
        </div>
    );
}
