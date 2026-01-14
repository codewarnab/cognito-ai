export function ServerToolsSequence() {
    return (
        <div className="not-prose my-6">
            <svg viewBox="0 0 1150 780" className="w-full max-w-5xl">
                {/* Participants - ~200px spacing between centers */}
                <g className="fill-white dark:fill-gray-800 stroke-gray-300 dark:stroke-gray-600">
                    <rect x={40} y={10} width={130} height={44} rx={6} strokeWidth={1.5} />
                    <rect x={235} y={10} width={130} height={44} rx={6} strokeWidth={1.5} />
                    <rect x={430} y={10} width={130} height={44} rx={6} strokeWidth={1.5} />
                    <rect x={625} y={10} width={130} height={44} rx={6} strokeWidth={1.5} />
                    <rect x={820} y={10} width={130} height={44} rx={6} strokeWidth={1.5} />
                </g>

                {/* Participant Labels - text-base (16px) */}
                <g className="fill-gray-800 dark:fill-gray-200 text-base font-bold font-sans">
                    <text x={105} y={38} textAnchor="middle">Extension</text>
                    <text x={300} y={38} textAnchor="middle">Backend</text>
                    <text x={495} y={38} textAnchor="middle">Gemini AI</text>
                    <text x={690} y={38} textAnchor="middle">Tavily/Jina</text>
                    <text x={885} y={38} textAnchor="middle">Browser</text>
                </g>

                {/* Lifelines */}
                <g className="stroke-gray-300 dark:stroke-gray-600" strokeWidth={1.5} strokeDasharray="6 4">
                    <line x1={105} y1={54} x2={105} y2={760} />
                    <line x1={300} y1={54} x2={300} y2={760} />
                    <line x1={495} y1={54} x2={495} y2={760} />
                    <line x1={690} y1={54} x2={690} y2={760} />
                    <line x1={885} y1={54} x2={885} y2={760} />
                </g>

                {/* Step 1: POST request to backend - Y=90 */}
                <line x1={105} y1={90} x2={290} y2={90} 
                      className="stroke-blue-600 dark:stroke-blue-400" 
                      strokeWidth={1.5} 
                      markerEnd="url(#arrow-st-blue)" />
                <text x={197} y={82} textAnchor="middle" 
                      className="text-sm fill-blue-700 dark:fill-blue-300 font-sans font-medium">
                    POST /api/ai/chat-with-tools
                </text>
                <text x={197} y={108} textAnchor="middle" 
                      className="text-[13px] fill-gray-500 dark:fill-gray-400 font-sans italic">
                    messages, toolSchemas, searchEnabled
                </text>

                {/* Note: Request payload - Y=125 */}
                <rect x={110} y={125} width={180} height={55} rx={4} 
                      className="fill-blue-50 stroke-blue-200 dark:fill-blue-900/30 dark:stroke-blue-700" 
                      strokeWidth={1} />
                <text x={200} y={148} textAnchor="middle" 
                      className="text-xs fill-blue-700 dark:fill-blue-300 font-mono">
                    {`{ messages, tools,`}
                </text>
                <text x={200} y={168} textAnchor="middle" 
                      className="text-xs fill-blue-700 dark:fill-blue-300 font-mono">
                    {`  searchEnabled, mode }`}
                </text>

                {/* Step 2: Backend merges tools - Y=210 */}
                <path d="M 300 210 Q 360 210 360 235 Q 360 260 300 260" 
                      className="fill-none stroke-gray-600 dark:stroke-gray-400" 
                      strokeWidth={1.5} 
                      markerEnd="url(#arrow-st-gray)" />
                <text x={375} y={228} 
                      className="text-sm fill-gray-700 dark:fill-gray-300 font-sans font-medium">
                    Merge frontend + server tools
                </text>
                <text x={375} y={250} 
                      className="text-[13px] fill-gray-500 dark:fill-gray-400 font-sans italic">
                    webSearch, retrieve, deepWebSearch
                </text>

                {/* Step 3: Backend calls AI - Y=300 */}
                <line x1={300} y1={300} x2={485} y2={300} 
                      className="stroke-blue-600 dark:stroke-blue-400" 
                      strokeWidth={1.5} 
                      markerEnd="url(#arrow-st-blue)" />
                <text x={392} y={292} textAnchor="middle" 
                      className="text-sm fill-blue-700 dark:fill-blue-300 font-sans font-medium">
                    streamText()
                </text>
                <text x={392} y={318} textAnchor="middle" 
                      className="text-[13px] fill-gray-500 dark:fill-gray-400 font-sans italic">
                    AI decides which tool to use
                </text>

                {/* ALT block for tool execution paths - Y=355 to Y=740 */}
                <rect x={30} y={355} width={1090} height={385} rx={4} 
                      className="fill-amber-50/50 dark:fill-amber-900/10" />
                <rect x={30} y={355} width={55} height={26} rx={0} 
                      className="fill-amber-100 dark:fill-amber-900/40" />
                <text x={42} y={373} className="text-sm font-bold fill-amber-800 dark:fill-amber-200">
                    ALT
                </text>
                <text x={95} y={373} className="text-[13px] fill-amber-700 dark:fill-amber-300 italic font-sans">
                    [tool execution path depends on tool type]
                </text>
                <rect x={30} y={355} width={1090} height={385} rx={4} 
                      className="fill-none stroke-amber-200 dark:stroke-amber-800" strokeWidth={1} />

                {/* Path A: Server tool - Y=400 */}
                <line x1={30} y1={400} x2={1120} y2={400} 
                      className="stroke-amber-300 dark:stroke-amber-700" strokeWidth={1} strokeDasharray="4 2" />
                <text x={50} y={422} className="text-[13px] fill-amber-700 dark:fill-amber-300 font-sans">
                    [Server tool: webSearch, retrieve, deepWebSearch]
                </text>

                {/* Server tool: AI returns tool call - Y=455 */}
                <line x1={495} y1={455} x2={310} y2={455} 
                      className="stroke-gray-500 dark:stroke-gray-400" 
                      strokeWidth={1.5} 
                      strokeDasharray="4 2"
                      markerEnd="url(#arrow-st-open)" />
                <text x={402} y={447} textAnchor="middle" 
                      className="text-sm fill-gray-600 dark:fill-gray-400 font-sans font-medium">
                    tool_call: webSearch
                </text>

                {/* Backend executes server tool - Y=510 */}
                <line x1={300} y1={510} x2={680} y2={510} 
                      className="stroke-blue-600 dark:stroke-blue-400" 
                      strokeWidth={1.5} 
                      markerEnd="url(#arrow-st-blue)" />
                <text x={490} y={502} textAnchor="middle" 
                      className="text-sm fill-blue-700 dark:fill-blue-300 font-sans font-medium">
                    Tavily API / Jina API
                </text>
                <text x={490} y={528} textAnchor="middle" 
                      className="text-[13px] fill-gray-500 dark:fill-gray-400 font-sans italic">
                    Backend executes tool directly
                </text>

                {/* API returns results - Y=565 */}
                <line x1={690} y1={565} x2={310} y2={565} 
                      className="stroke-green-600 dark:stroke-green-400" 
                      strokeWidth={1.5} 
                      strokeDasharray="4 2"
                      markerEnd="url(#arrow-st-open-green)" />
                <text x={500} y={557} textAnchor="middle" 
                      className="text-sm fill-green-600 dark:fill-green-400 font-sans font-medium">
                    Search results
                </text>

                {/* Path B: Frontend tool - Y=605 */}
                <line x1={30} y1={605} x2={1120} y2={605} 
                      className="stroke-amber-300 dark:stroke-amber-700" strokeWidth={1} strokeDasharray="4 2" />
                <text x={50} y={627} className="text-[13px] fill-amber-700 dark:fill-amber-300 font-sans">
                    [Frontend tool: browser, MCP, WebMCP]
                </text>

                {/* SSE to extension - Y=660 */}
                <line x1={300} y1={660} x2={115} y2={660} 
                      className="stroke-amber-600 dark:stroke-amber-400" 
                      strokeWidth={1.5} 
                      strokeDasharray="5 3"
                      markerEnd="url(#arrow-st-amber)" />
                <text x={207} y={652} textAnchor="middle" 
                      className="text-sm fill-amber-700 dark:fill-amber-300 font-sans font-medium">
                    SSE: tool-input-available
                </text>
                <text x={207} y={678} textAnchor="middle" 
                      className="text-[13px] fill-gray-500 dark:fill-gray-400 font-sans italic">
                    Frontend tool needs local execution
                </text>

                {/* Extension executes in browser - Y=715 */}
                <line x1={105} y1={715} x2={875} y2={715} 
                      className="stroke-blue-600 dark:stroke-blue-400" 
                      strokeWidth={1.5} 
                      markerEnd="url(#arrow-st-blue)" />
                <text x={490} y={707} textAnchor="middle" 
                      className="text-sm fill-blue-700 dark:fill-blue-300 font-sans font-medium">
                    Execute tool locally (DOM, screenshot, etc.)
                </text>

                {/* Final response - Y=760 */}
                <line x1={300} y1={760} x2={115} y2={760} 
                      className="stroke-green-600 dark:stroke-green-400" 
                      strokeWidth={1.5} 
                      strokeDasharray="4 2"
                      markerEnd="url(#arrow-st-open-green)" />
                <text x={207} y={752} textAnchor="middle" 
                      className="text-sm fill-green-600 dark:fill-green-400 font-sans font-medium">
                    SSE: text-delta (AI response)
                </text>

                {/* Arrow markers with unique IDs */}
                <defs>
                    <marker id="arrow-st-blue" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-blue-600 dark:fill-blue-400" />
                    </marker>
                    <marker id="arrow-st-gray" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-gray-600 dark:fill-gray-400" />
                    </marker>
                    <marker id="arrow-st-amber" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-amber-600 dark:fill-amber-400" />
                    </marker>
                    <marker id="arrow-st-open" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-none stroke-gray-500 dark:stroke-gray-400" strokeWidth="1.5" />
                    </marker>
                    <marker id="arrow-st-open-green" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L9,3 z" className="fill-none stroke-green-600 dark:stroke-green-400" strokeWidth="1.5" />
                    </marker>
                </defs>
            </svg>
        </div>
    );
}
