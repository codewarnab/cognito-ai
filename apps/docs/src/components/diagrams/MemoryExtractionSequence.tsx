export function MemoryExtractionSequence() {
    return (
        <div className="not-prose my-6 font-mono text-sm">
            <svg viewBox="0 0 520 340" className="w-full max-w-xl">
                {/* Participants */}
                <g className="fill-current text-gray-800 dark:text-gray-200">
                    <rect x="30" y="10" width="60" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="60" y="30" textAnchor="middle" className="text-xs font-medium">User</text>

                    <rect x="140" y="10" width="80" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="180" y="30" textAnchor="middle" className="text-xs font-medium">Extension</text>

                    <rect x="280" y="10" width="80" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="320" y="30" textAnchor="middle" className="text-xs font-medium">Background</text>

                    <rect x="420" y="10" width="80" height="30" rx="4" className="fill-purple-100 stroke-purple-600 dark:fill-purple-900/40 dark:stroke-purple-400" strokeWidth="1.5" />
                    <text x="460" y="30" textAnchor="middle" className="text-xs font-medium">Supermemory</text>
                </g>

                {/* Lifelines */}
                <g className="stroke-gray-400 dark:stroke-gray-500" strokeWidth="1" strokeDasharray="4 3">
                    <line x1="60" y1="40" x2="60" y2="330" />
                    <line x1="180" y1="40" x2="180" y2="330" />
                    <line x1="320" y1="40" x2="320" y2="330" />
                    <line x1="460" y1="40" x2="460" y2="330" />
                </g>

                {/* Messages */}
                <g className="fill-current text-gray-700 dark:text-gray-300">
                    {/* 1. Finishes conversation */}
                    <line x1="60" y1="70" x2="175" y2="70" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-memory)" />
                    <text x="117" y="63" textAnchor="middle" className="text-[10px]">Finishes conversation</text>

                    {/* 2. Queue for extraction */}
                    <line x1="180" y1="105" x2="315" y2="105" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-memory)" />
                    <text x="247" y="98" textAnchor="middle" className="text-[10px]">Queue for extraction</text>

                    {/* Note: eligibility check */}
                    <rect x="195" y="115" width="110" height="20" rx="2" className="fill-amber-50 stroke-amber-400 dark:fill-amber-900/30 dark:stroke-amber-500" strokeWidth="1" />
                    <text x="250" y="129" textAnchor="middle" className="text-[9px] fill-amber-700 dark:fill-amber-400">Check 4+ messages</text>

                    {/* 3. Chrome Alarm triggers */}
                    <path d="M 320 155 Q 360 155 360 175 Q 360 195 320 195" className="fill-none stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-memory)" />
                    <text x="375" y="178" className="text-[10px]">Alarm triggers</text>

                    {/* 4. Extract facts from messages */}
                    <path d="M 320 215 Q 360 215 360 235 Q 360 255 320 255" className="fill-none stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-memory)" />
                    <text x="375" y="238" className="text-[10px]">Extract facts</text>

                    {/* 5. Add facts to memory */}
                    <line x1="320" y1="280" x2="455" y2="280" className="stroke-purple-600 dark:stroke-purple-400" strokeWidth="1.5" markerEnd="url(#arrow-memory-purple)" />
                    <text x="387" y="273" textAnchor="middle" className="text-[10px]">Add facts to memory</text>

                    {/* 6. Confirmation */}
                    <line x1="460" y1="310" x2="325" y2="310" className="stroke-purple-600 dark:stroke-purple-400" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-memory-purple)" />
                    <text x="392" y="303" textAnchor="middle" className="text-[10px]">Confirmation</text>
                </g>

                {/* Arrow markers */}
                <defs>
                    <marker id="arrow-memory" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                        <path d="M 0 0 L 8 4 L 0 8 z" className="fill-gray-800 dark:fill-gray-300" />
                    </marker>
                    <marker id="arrow-memory-purple" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                        <path d="M 0 0 L 8 4 L 0 8 z" className="fill-purple-600 dark:fill-purple-400" />
                    </marker>
                </defs>
            </svg>
        </div>
    );
}
