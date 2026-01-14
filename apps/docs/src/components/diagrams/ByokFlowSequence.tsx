/**
 * BYOK (Bring Your Own Key) Flow Sequence Diagram
 * 
 * Shows how API keys stay local in BYOK mode - the extension
 * retrieves the key from Chrome storage and makes direct API calls.
 */
export function ByokFlowSequence() {
    return (
        <div className="not-prose my-6 font-mono text-sm">
            <svg viewBox="0 0 700 420" className="w-full max-w-2xl">
                {/* Participants */}
                <g className="fill-white dark:fill-gray-800 stroke-gray-300 dark:stroke-gray-600">
                    <rect x={50} y={10} width={130} height={50} rx={6} strokeWidth={1.5} />
                    <rect x={260} y={10} width={130} height={50} rx={6} strokeWidth={1.5} />
                    <rect x={480} y={10} width={140} height={50} rx={6} strokeWidth={1.5} />
                </g>

                {/* Participant Labels - text-base (16px) */}
                <g className="fill-gray-800 dark:fill-gray-200 text-base font-bold font-sans">
                    <text x={115} y={40} textAnchor="middle">Your Browser</text>
                    <text x={325} y={40} textAnchor="middle">Extension</text>
                    <text x={550} y={40} textAnchor="middle">Google AI API</text>
                </g>

                {/* Lifelines */}
                <g className="stroke-gray-300 dark:stroke-gray-600" strokeWidth={1.5} strokeDasharray="6 4">
                    <line x1={115} y1={60} x2={115} y2={400} />
                    <line x1={325} y1={60} x2={325} y2={400} />
                    <line x1={550} y1={60} x2={550} y2={400} />
                </g>

                {/* Note: Key stored in Chrome storage */}
                <rect x={230} y={80} width={190} height={35} rx={4} className="fill-amber-50 stroke-amber-200 dark:fill-amber-900/30 dark:stroke-amber-700" strokeWidth={1} />
                <text x={325} y={103} textAnchor="middle" className="text-sm fill-amber-700 dark:fill-amber-300 font-sans">Key stored in Chrome storage</text>

                {/* 1. Send message */}
                <g>
                    <line x1={115} y1={150} x2={320} y2={150} className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-blue-byok)" />
                    <text x={217} y={140} textAnchor="middle" className="text-sm fill-blue-700 dark:fill-blue-300 font-sans font-medium">Send message</text>
                </g>

                {/* 2. Retrieve key (self-call) */}
                <g>
                    <path d="M 325 200 Q 385 200 385 230 Q 385 260 325 260" className="fill-none stroke-gray-600 dark:stroke-gray-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-byok)" />
                    <text x={405} y={235} className="text-sm fill-gray-700 dark:fill-gray-300 font-sans">Retrieve key</text>
                </g>

                {/* 3. Direct API call with key */}
                <g>
                    <line x1={325} y1={300} x2={545} y2={300} className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-blue-byok)" />
                    <text x={435} y={290} textAnchor="middle" className="text-sm fill-blue-700 dark:fill-blue-300 font-sans font-medium">Direct API call with key</text>
                </g>

                {/* Note: HTTPS encrypted */}
                <rect x={460} y={310} width={140} height={30} rx={4} className="fill-green-50 stroke-green-200 dark:fill-green-900/30 dark:stroke-green-700" strokeWidth={1} />
                <text x={530} y={330} textAnchor="middle" className="text-[13px] fill-green-700 dark:fill-green-300 font-sans">HTTPS encrypted</text>

                {/* 4. Response */}
                <g>
                    <line x1={550} y1={360} x2={330} y2={360} className="stroke-gray-500 dark:stroke-gray-400" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrow-open-byok)" />
                    <text x={440} y={350} textAnchor="middle" className="text-sm fill-gray-600 dark:fill-gray-400 font-sans">Response</text>
                </g>

                {/* 5. Display response */}
                <g>
                    <line x1={325} y1={400} x2={120} y2={400} className="stroke-green-600 dark:stroke-green-400" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrow-open-green-byok)" />
                    <text x={222} y={390} textAnchor="middle" className="text-sm fill-green-700 dark:fill-green-300 font-sans font-medium">Display response</text>
                </g>

                {/* Arrow Definitions - unique IDs for this component */}
                <defs>
                    <marker id="arrow-filled-byok" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-gray-600 dark:fill-gray-400" />
                    </marker>
                    <marker id="arrow-filled-blue-byok" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-blue-600 dark:fill-blue-400" />
                    </marker>
                    <marker id="arrow-open-byok" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-none stroke-gray-500 dark:stroke-gray-400" strokeWidth="1.5" />
                    </marker>
                    <marker id="arrow-open-green-byok" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-none stroke-green-600 dark:stroke-green-400" strokeWidth="1.5" />
                    </marker>
                </defs>
            </svg>
        </div>
    );
}
