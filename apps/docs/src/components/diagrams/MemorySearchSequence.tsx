/**
 * Memory Search Sequence Diagram
 * 
 * Shows how AI-driven memory search works during content generation.
 */

export function MemorySearchSequence() {
    return (
        <div className="not-prose my-6 font-mono text-sm">
            <svg viewBox="0 0 1200 620" className="w-full max-w-6xl">
                {/* OPT block background */}
                <rect x={30} y={210} width={1140} height={330} rx={4} className="fill-blue-50/50 dark:fill-blue-900/10" />

                {/* Participants - 200px spacing between centers */}
                <g className="fill-white dark:fill-gray-800 stroke-gray-300 dark:stroke-gray-600">
                    <rect x={40} y={10} width={100} height={48} rx={6} strokeWidth={1.5} />
                    <rect x={210} y={10} width={140} height={48} rx={6} strokeWidth={1.5} />
                    <rect x={430} y={10} width={160} height={48} rx={6} strokeWidth={1.5} />
                    <rect x={680} y={10} width={120} height={48} rx={6} strokeWidth={1.5} />
                    <rect x={890} y={10} width={130} height={48} rx={6} className="fill-purple-50 dark:fill-purple-900/30 stroke-purple-300 dark:stroke-purple-600" strokeWidth={1.5} />
                    <rect x={1110} y={10} width={60} height={48} rx={6} strokeWidth={1.5} />
                </g>

                {/* Participant Labels - text-sm (14px) */}
                <g className="fill-gray-800 dark:fill-gray-200 text-sm font-bold font-sans">
                    <text x={90} y={40} textAnchor="middle">User</text>
                    <text x={280} y={40} textAnchor="middle">Writer/Chat UI</text>
                    <text x={510} y={40} textAnchor="middle">Generation Service</text>
                    <text x={740} y={40} textAnchor="middle">LLM API</text>
                    <text x={955} y={40} textAnchor="middle" className="fill-purple-700 dark:fill-purple-300">Supermemory</text>
                    <text x={1140} y={40} textAnchor="middle">UI</text>
                </g>

                {/* Lifelines */}
                <g className="stroke-gray-300 dark:stroke-gray-600" strokeWidth={1.5} strokeDasharray="6 4">
                    <line x1={90} y1={58} x2={90} y2={600} />
                    <line x1={280} y1={58} x2={280} y2={600} />
                    <line x1={510} y1={58} x2={510} y2={600} />
                    <line x1={740} y1={58} x2={740} y2={600} />
                    <line x1={955} y1={58} x2={955} y2={600} />
                    <line x1={1140} y1={58} x2={1140} y2={600} />
                </g>

                {/* 1. User requests content */}
                <g>
                    <line x1={90} y1={100} x2={275} y2={100} className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-blue-search)" />
                    <text x={182} y={88} textAnchor="middle" className="text-sm fill-blue-700 dark:fill-blue-300 font-sans font-medium">Generate content</text>
                    <text x={182} y={118} textAnchor="middle" className="text-[13px] fill-gray-500 dark:fill-gray-400 italic">"Write about my project"</text>
                </g>

                {/* 2. Start generation */}
                <g>
                    <line x1={280} y1={155} x2={505} y2={155} className="stroke-gray-600 dark:stroke-gray-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-search)" />
                    <text x={392} y={143} textAnchor="middle" className="text-sm fill-gray-700 dark:fill-gray-300 font-sans">generateWithProvider()</text>
                    <text x={392} y={173} textAnchor="middle" className="text-[13px] fill-gray-500 dark:fill-gray-400 italic">With search_memories tool enabled</text>
                </g>

                {/* 3. Send to LLM */}
                <g>
                    <line x1={510} y1={205} x2={735} y2={205} className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-blue-search)" />
                    <text x={622} y={193} textAnchor="middle" className="text-sm fill-blue-700 dark:fill-blue-300 font-sans font-medium">streamText() / generateContent()</text>
                </g>

                {/* OPT Block */}
                <g>
                    <rect x={30} y={225} width={60} height={24} rx={0} className="fill-blue-100 dark:fill-blue-900/40 opacity-80" />
                    <text x={44} y={243} className="text-[13px] font-bold fill-blue-800 dark:fill-blue-200">OPT</text>
                    <text x={100} y={243} className="text-[13px] fill-blue-700 dark:fill-blue-300 italic">[LLM decides memory context would help]</text>
                    <rect x={30} y={225} width={1140} height={300} rx={4} className="fill-none stroke-blue-200 dark:stroke-blue-800" strokeWidth={1} />
                </g>

                {/* 4. LLM returns tool call */}
                <g>
                    <line x1={740} y1={275} x2={515} y2={275} className="stroke-gray-500 dark:stroke-gray-400" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrow-open-search)" />
                    <text x={627} y={263} textAnchor="middle" className="text-sm fill-gray-600 dark:fill-gray-400 font-sans">functionCall: search_memories</text>
                    <rect x={530} y={285} width={195} height={45} rx={4} className="fill-gray-50 stroke-gray-200 dark:fill-gray-800/50 dark:stroke-gray-700" strokeWidth={1} />
                    <text x={627} y={305} textAnchor="middle" className="text-[12px] fill-gray-600 dark:fill-gray-400 font-mono">{`{ query: "user's project",`}</text>
                    <text x={627} y={322} textAnchor="middle" className="text-[12px] fill-gray-600 dark:fill-gray-400 font-mono">{`  limit: 5 }`}</text>
                </g>

                {/* 5. Execute memory search */}
                <g>
                    <line x1={510} y1={360} x2={950} y2={360} className="stroke-purple-600 dark:stroke-purple-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-purple-search)" />
                    <text x={730} y={348} textAnchor="middle" className="text-sm fill-purple-700 dark:fill-purple-300 font-sans font-medium">POST /v3/search</text>
                    <text x={730} y={378} textAnchor="middle" className="text-[13px] fill-gray-500 dark:fill-gray-400 italic">Semantic search with reranking</text>
                </g>

                {/* 6. Return memories */}
                <g>
                    <line x1={955} y1={415} x2={515} y2={415} className="stroke-green-600 dark:stroke-green-400" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrow-open-green-search)" />
                    <text x={735} y={403} textAnchor="middle" className="text-sm fill-green-700 dark:fill-green-300 font-sans">{`{ results: [memories...] }`}</text>
                    <rect x={530} y={425} width={230} height={45} rx={4} className="fill-green-50 stroke-green-200 dark:fill-green-900/20 dark:stroke-green-800" strokeWidth={1} />
                    <text x={645} y={445} textAnchor="middle" className="text-[12px] fill-green-700 dark:fill-green-400 font-mono">[Memory 1] (85% relevant)</text>
                    <text x={645} y={462} textAnchor="middle" className="text-[12px] fill-green-700 dark:fill-green-400 font-mono">User prefers casual tone...</text>
                </g>

                {/* 7. Send function response to LLM */}
                <g>
                    <line x1={510} y1={500} x2={735} y2={500} className="stroke-gray-600 dark:stroke-gray-400" strokeWidth={1.5} markerEnd="url(#arrow-filled-search)" />
                    <text x={622} y={488} textAnchor="middle" className="text-sm fill-gray-700 dark:fill-gray-300 font-sans">functionResponse + continue</text>
                    <text x={622} y={518} textAnchor="middle" className="text-[13px] fill-gray-500 dark:fill-gray-400 italic">Inject memories into context</text>
                </g>

                {/* 8. Stream to UI */}
                <g>
                    <line x1={510} y1={565} x2={1135} y2={565} className="stroke-green-600 dark:stroke-green-400" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrow-open-green-search)" />
                    <text x={822} y={553} textAnchor="middle" className="text-sm fill-green-700 dark:fill-green-300 font-sans font-medium">SSE: text chunks (personalized response)</text>
                    <text x={822} y={583} textAnchor="middle" className="text-[13px] fill-gray-500 dark:fill-gray-400 italic">Content tailored to user's style</text>
                </g>

                {/* Arrow Definitions */}
                <defs>
                    <marker id="arrow-filled-search" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-gray-600 dark:fill-gray-400" />
                    </marker>
                    <marker id="arrow-filled-blue-search" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-blue-600 dark:fill-blue-400" />
                    </marker>
                    <marker id="arrow-filled-purple-search" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-purple-600 dark:fill-purple-400" />
                    </marker>
                    <marker id="arrow-open-search" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-none stroke-gray-500 dark:stroke-gray-400" strokeWidth="1.5" />
                    </marker>
                    <marker id="arrow-open-green-search" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-none stroke-green-600 dark:stroke-green-400" strokeWidth="1.5" />
                    </marker>
                </defs>
            </svg>
        </div>
    );
}
