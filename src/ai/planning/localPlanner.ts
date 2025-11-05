/**
 * Local AI Planner Service
 * Uses Chrome's built-in Prompt API with structured output (JSON Schema)
 * Generates execution plans with step-by-step tool calls for the main AI to execute
 */

import { createLogger } from '../../logger';

const log = createLogger('LocalPlanner');

// Tools available for planning (excluding preparePlan to avoid recursion)
const PLANNABLE_TOOLS = [
    'navigateTo',
    'switchTabs',
    'getActiveTab',
    'readPageContent',
    'getSearchResults',
    'openSearchResult',
    'saveMemory',
    'listMemories',
    'getMemory',
    'createReminder',
    'cancelReminder',
];

export type ExecutionStep = {
    step: number;
    tool: string;
    parameters: Record<string, any>;
    description: string;
    waitForCompletion: boolean;
};

export type ExecutionPlan = {
    steps: ExecutionStep[];
};

// JSON Schema for plan output format - Simplified for Chrome Prompt API
const PLAN_SCHEMA = {
    type: "object",
    properties: {
        steps: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    step: {
                        type: "number"
                    },
                    tool: {
                        type: "string"
                    },
                    parameters: {
                        type: "object"
                    },
                    description: {
                        type: "string"
                    },
                    waitForCompletion: {
                        type: "boolean"
                    }
                },
                required: ["step", "tool", "parameters", "description", "waitForCompletion"]
            }
        }
    },
    required: ["steps"]
};

/**
 * Check if Chrome's AI API is available
 */
async function isLocalAIAvailable(): Promise<boolean> {
    try {
        // @ts-ignore - Chrome LanguageModel API
        if (!window.LanguageModel) {
            log.warn('Chrome LanguageModel API not available');
            return false;
        }

        // @ts-ignore
        const availability = await window.LanguageModel.availability();
        const isAvailable = availability === 'available' || availability === 'downloaded' || availability === undefined;

        return isAvailable;
    } catch (error) {
        log.warn('Local AI not available:', error);
        return false;
    }
}

/**
 * Create a new AI session specifically for planning
 */
async function createPlannerSession() {
    try {
        log.info('Creating planner AI session...');

        // @ts-ignore - Chrome LanguageModel API
        const session = await window.LanguageModel.create({
            temperature: 0.3, // Low temperature for more deterministic planning
            topK: 20,
            systemInstruction: `You are an AI planner that generates step-by-step execution plans.
Analyze the user's query and available tools, then create a structured plan.
Return ONLY valid JSON matching the required schema.`,
        });

        log.info('Planner AI session created successfully');
        return session;
    } catch (error) {
        log.error('Failed to create planner AI session:', error);
        return null;
    }
}

/**
 * Build tool documentation for the planner
 * Hardcoded descriptions to avoid dependency on tool registry and prevent recursion
 */
function buildToolDocumentation(): string {
    return `AVAILABLE TOOLS:

navigateTo:
  Description: Open URLs in new or current tab
  Parameters:
    - url (required): The URL to navigate to
    - newTab (optional): Whether to open in new tab (default: true)
  Example: navigateTo(url="https://example.com", newTab=true)

switchTabs:
  Description: Switch focus to an already open tab
  Parameters:
    - url (optional): URL pattern to match
    - tabId (optional): Specific tab ID to switch to
  Example: switchTabs(url="github.com")

getActiveTab:
  Description: Get current tab's title, URL, and ID
  Parameters: None
  Example: getActiveTab()

readPageContent:
  Description: Extract and read text content from current page
  Parameters:
    - limit (optional): Maximum characters to read (default: 5000)
  Example: readPageContent(limit=5000)

getSearchResults:
  Description: Parse current Google/Bing search results page
  Parameters:
    - maxResults (optional): Maximum number of results to return (default: 10)
  IMPORTANT: ONLY call this AFTER navigating to Google search page!
  Example: getSearchResults(maxResults=10)

openSearchResult:
  Description: Open a specific search result by its rank number
  Parameters:
    - rank (required): The rank number of the search result (1-indexed)
  Example: openSearchResult(rank=2)

saveMemory:
  Description: Save information to memory after user consent
  Parameters:
    - category (required): "fact" or "behavior"
    - key (required): Memory key (e.g., "user.name")
    - value (required): The value to store
    - source (optional): "user", "task", or "system"
  IMPORTANT: Must ask user permission first!
  Example: saveMemory(category="fact", key="user.name", value="John")

listMemories:
  Description: List all saved memories
  Parameters:
    - category (optional): Filter by category
    - limit (optional): Maximum number of memories to return
  Example: listMemories(category="fact", limit=20)

getMemory:
  Description: Retrieve a specific saved memory
  Parameters:
    - key (required): The memory key to retrieve
  Example: getMemory(key="user.name")

createReminder:
  Description: Set a reminder with specific time
  Parameters:
    - title (required): Reminder title
    - dateTime (required): When to remind (natural language)
    - generatedTitle (required): Generated display title
    - generatedDescription (required): Generated description
  Example: createReminder(title="workout", dateTime="tomorrow at 2pm", generatedTitle="💪 Time to Get Fit!", generatedDescription="Your body will thank you!")

cancelReminder:
  Description: Cancel an existing reminder
  Parameters:
    - identifier (required): The reminder ID to cancel
  Example: cancelReminder(identifier="reminder-id")

`;
}/**
 * Build planning prompt
 */
