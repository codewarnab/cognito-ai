export function WebMcpValidationFlow() {
    return (
        <div className="not-prose my-6 font-mono text-sm">
            <svg viewBox="0 0 540 100" className="w-full max-w-2xl">
                {/* Main flow boxes */}
                <g className="fill-current text-gray-800 dark:text-gray-200">
                    {/* Tool Call */}
                    <rect x="5" y="10" width="80" height="35" rx="4" className="fill-blue-100 stroke-blue-600 dark:fill-blue-900/40 dark:stroke-blue-400" strokeWidth="1.5" />
                    <text x="45" y="32" textAnchor="middle" className="text-[10px] font-medium fill-blue-800 dark:fill-blue-200">Tool Call</text>

                    {/* Arrow 1 */}
                    <line x1="85" y1="27" x2="108" y2="27" className="stroke-gray-600 dark:stroke-gray-400" strokeWidth="1.5" markerEnd="url(#arrow-validation)" />

                    {/* Origin Check */}
                    <rect x="110" y="10" width="85" height="35" rx="4" className="fill-gray-100 stroke-gray-600 dark:fill-gray-800 dark:stroke-gray-400" strokeWidth="1.5" />
                    <text x="152" y="32" textAnchor="middle" className="text-[10px] font-medium">Origin Check</text>

                    {/* Arrow 2 */}
                    <line x1="195" y1="27" x2="218" y2="27" className="stroke-gray-600 dark:stroke-gray-400" strokeWidth="1.5" markerEnd="url(#arrow-validation)" />

                    {/* Tab ID Check */}
                    <rect x="220" y="10" width="85" height="35" rx="4" className="fill-gray-100 stroke-gray-600 dark:fill-gray-800 dark:stroke-gray-400" strokeWidth="1.5" />
                    <text x="262" y="32" textAnchor="middle" className="text-[10px] font-medium">Tab ID Check</text>

                    {/* Arrow 3 */}
                    <line x1="305" y1="27" x2="328" y2="27" className="stroke-gray-600 dark:stroke-gray-400" strokeWidth="1.5" markerEnd="url(#arrow-validation)" />

                    {/* Schema Check */}
                    <rect x="330" y="10" width="90" height="35" rx="4" className="fill-gray-100 stroke-gray-600 dark:fill-gray-800 dark:stroke-gray-400" strokeWidth="1.5" />
                    <text x="375" y="32" textAnchor="middle" className="text-[10px] font-medium">Schema Check</text>

                    {/* Arrow 4 */}
                    <line x1="420" y1="27" x2="448" y2="27" className="stroke-gray-600 dark:stroke-gray-400" strokeWidth="1.5" markerEnd="url(#arrow-validation)" />

                    {/* Execute */}
                    <rect x="450" y="10" width="70" height="35" rx="4" className="fill-green-100 stroke-green-600 dark:fill-green-900/40 dark:stroke-green-400" strokeWidth="1.5" />
                    <text x="485" y="32" textAnchor="middle" className="text-[10px] font-medium fill-green-800 dark:fill-green-200">Execute</text>
                </g>

                {/* Rejection arrows */}
                <g>
                    {/* Origin Check → Reject */}
                    <line x1="152" y1="45" x2="152" y2="68" className="stroke-red-500 dark:stroke-red-400" strokeWidth="1.5" />
                    <polygon points="152,76 147,68 157,68" className="fill-red-500 dark:fill-red-400" />
                    <text x="152" y="90" textAnchor="middle" className="text-[9px] font-medium fill-red-600 dark:fill-red-400">Reject</text>

                    {/* Tab ID Check → Reject */}
                    <line x1="262" y1="45" x2="262" y2="68" className="stroke-red-500 dark:stroke-red-400" strokeWidth="1.5" />
                    <polygon points="262,76 257,68 267,68" className="fill-red-500 dark:fill-red-400" />
                    <text x="262" y="90" textAnchor="middle" className="text-[9px] font-medium fill-red-600 dark:fill-red-400">Reject</text>

                    {/* Schema Check → Reject */}
                    <line x1="375" y1="45" x2="375" y2="68" className="stroke-red-500 dark:stroke-red-400" strokeWidth="1.5" />
                    <polygon points="375,76 370,68 380,68" className="fill-red-500 dark:fill-red-400" />
                    <text x="375" y="90" textAnchor="middle" className="text-[9px] font-medium fill-red-600 dark:fill-red-400">Reject</text>
                </g>

                {/* Proceed label */}
                <g>
                    <line x1="485" y1="45" x2="485" y2="68" className="stroke-green-500 dark:stroke-green-400" strokeWidth="1.5" />
                    <polygon points="485,76 480,68 490,68" className="fill-green-500 dark:fill-green-400" />
                    <text x="485" y="90" textAnchor="middle" className="text-[9px] font-medium fill-green-600 dark:fill-green-400">Proceed</text>
                </g>

                {/* Arrow markers */}
                <defs>
                    <marker id="arrow-validation" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                        <path d="M 0 0 L 8 4 L 0 8 z" className="fill-gray-600 dark:fill-gray-400" />
                    </marker>
                </defs>
            </svg>
        </div>
    );
}
