/**
 * Memory Extraction Sequence Diagram
 * 
 * Shows the auto-extraction flow for Supermemory integration.
 */

export function MemoryExtractionSequence() {
    return (
        <div className="not-prose my-6 font-mono text-sm">
            <svg viewBox="0 0 1100 820" className="w-full max-w-6xl">
                {/* OPT block background */}
                <rect x={30} y={140} width={420} height={130} rx={4} className="fill-blue-50/50 dark:fill-blue-900/10" />

                {/* LOOP block background */}
                <rect x={30} y={620} width={1040} height={105} rx={4} className="fill-amber-50/50 dark:fill-amber-900/10" />

                {/* Participants */}
                <g className="fill-white dark:fill-gray-800 stroke-gray-300 dark:stroke-gray-600">
                    <rect x={50} y={10} width={80} height={44} rx={6} strokeWidth={1.5} />
                    <rect x={190} y={10} width={110} height={44} rx={6} strokeWidth={1.5} />
                    <rect x={380} y={10} width={140} height={44} rx={6} strokeWidth={1.5} />
                    <rect x={600} y={10} width={120} height={44} rx={6} strokeWidth={1.5} />
                    <rect x={800} y={10} width={100} height={44} rx={6} strokeWidth={1.5} />
                    <rect x={980} y={10} width={90} height={44} rx={6} className="fill-purple-50 dark:fill-purple-900/30 stroke-purple-300 dark:stroke-purple-600" strokeWidth={1.5} />
                </g>

                {/* Participant Labels - text-sm (14px) */}
                <g className="fill-gray-800 dark:fill-gray-200 text-sm font-bold font-sans">
                    <text x={90} y={37} textAnchor="middle">User</text>
                    <text x={245} y={37} textAnchor="middle">Extension UI</text>
                    <text x={450} y={37} textAnchor="middle">Background Script</text>
                    <text x={660} y={37} textAnchor="middle">Extraction Svc</text>
                    <text x={850} y={37} textAnchor="middle">Gemini API</text>
                    <text x={1025} y={37} textAnchor="middle" className="fill-purple-700 dark:fill-purple-300">Supermemory</text>
                </g>

                {/* Lifelines */}
                <g className="stroke-gray-300 dark:stroke-gray-600" strokeWidth={1.5} strokeDasharray="6 4">
                    <line x1={90} y1={54} x2={90} y2={800} />
                    <line x1={245} y1={54} x2={245} y2={800} />
                    <line x1={450} y1={54} x2={450} y2={800} />
                    <line x1={660} y1={54} x2={660} y2={800} />
                    <line x1={850} y1={54} x2={850} y2={800} />
                    <line x1={1025} y1={54} x2={1025} y2={800} />
                </g>

                {/* 1. User switches thread */}
                <g>
                    <line x1={90} y1={95} x2={240} y2={95} className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-blue-mem)" />
                    <text x={165} y={86} textAnchor="middle" className="text-[13px] fill-blue-700 dark:fill-blue-300 font-sans font-medium">Switch thread / New chat</text>
                    <text x={165} y={112} textAnchor="middle" className="text-[12px] fill-gray-500 dark:fill-gray-400 italic">Triggers extraction check</text>
                </g>

                {/* OPT Block */}
                <g>
                    <rect x={30} y={140} width={55} height={22} rx={0} className="fill-blue-100 dark:fill-blue-900/40 opacity-80" />
                    <text x={42} y={156} className="text-[12px] font-bold fill-blue-800 dark:fill-blue-200">OPT</text>
                    <text x={95} y={156} className="text-[12px] fill-blue-700 dark:fill-blue-300 italic">[Supermemory enabled & auto-extract on]</text>
                    <rect x={30} y={140} width={420} height={130} rx={4} className="fill-none stroke-blue-200 dark:stroke-blue-800" strokeWidth={1} />
                </g>

                {/* 2. Check eligibility */}
                <g>
                    <path d="M 245 175 Q 315 175 315 202 Q 315 229 245 229" className="fill-none stroke-gray-600 dark:stroke-gray-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-mem)" />
                    <text x={335} y={195} className="text-[13px] fill-gray-700 dark:fill-gray-300 font-sans">maybeQueueForExtraction()</text>
                    <text x={335} y={214} className="text-[12px] fill-gray-500 dark:fill-gray-400 italic">Check 4+ msgs, 10+ new since last</text>
                </g>

                {/* 3. Queue for extraction */}
                <g>
                    <line x1={245} y1={295} x2={445} y2={295} className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-blue-mem)" />
                    <text x={345} y={286} textAnchor="middle" className="text-[13px] fill-blue-700 dark:fill-blue-300 font-sans font-medium">QUEUE_MEMORY_EXTRACTION</text>
                    <text x={345} y={312} textAnchor="middle" className="text-[12px] fill-gray-500 dark:fill-gray-400 italic">Chrome messaging to background</text>
                </g>

                {/* 4. Store in queue */}
                <g>
                    <path d="M 450 350 Q 520 350 520 377 Q 520 404 450 404" className="fill-none stroke-gray-600 dark:stroke-gray-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-mem)" />
                    <text x={540} y={370} className="text-[13px] fill-gray-700 dark:fill-gray-300 font-sans">queueThreadForExtraction()</text>
                    <text x={540} y={389} className="text-[12px] fill-gray-500 dark:fill-gray-400 italic">Store in chrome.storage.local</text>
                </g>

                {/* 5. Chrome Alarm triggers */}
                <g>
                    <path d="M 450 440 Q 520 440 520 467 Q 520 494 450 494" className="fill-none stroke-amber-600 dark:stroke-amber-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-amber-mem)" />
                    <text x={540} y={460} className="text-[13px] fill-amber-700 dark:fill-amber-300 font-sans font-medium">Chrome Alarm fires</text>
                    <text x={540} y={479} className="text-[12px] fill-gray-500 dark:fill-gray-400 italic">Every 5 min, 1 min initial delay</text>
                </g>

                {/* 6. Process extraction */}
                <g>
                    <line x1={450} y1={525} x2={655} y2={525} className="stroke-gray-600 dark:stroke-gray-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-mem)" />
                    <text x={552} y={516} textAnchor="middle" className="text-[13px] fill-gray-700 dark:fill-gray-300 font-sans">extractFactsFromMessages()</text>
                    <text x={552} y={542} textAnchor="middle" className="text-[12px] fill-gray-500 dark:fill-gray-400 italic">Load messages from IndexedDB</text>
                </g>

                {/* 7. Call Gemini */}
                <g>
                    <line x1={660} y1={575} x2={845} y2={575} className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-blue-mem)" />
                    <text x={752} y={566} textAnchor="middle" className="text-[13px] fill-blue-700 dark:fill-blue-300 font-sans font-medium">generateContent()</text>
                    <text x={752} y={592} textAnchor="middle" className="text-[12px] fill-gray-500 dark:fill-gray-400 italic">With extract_facts tool</text>
                </g>

                {/* 8. Return extracted facts */}
                <g>
                    <line x1={850} y1={615} x2={665} y2={615} className="stroke-gray-500 dark:stroke-gray-400" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrow-open-mem)" />
                    <text x={757} y={606} textAnchor="middle" className="text-[13px] fill-gray-600 dark:fill-gray-400 font-sans">functionCall: extract_facts</text>
                    <rect x={870} y={590} width={150} height={44} rx={4} className="fill-gray-50 stroke-gray-200 dark:fill-gray-800/50 dark:stroke-gray-700" strokeWidth={1} />
                    <text x={945} y={608} textAnchor="middle" className="text-[11px] fill-gray-600 dark:fill-gray-400 font-mono">{`{ facts: [`}</text>
                    <text x={945} y={625} textAnchor="middle" className="text-[11px] fill-gray-600 dark:fill-gray-400 font-mono">{`  {content, cat}...]}`}</text>
                </g>

                {/* LOOP Block */}
                <g>
                    <rect x={30} y={650} width={75} height={22} rx={0} className="fill-amber-100 dark:fill-amber-900/40 opacity-80" />
                    <text x={42} y={666} className="text-[12px] font-bold fill-amber-800 dark:fill-amber-200">LOOP</text>
                    <text x={115} y={666} className="text-[12px] fill-amber-700 dark:fill-amber-300 italic">[for each extracted fact, with 200ms delay]</text>
                    <rect x={30} y={650} width={1040} height={80} rx={4} className="fill-none stroke-amber-200 dark:stroke-amber-800" strokeWidth={1} />
                </g>

                {/* 9. Add fact to Supermemory */}
                <g>
                    <line x1={660} y1={695} x2={1020} y2={695} className="stroke-purple-600 dark:stroke-purple-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-purple-mem)" />
                    <text x={840} y={686} textAnchor="middle" className="text-[13px] fill-purple-700 dark:fill-purple-300 font-sans font-medium">POST /v3/documents</text>
                    <text x={840} y={712} textAnchor="middle" className="text-[12px] fill-gray-500 dark:fill-gray-400 italic">Add fact with metadata</text>
                </g>

                {/* 10. Confirmation */}
                <g>
                    <line x1={1025} y1={750} x2={665} y2={750} className="stroke-green-600 dark:stroke-green-400" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrow-open-green-mem)" />
                    <text x={845} y={741} textAnchor="middle" className="text-[13px] fill-green-700 dark:fill-green-300 font-sans">{`{ id, status: "queued" }`}</text>
                </g>

                {/* 11. Save extraction metadata */}
                <g>
                    <path d="M 450 780 Q 520 780 520 797 Q 520 810 450 810" className="fill-none stroke-green-600 dark:stroke-green-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-green-mem)" />
                    <text x={540} y={792} className="text-[13px] fill-green-700 dark:fill-green-300 font-sans">saveThreadExtractionMeta()</text>
                </g>

                {/* Arrow Definitions */}
                <defs>
                    <marker id="arrow-filled-mem" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-gray-600 dark:fill-gray-400" />
                    </marker>
                    <marker id="arrow-filled-blue-mem" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-blue-600 dark:fill-blue-400" />
                    </marker>
                    <marker id="arrow-filled-amber-mem" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-amber-600 dark:fill-amber-400" />
                    </marker>
                    <marker id="arrow-filled-purple-mem" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-purple-600 dark:fill-purple-400" />
                    </marker>
                    <marker id="arrow-filled-green-mem" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-green-600 dark:fill-green-400" />
                    </marker>
                    <marker id="arrow-open-mem" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-none stroke-gray-500 dark:stroke-gray-400" strokeWidth="1.5" />
                    </marker>
                    <marker id="arrow-open-green-mem" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-none stroke-green-600 dark:stroke-green-400" strokeWidth="1.5" />
                    </marker>
                </defs>
            </svg>
        </div>
    );
}
