import * as chrono from 'chrono-node';
import type { Reminder } from './types';
import { saveReminder } from './storage';
import { createLogger } from '~logger';

const log = createLogger('ReminderUtils', 'UI_REMINDERS_HOOKS');

/**
 * Parse natural language date/time string to epoch milliseconds
 * Uses chrono-node library for robust natural language date parsing
 * Supports: "in 5 minutes", "after 1 min", "tomorrow at 2pm", "next Monday at 9am", etc.
 */
export function parseDateTimeToEpoch(dateTimeStr: string): number {
	const now = new Date();

	// Use chrono-node to parse the natural language date/time
	const parsedResults = chrono.parse(dateTimeStr, now, { forwardDate: true });

	if (parsedResults.length > 0) {
		const parsed = parsedResults[0];
		if (parsed) {
			const parsedDate = parsed.start.date();

			// Ensure the date is in the future
			if (parsedDate.getTime() > now.getTime()) {
				return parsedDate.getTime();
			}
		}
	}

	// If chrono couldn't parse it, throw an error
	throw new Error(`Unable to parse date/time string: "${dateTimeStr}". Please use formats like "in 5 minutes", "after 1 hour", "tomorrow at 2pm", "next Monday at 9am", etc.`);
}

/**
 * Reschedule a Chrome alarm for a reminder
 * Clears the old alarm and creates a new one with the updated time
 */
export async function rescheduleReminder(
	oldReminder: Reminder,
	newWhen: number
): Promise<void> {
	try {
		// Clear old alarm
		await chrome.alarms.clear(`reminder:${oldReminder.id}`);

		// Create new alarm with updated time
		await chrome.alarms.create(`reminder:${oldReminder.id}`, {
			when: newWhen,
		});

		log.info('Rescheduled reminder alarm', {
			id: oldReminder.id,
			oldWhen: oldReminder.when,
			newWhen,
		});
	} catch (error) {
		log.error('Failed to reschedule reminder alarm', { id: oldReminder.id, error });
		throw error;
	}
}

/**
 * Update a reminder with new values and reschedule if time changed
 */
export async function updateReminderWithAlarm(
	id: string,
	existingReminder: Reminder,
	updates: Partial<Omit<Reminder, 'id' | 'createdAt'>>
): Promise<Reminder> {
	try {
		// Check if time changed and reschedule alarm
		if (updates.when && updates.when !== existingReminder.when) {
			await rescheduleReminder(existingReminder, updates.when);
		}

		// Create updated reminder object
		const updatedReminder: Reminder = {
			...existingReminder,
			...updates,
			id: existingReminder.id,
			createdAt: existingReminder.createdAt,
		};

		// Save to storage
		await saveReminder(updatedReminder);

		log.info('Updated reminder', { id, updates });

		return updatedReminder;
	} catch (error) {
		log.error('Failed to update reminder', { id, error });
		throw error;
	}
}

