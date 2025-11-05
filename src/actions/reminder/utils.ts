import * as chrono from 'chrono-node';

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
		const parsedDate = parsed.start.date();

		// Ensure the date is in the future
		if (parsedDate.getTime() > now.getTime()) {
			return parsedDate.getTime();
		}
	}

	// If chrono couldn't parse it, throw an error
	throw new Error(`Unable to parse date/time string: "${dateTimeStr}". Please use formats like "in 5 minutes", "after 1 hour", "tomorrow at 2pm", "next Monday at 9am", etc.`);
}

