export function BackendModeSequence() {
    return (
        <div className="not-prose my-6 font-mono text-sm">
            <svg viewBox="0 0 600 280" className="w-full max-w-2xl">
                {/* Participants */}
                <g className="fill-current text-gray-800 dark:text-gray-200">
                    <rect x="40" y="10" width="90" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="85" y="30" textAnchor="middle" className="text-[11px] font-medium">Your Browser</text>

                    <rect x="180" y="10" width="90" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="225" y="30" textAnchor="middle" className="text-[11px] font-medium">Extension</text>

                    <rect x="330" y="10" width="110" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="385" y="30" textAnchor="middle" className="text-[11px] font-medium">Cognito Backend</text>

                    <rect x="490" y="10" width="90" height="30" rx="4" className="fill-gray-100 stroke-gray-800 dark:fill-gray-800 dark:stroke-gray-300" strokeWidth="1.5" />
                    <text x="535" y="30" textAnchor="middle" className="text-[11px] font-medium">Google AI API</text>
                </g>

                {/* Lifelines */}
                <g className="stroke-gray-400 dark:stroke-gray-500" strokeWidth="1" strokeDasharray="4 3">
                    <line x1="85" y1="40" x2="85" y2="265" />
                    <line x1="225" y1="40" x2="225" y2="265" />
                    <line x1="385" y1="40" x2="385" y2="265" />
                    <line x1="535" y1="40" x2="535" y2="265" />
                </g>

                {/* Messages */}
                <g className="fill-current text-gray-700 dark:text-gray-300">
                    {/* 1. Send message */}
                    <line x1="85" y1="70" x2="220" y2="70" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-backend)" />
                    <text x="152" y="63" textAnchor="middle" className="text-[10px]">Send message</text>

                    {/* 2. Request (no key) */}
                    <line x1="225" y1="105" x2="380" y2="105" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-backend)" />
                    <text x="302" y="98" textAnchor="middle" className="text-[10px]">Request (no key)</text>

                    {/* Note: Uses server-side key */}
                    <rect x="315" y="115" width="140" height="22" rx="2" className="fill-amber-50 stroke-amber-400 dark:fill-amber-900/30 dark:stroke-amber-500" strokeWidth="1" />
                    <text x="385" y="130" textAnchor="middle" className="text-[10px] fill-amber-700 dark:fill-amber-400">Uses server-side key</text>

                    {/* 3. API call */}
                    <line x1="385" y1="155" x2="530" y2="155" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" markerEnd="url(#arrow-backend)" />
                    <text x="457" y="148" textAnchor="middle" className="text-[10px]">API call</text>

                    {/* 4. Response from Google */}
                    <line x1="535" y1="190" x2="390" y2="190" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-backend)" />
                    <text x="462" y="183" textAnchor="middle" className="text-[10px]">Response</text>

                    {/* 5. Response to extension */}
                    <line x1="385" y1="220" x2="230" y2="220" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-backend)" />
                    <text x="307" y="213" textAnchor="middle" className="text-[10px]">Response</text>

                    {/* 6. Display response */}
                    <line x1="225" y1="250" x2="90" y2="250" className="stroke-gray-800 dark:stroke-gray-300" strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#arrow-backend)" />
                    <text x="157" y="243" textAnchor="middle" className="text-[10px]">Display response</text>
                </g>

                {/* Arrow marker */}
                <defs>
                    <marker id="arrow-backend" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                        <path d="M 0 0 L 8 4 L 0 8 z" className="fill-gray-800 dark:fill-gray-300" />
                    </marker>
                </defs>
            </svg>
        </div>
    );
}
