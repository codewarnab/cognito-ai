import { z } from 'zod';
import { useEffect } from 'react';
import { createLogger } from '~logger';
import { registerTool } from '@ai/tools';
import { useToolUI } from '@ai/tools/components';
import type { ToolUIState } from '@ai/tools/components';
import { CompactToolRenderer } from '@ai/tools/components';
import { parseDateTimeToEpoch } from "./utils";
import { saveReminder } from "./storage";
import type { Reminder } from "./types";

const log = createLogger("Actions-Reminders-Create");

export function useCreateReminderAction() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering createReminder tool...');

        registerTool({
            name: "createReminder",
            description: `Create a browser notification reminder with AI-generated catchy title and motivational description. CRITICAL: Must have SPECIFIC time from user.

WHEN TO USE:
- User wants to be reminded about something at a specific time
- Setting up time-based notifications for tasks, events, or activities
- User says "remind me to X at Y time"

PRECONDITIONS:
- MUST have SPECIFIC time from user (not just "tomorrow" or "today")
- If user says "tomorrow" without time, ASK: "What time would you like the reminder?"
- If user says "next week" without time, ASK: "What day and time?"
- DateTime must be parseable (natural language like "tomorrow at 2pm", "in 2 hours")

WORKFLOW:
1. User requests reminder with specific time
2. Generate catchy title with emoji (max 50 chars)
3. Generate motivational description (max 100 chars)
4. Parse dateTime to epoch timestamp
5. Create reminder and schedule browser alarm
6. Confirm to user with formatted time

TITLE/DESCRIPTION GUIDELINES:
- Use emojis to make it engaging (💪 🎯 ❤️ 🚀 ⏰ 📚 etc.)
- Title: Short, catchy, action-oriented
- Description: Motivational, context-adding, encouraging
- Examples:
  * Workout: "💪 Time to Get Fit!" / "Your body will thank you!"
  * Work: "🎯 Career Boost Time" / "Success is built one step at a time"
  * Personal: "❤️ Connect with Loved Ones" / "The best investment is time with family"

LIMITATIONS:
- Requires specific time (not ambiguous "tomorrow")
- Browser must support notifications and alarms
- Reminder fires even if browser is closed (Chrome alarm API)
- Cannot edit reminders after creation (must cancel and recreate)

EXAMPLE: createReminder(title="workout", dateTime="tomorrow at 6am", generatedTitle="💪 Time to Get Fit!", generatedDescription="Your body will thank you! Let's crush this workout!")`,
            parameters: z.object({
                title: z.string().describe("Short internal task reference (not shown to user). Examples: 'workout', 'apply for job', 'call mom', 'meeting prep'. Used for logging and identification."),
                dateTime: z.string().describe("Natural language date/time WITH SPECIFIC TIME. Valid: 'tomorrow at 2pm', 'next Monday at 9am', 'today at 5pm', 'in 2 hours', 'Dec 25 at 10am'. Invalid: 'tomorrow', 'next week', 'later'. MUST include time component."),
                generatedTitle: z.string().describe("REQUIRED: AI-generated catchy notification title (max 50 chars). Use emoji + action phrase. Examples: '💪 Time to Get Fit!', '🎯 Career Boost Time', '❤️ Connect with Loved Ones', '📚 Learning Time!'. This is the MAIN headline user sees in notification."),
                generatedDescription: z.string().describe("REQUIRED: AI-generated motivational description (max 100 chars). Add context and encouragement. Examples: 'Your body will thank you! Let\\'s crush this workout!', 'Success is built one step at a time. You got this!', 'The best investment is time with family.' This is the notification body text."),
            }),
            execute: async ({ title, dateTime, generatedTitle, generatedDescription }) => {
                try {
                    log.info("TOOL CALL: createReminder", { title, dateTime, generatedTitle, generatedDescription });

                    // Parse the dateTime string to epoch ms
                    const when = parseDateTimeToEpoch(dateTime);

                    // Get current tab URL
                    const [tab] = await chrome.tabs.query({
                        active: true,
                        currentWindow: true,
                    });
                    const url = tab?.url;

                    const id = crypto.randomUUID();
                    const reminder: Reminder = {
                        id,
                        title,
                        when,
                        url,
                        createdAt: Date.now(),
                        generatedTitle: generatedTitle.substring(0, 50),
                        generatedDescription: generatedDescription.substring(0, 100),
                    };

                    // Save reminder
                    await saveReminder(reminder);

                    // Schedule alarm
                    await chrome.alarms.create(`reminder:${id}`, { when });

                    log.info("✅ Reminder created", { id, title, when });

                    return {
                        success: true,
                        id,
                        title: reminder.title,
                        generatedTitle: reminder.generatedTitle,
                        generatedDescription: reminder.generatedDescription,
                        when: new Date(when).toLocaleString(),
                        message: `Reminder set for ${new Date(when).toLocaleString()}`,
                    };
                } catch (error) {
                    log.error('[Tool] Error creating reminder:', error);
                    return {
                        error: "Failed to create reminder",
                        details: error instanceof Error ? error.message : String(error),
                    };
                }
            },
        });

        // Register UI with custom renderers
        registerToolUI('createReminder', (state: ToolUIState) => {
            return <CompactToolRenderer state={state} />;
        }, {
            renderInput: (input: any) => (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    fontSize: '13px',
                    color: 'var(--text-secondary)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', opacity: 0.7 }}>Task:</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-primary)', opacity: 0.9 }}>
                            {input.title}
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', opacity: 0.7 }}>When:</span>
                        <span style={{ fontSize: '11px', padding: '2px 6px', opacity: 0.9 }}>
                            {input.dateTime}
                        </span>
                    </div>
                    {input.generatedTitle && (
                        <div style={{
                            marginTop: '4px',
                            padding: '6px 8px',
                            background: 'var(--bg-tertiary)',
                            borderRadius: '3px',
                            border: '1px solid var(--border-color)',
                            fontSize: '11px'
                        }}>
                            <div style={{ color: 'var(--text-primary)', opacity: 0.9, marginBottom: '2px' }}>
                                {input.generatedTitle}
                            </div>
                            {input.generatedDescription && (
                                <div style={{ fontSize: '10px', opacity: 0.6 }}>
                                    {input.generatedDescription}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ),
            renderOutput: (output: any) => (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    fontSize: '13px',
                    color: 'var(--text-secondary)'
                }}>
                    {output.success && (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '12px', opacity: 0.7 }}>Reminder set for:</span>
                                <span style={{ fontSize: '11px', padding: '2px 6px', opacity: 0.9 }}>
                                    {output.when}
                                </span>
                            </div>
                            <div style={{
                                marginTop: '4px',
                                padding: '6px 8px',
                                background: 'var(--bg-tertiary)',
                                borderRadius: '3px',
                                border: '1px solid var(--border-color)',
                                fontSize: '11px'
                            }}>
                                <div style={{ color: 'var(--text-primary)', opacity: 0.9, marginBottom: '2px' }}>
                                    {output.generatedTitle}
                                </div>
                                {output.generatedDescription && (
                                    <div style={{ fontSize: '10px', opacity: 0.6 }}>
                                        {output.generatedDescription}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                    {output.error && (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '12px', opacity: 0.7, color: 'var(--error-color)' }}>
                                    {output.error}
                                </span>
                            </div>
                            {output.details && (
                                <div style={{
                                    fontSize: '11px',
                                    opacity: 0.6,
                                    padding: '4px 6px',
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: '3px',
                                    border: '1px solid var(--border-color)',
                                    marginTop: '2px'
                                }}>
                                    {output.details}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )
        });

        log.info('✅ createReminder tool registration complete');

        // Cleanup on unmount
        return () => {
            log.info('🧹 Cleaning up createReminder tool');
            unregisterToolUI('createReminder');
        };
    }, []); // Empty dependency array - only register once on mount
}