function buildPlanningPrompt(userQuery: string): string {
    const toolDocs = buildToolDocumentation();

    return `You are an AI planner for a browser assistant. Your job is to create a step-by-step execution plan.

${toolDocs}

PLANNING RULES:
1. Break down the user's request into atomic steps
2. Each step should call exactly ONE tool
3. Steps should be sequential and logical
4. Set waitForCompletion=true for steps that must complete before the next step (e.g., navigation before reading)
5. Set waitForCompletion=false for independent actions
6. Keep plans simple and direct - avoid over-complication
7. MAXIMUM 5 STEPS - Keep plans concise and focused
8. For search queries, follow this workflow:
   - Step 1: navigateTo Google search URL
   - Step 2: getSearchResults (with waitForCompletion=true)
   - Step 3: navigateTo the best result
   - Step 4: readPageContent to get the answer
9. For memory operations, always ask user permission first (mention in description)
10. For reminders, ensure dateTime parameter is specific

USER QUERY:
${userQuery}

Create an execution plan with MAXIMUM 5 steps. Return a JSON object with this exact structure:
{
  "steps": [
    {
      "step": 1,
      "tool": "toolName",
      "parameters": {"param1": "value1"},
      "description": "What this step does",
      "waitForCompletion": true
    }
  ]
}

Important: 
- Only use tools from the list above
- Each step must have all 5 fields: step, tool, parameters, description, waitForCompletion
- parameters must be an object (use {} if no parameters needed)
- Return ONLY the JSON object, no markdown, no explanations`;
}

/**
 * Generate execution plan using local AI with structured output
 */
export async function generateExecutionPlan(
    userQuery: string
): Promise<ExecutionPlan | null> {
    try {
        // Check if local AI is available
        const available = await isLocalAIAvailable();
        if (!available) {
            log.warn('Local AI not available for planning');
            return null;
        }

        // Create a new session specifically for planning
        const session = await createPlannerSession();
        if (!session) {
            log.error('Failed to create planner session');
            return null;
        }

        try {
            // Build prompt
            const prompt = buildPlanningPrompt(userQuery);

            log.info('Generating execution plan for:', userQuery);

            let result: string;

            // Try with responseConstraint (structured output) first
            try {
                // @ts-ignore - Chrome LanguageModel API with structured output
                result = await session.prompt(prompt, {
                    responseConstraint: PLAN_SCHEMA,
                });
                log.info('Used structured output (responseConstraint)');
            } catch (constraintError) {
                // Fallback: Use regular prompt without constraint
                log.warn('responseConstraint not supported, using regular prompt:', constraintError);
                // @ts-ignore
                result = await session.prompt(prompt);
                log.info('Used regular prompt (fallback)');
            }

            // Parse the JSON response
            let parsed: any;
            try {
                // Try to parse as-is
                parsed = JSON.parse(result);
            } catch (parseError) {
                // Try to extract JSON from markdown code blocks
                log.warn('Failed to parse JSON directly, trying to extract from markdown:', parseError);
                const jsonMatch = result.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
                if (jsonMatch) {
                    parsed = JSON.parse(jsonMatch[1]);
                    log.info('Extracted JSON from markdown code block');
                } else {
                    // Try to find JSON object in the response
                    const objectMatch = result.match(/\{[\s\S]*"steps"[\s\S]*\]/);
                    if (objectMatch) {
                        parsed = JSON.parse(objectMatch[0] + '}');
                        log.info('Extracted JSON object from response');
                    } else {
                        log.error('Could not extract valid JSON from response:', result.substring(0, 200));
                        return null;
                    }
                }
            }

            // Validate the plan structure
            if (!parsed?.steps || !Array.isArray(parsed.steps)) {
                log.warn('Invalid plan result - missing steps array:', parsed);
                return null;
            }

            // Validate each step
            const validSteps = parsed.steps.every(
                (s: any) =>
                    typeof s.step === 'number' &&
                    typeof s.tool === 'string' &&
                    PLANNABLE_TOOLS.includes(s.tool) &&
                    typeof s.parameters === 'object' &&
                    typeof s.description === 'string' &&
                    typeof s.waitForCompletion === 'boolean'
            );

            if (!validSteps) {
                log.warn('Plan contains invalid steps:', parsed.steps);
                return null;
            }

            log.info('Generated execution plan successfully:', {
                stepCount: parsed.steps.length
            });

            return parsed as ExecutionPlan;

        } finally {
            // Clean up: destroy the session when done
            try {
                if (session.destroy) {
                    await session.destroy();
                    log.debug('Planner session destroyed');
                }
            } catch (error) {
                log.warn('Failed to destroy planner session:', error);
            }
        }

    } catch (error) {
        log.error('Failed to generate execution plan:', error);
        return null;
    }
}

// TypeScript declarations for Chrome LanguageModel API
declare global {
    interface Window {
        LanguageModel?: {
            availability: () => Promise<'available' | 'readily' | 'downloading' | 'no' | 'downloaded' | undefined>
            create: (options?: {
                topK?: number
                temperature?: number
                signal?: AbortSignal
                systemInstruction?: string
            }) => Promise<{
                prompt: (text: string, options?: {
                    signal?: AbortSignal
                    responseConstraint?: any
                }) => Promise<string>
                promptStreaming: (text: string, options?: { signal?: AbortSignal }) => ReadableStream<string>
                destroy: () => void
            }>
        }
    }
}
