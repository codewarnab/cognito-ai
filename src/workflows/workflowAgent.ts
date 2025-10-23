/**
 * Workflow Agent Execution Engine
 * 
 * Executes specialized workflow agents with:
 * - Custom system prompts tailored to workflow objectives
 * - Limited/configured subset of tools
 * - Autonomous multi-step execution
 * - Structured output format
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { WorkflowDefinition, WorkflowResult } from './types';
import { createLogger } from '../logger';
import { getAllTools } from '../ai/toolRegistryUtils';
import { convertAllTools } from '../ai/geminiLive/toolConverter';

const log = createLogger('Workflow-Agent');

// Initialize Google AI
const apiKey = "AIzaSyAdqyd9kSD_12B_WQ4Fm-Qk6IcL-6p5wjE";
const genAI = new GoogleGenerativeAI(apiKey);

/**
 * Filter tools based on workflow's allowed tools list
 */
function getFilteredTools(workflow: WorkflowDefinition): Record<string, any> {
    const allTools = getAllTools();
    const allowedToolNames = workflow.allowedTools;

    const filtered = Object.fromEntries(
        Object.entries(allTools).filter(([name]) => allowedToolNames.includes(name))
    );

    log.info('🔧 Filtered tools for workflow', {
        workflowId: workflow.id,
        totalTools: Object.keys(allTools).length,
        allowedTools: allowedToolNames.length,
        filteredTools: Object.keys(filtered).length,
        tools: Object.keys(filtered)
    });

    return filtered;
}

/**
 * Execute a workflow with custom prompt and limited tools
 */
export async function executeWorkflow(
    workflow: WorkflowDefinition,
    userQuery: string
): Promise<WorkflowResult> {
    const startTime = Date.now();

    log.info('🚀 Starting workflow execution', {
        workflowId: workflow.id,
        workflowName: workflow.name,
        query: userQuery
    });

    try {
        // Get filtered tools for this workflow
        const availableTools = getFilteredTools(workflow);

        if (Object.keys(availableTools).length === 0) {
            return {
                success: false,
                output: `❌ Error: No tools available for workflow "${workflow.name}". Please check workflow configuration.`
            };
        }

        // Convert tools to Gemini format
        const geminiToolDeclarations = convertAllTools(availableTools);

        log.info('📋 Workflow configuration', {
            toolsCount: geminiToolDeclarations.length,
            systemPromptLength: workflow.systemPrompt.length
        });

        // Create model with workflow's custom system prompt
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            tools: [{ functionDeclarations: geminiToolDeclarations }],
            systemInstruction: workflow.systemPrompt,
        });

        // Start chat session
        const chat = model.startChat({
            history: [],
        });

        // Send user query
        log.info('📤 Sending query to workflow agent', { query: userQuery });
        const result = await chat.sendMessage(userQuery);
        let response = result.response;

        // Track execution metadata
        const metadata = {
            sourcesVisited: [] as string[],
            stepsCompleted: 0
        };

        // Execute function calling loop
        let iterations = 0;
        const maxIterations = 20; // Workflows may need more iterations (e.g., visiting multiple sources)

        log.info('🔄 Starting workflow execution loop', { maxIterations });

        while (iterations < maxIterations) {
            const functionCalls = response.functionCalls();

            if (!functionCalls || functionCalls.length === 0) {
                log.info('✅ Workflow execution complete - no more function calls');
                break;
            }

            iterations++;
            metadata.stepsCompleted = iterations;

            log.info(`🔧 Workflow iteration ${iterations}/${maxIterations}`, {
                functionCallsCount: functionCalls.length,
                functions: functionCalls.map(fc => fc.name)
            });

            // Execute function calls
            const functionResponses = [];

            for (const fc of functionCalls) {
                const toolName = fc.name;
                const toolArgs = fc.args;

                log.info(`🔨 Executing workflow tool: ${toolName}`, { args: toolArgs });

                try {
                    const tool = availableTools[toolName];
                    if (!tool) {
                        throw new Error(`Tool not found: ${toolName}`);
                    }

                    const toolResult = await tool.execute(toolArgs);

                    // Track sources visited (URLs from navigation tools)
                    if (toolName === 'navigateTo' && toolArgs && typeof toolArgs === 'object' && 'url' in toolArgs) {
                        metadata.sourcesVisited.push(String(toolArgs.url));
                    }

                    log.info(`✅ Workflow tool ${toolName} completed`, {
                        resultType: typeof toolResult,
                        resultLength: JSON.stringify(toolResult).length
                    });

                    functionResponses.push({
                        name: toolName,
                        response: toolResult,
                    });
                } catch (error) {
                    log.error(`❌ Workflow tool ${toolName} failed`, {
                        error: error instanceof Error ? error.message : String(error)
                    });

                    functionResponses.push({
                        name: toolName,
                        response: {
                            error: error instanceof Error ? error.message : String(error),
                        },
                    });
                }
            }

            // Send function responses back to model
            log.info('📨 Sending function responses back to model', {
                responsesCount: functionResponses.length
            });

            const nextResult = await chat.sendMessage(functionResponses);
            response = nextResult.response;
        }

        if (iterations >= maxIterations) {
            log.warn('⚠️ Workflow reached max iterations', { maxIterations });
        }

        // Get final output
        const output = response.text();
        const timeElapsed = Date.now() - startTime;

        log.info('✅ Workflow execution completed', {
            workflowId: workflow.id,
            success: true,
            outputLength: output.length,
            timeElapsed,
            stepsCompleted: metadata.stepsCompleted,
            sourcesVisited: metadata.sourcesVisited.length
        });

        return {
            success: true,
            output,
            metadata: {
                ...metadata,
                timeElapsed
            }
        };

    } catch (error) {
        const timeElapsed = Date.now() - startTime;

        log.error('❌ Workflow execution failed', {
            workflowId: workflow.id,
            error: error instanceof Error ? error.message : String(error),
            timeElapsed
        });

        return {
            success: false,
            output: `❌ Error executing workflow: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}
