export function ByokFlowSequence() {
    return (
        <div className="not-prose my-6 font-mono text-sm">
            <svg viewBox="0 0 500 280" className="w-full max-w-xl">
                {/* Participants */}
                <g className="fill-current text-gray-800 dark:text-gray-200">
                    <rect x="50" y="10" width="90" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="95" y="30" textAnchor="middle" className="text-[11px] font-medium">Your Browser</text>

                    <rect x="205" y="10" width="90" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="250" y="30" textAnchor="middle" className="text-[11px] font-medium">Extension</text>

                    <rect x="360" y="10" width="90" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="405" y="30" textAnchor="middle" className="text-[11px] font-medium">Google AI API</text>
                </g>

                {/* Lifelines */}
                <g className="stroke-gray-400 dark:stroke-gray-500" strokeWidth="1" strokeDasharray="4 3">
                    <line x1="95" y1="40" x2="95" y2="265" />
                    <line x1="250" y1="40" x2="250" y2="265" />
                    <line x1="405" y1="40" x2="405" y2="265" />
                </g>

                {/* Messages */}
                <g className="fill-current text-gray-700 dark:text-gray-300">
                    {/* Note: Key stored */}
                    <rect x="180" y="55" width="140" height="22" rx="2" className="fill-amber-50 stroke-amber-400 dark:fill-amber-900/30 dark:stroke-amber-500" strokeWidth="1" />
                    <text x="250" y="70" textAnchor="middle" className="text-[10px] fill-amber-700 dark:fill-amber-400">Key stored in Chrome storage</text>

                    {/* 1. Send message */}
                    <line x1="95" y1="100" x2="245" y2="100" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-byok)" />
                    <text x="170" y="93" textAnchor="middle" className="text-[10px]">Send message</text>

                    {/* 2. Retrieve key */}
                    <path d="M 250 120 Q 290 120 290 140 Q 290 160 250 160" className="fill-none stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-byok)" />
                    <text x="305" y="143" className="text-[10px]">Retrieve key</text>

                    {/* 3. Direct API call */}
                    <line x1="250" y1="180" x2="400" y2="180" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-byok)" />
                    <text x="325" y="173" textAnchor="middle" className="text-[10px]">Direct API call with key</text>

                    {/* Note: HTTPS encrypted */}
                    <rect x="275" y="190" width="105" height="20" rx="2" className="fill-green-50 stroke-green-400 dark:fill-green-900/30 dark:stroke-green-500" strokeWidth="1" />
                    <text x="327" y="204" textAnchor="middle" className="text-[9px] fill-green-700 dark:fill-green-400">HTTPS encrypted</text>

                    {/* 4. Response */}
                    <line x1="405" y1="225" x2="255" y2="225" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-byok)" />
                    <text x="330" y="218" textAnchor="middle" className="text-[10px]">Response</text>

                    {/* 5. Display response */}
                    <line x1="250" y1="250" x2="100" y2="250" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-byok)" />
                    <text x="175" y="243" textAnchor="middle" className="text-[10px]">Display response</text>
                </g>

                {/* Arrow marker */}
                <defs>
                    <marker id="arrow-byok" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                        <path d="M 0 0 L 8 4 L 0 8 z" className="fill-gray-800 dark:fill-gray-300" />
                    </marker>
                </defs>
            </svg>
        </div>
    );
}
