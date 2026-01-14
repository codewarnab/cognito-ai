/**
 * Backend/Cloud Mode Flow Sequence Diagram
 * 
 * Shows how requests flow through the Cognito backend in Cloud mode,
 * where the server handles API key management.
 */
export function BackendModeSequence() {
    return (
        <div className="not-prose my-6 font-mono text-sm">
            <svg viewBox="0 0 900 480" className="w-full max-w-4xl">
                {/* Participants */}
                <g className="fill-white dark:fill-gray-800 stroke-gray-300 dark:stroke-gray-600">
                    <rect x={50} y={10} width={130} height={50} rx={6} strokeWidth={1.5} />
                    <rect x={250} y={10} width={120} height={50} rx={6} strokeWidth={1.5} />
                    <rect x={460} y={10} width={160} height={50} rx={6} strokeWidth={1.5} />
                    <rect x={710} y={10} width={140} height={50} rx={6} strokeWidth={1.5} />
                </g>

                {/* Participant Labels - text-base (16px) */}
                <g className="fill-gray-800 dark:fill-gray-200 text-base font-bold font-sans">
                    <text x={115} y={40} textAnchor="middle">Your Browser</text>
                    <text x={310} y={40} textAnchor="middle">Extension</text>
                    <text x={540} y={40} textAnchor="middle">Cognito Backend</text>
                    <text x={780} y={40} textAnchor="middle">Google AI API</text>
                </g>

                {/* Lifelines */}
                <g className="stroke-gray-300 dark:stroke-gray-600" strokeWidth={1.5} strokeDasharray="6 4">
                    <line x1={115} y1={60} x2={115} y2={460} />
                    <line x1={310} y1={60} x2={310} y2={460} />
                    <line x1={540} y1={60} x2={540} y2={460} />
                    <line x1={780} y1={60} x2={780} y2={460} />
                </g>

                {/* 1. Send message */}
                <g>
                    <line x1={115} y1={100} x2={305} y2={100} className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-blue-backend)" />
                    <text x={210} y={90} textAnchor="middle" className="text-sm fill-blue-700 dark:fill-blue-300 font-sans font-medium">Send message</text>
                </g>

                {/* 2. Request (no key) */}
                <g>
                    <line x1={310} y1={160} x2={535} y2={160} className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-blue-backend)" />
                    <text x={422} y={150} textAnchor="middle" className="text-sm fill-blue-700 dark:fill-blue-300 font-sans font-medium">Request (no key)</text>
                </g>

                {/* Note: Uses server-side key */}
                <rect x={450} y={180} width={180} height={35} rx={4} className="fill-amber-50 stroke-amber-200 dark:fill-amber-900/30 dark:stroke-amber-700" strokeWidth={1} />
                <text x={540} y={203} textAnchor="middle" className="text-sm fill-amber-700 dark:fill-amber-300 font-sans">Uses server-side key</text>

                {/* 3. API call */}
                <g>
                    <line x1={540} y1={250} x2={775} y2={250} className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-blue-backend)" />
                    <text x={657} y={240} textAnchor="middle" className="text-sm fill-blue-700 dark:fill-blue-300 font-sans font-medium">API call</text>
                </g>

                {/* 4. Response from Google */}
                <g>
                    <line x1={780} y1={310} x2={545} y2={310} className="stroke-gray-500 dark:stroke-gray-400" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrow-open-backend)" />
                    <text x={662} y={300} textAnchor="middle" className="text-sm fill-gray-600 dark:fill-gray-400 font-sans">Response</text>
                </g>

                {/* 5. Response to extension */}
                <g>
                    <line x1={540} y1={370} x2={315} y2={370} className="stroke-gray-500 dark:stroke-gray-400" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrow-open-backend)" />
                    <text x={427} y={360} textAnchor="middle" className="text-sm fill-gray-600 dark:fill-gray-400 font-sans">Response</text>
                </g>

                {/* 6. Display response */}
                <g>
                    <line x1={310} y1={430} x2={120} y2={430} className="stroke-green-600 dark:stroke-green-400" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrow-open-green-backend)" />
                    <text x={215} y={420} textAnchor="middle" className="text-sm fill-green-700 dark:fill-green-300 font-sans font-medium">Display response</text>
                </g>

                {/* Arrow Definitions - unique IDs for this component */}
                <defs>
                    <marker id="arrow-filled-blue-backend" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-blue-600 dark:fill-blue-400" />
                    </marker>
                    <marker id="arrow-open-backend" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-none stroke-gray-500 dark:stroke-gray-400" strokeWidth="1.5" />
                    </marker>
                    <marker id="arrow-open-green-backend" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-none stroke-green-600 dark:stroke-green-400" strokeWidth="1.5" />
                    </marker>
                </defs>
            </svg>
        </div>
    );
}
