/**
 * Parse natural language date/time string to epoch milliseconds
 */
export function parseDateTimeToEpoch(dateTimeStr: string): number {
    const now = new Date();
    const str = dateTimeStr.toLowerCase().trim();

    // Handle "tomorrow" cases
    if (str.includes("tomorrow")) {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);

		// Check if a time is specified (explicit patterns only):
		// - "at 9", "at 9:30", "9am", "9:30 am", "14:00"
		// Avoid matching stray numbers like "2" in "2 days"
		const timeMatch = str.match(/\b(?:(at)\s*)?(\d{1,2})(?::([0-5]\d))?(?:\s*(am|pm))?\b/i);
		if (timeMatch) {
			const hasAt = !!timeMatch[1];
			let hours = parseInt(timeMatch[2], 10);
			const minutes = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
			const meridiem = timeMatch[4] ? timeMatch[4].toLowerCase() : undefined;

			// Require the time to be explicit: must include either leading "at", a meridiem, or a colon with minutes
			const isExplicit = hasAt || !!meridiem || typeof timeMatch[3] !== "undefined";
			let isValid = isExplicit && minutes >= 0 && minutes <= 59;

			if (isValid) {
				if (meridiem) {
					// 12-hour clock must be 1-12
					if (hours < 1 || hours > 12) {
						isValid = false;
					} else {
						// convert to 24-hour
						if (meridiem === "pm" && hours < 12) hours += 12;
						if (meridiem === "am" && hours === 12) hours = 0;
					}
				} else {
					// 24-hour clock must be 0-23
					if (hours < 0 || hours > 23) {
						isValid = false;
					}
				}
			}

			if (isValid) {
				tomorrow.setHours(hours, minutes, 0, 0);
			} else {
				// Invalid/ambiguous time -> ignore and use default below
				// no-op here, default set after this block
			}
		} 
		if (!timeMatch || (timeMatch && !(!!timeMatch[1] || !!timeMatch[4] || typeof timeMatch[3] !== "undefined"))) {
            // Default to 9:00 AM
            tomorrow.setHours(9, 0, 0, 0);
        }

        return tomorrow.getTime();
    }

	// Handle "in X hours/minutes/days"
	const inMatch = str.match(/in\s+(\d+)\s+(minute|hour|day)s?/i);
	if (inMatch) {
		const amount = parseInt(inMatch[1], 10);
		const unit = inMatch[2].toLowerCase();

		// Validate parsed amount: must be > 0 and within sensible bounds per unit
		// Minutes: <= 60, Hours: <= 720 (30 days), Days: <= 3650 (~10 years)
		if (!Number.isFinite(amount) || amount <= 0) {
			const tomorrowDefault = new Date(now);
			tomorrowDefault.setDate(tomorrowDefault.getDate() + 1);
			tomorrowDefault.setHours(9, 0, 0, 0);
			return tomorrowDefault.getTime();
		}
		const upperBounds: Record<string, number> = { minute: 60, hour: 720, day: 3650 };
		const maxForUnit = upperBounds[unit];
		if (typeof maxForUnit === "number" && amount > maxForUnit) {
			const tomorrowDefault = new Date(now);
			tomorrowDefault.setDate(tomorrowDefault.getDate() + 1);
			tomorrowDefault.setHours(9, 0, 0, 0);
			return tomorrowDefault.getTime();
		}

		const future = new Date(now);

        switch (unit) {
            case "minute":
                future.setMinutes(future.getMinutes() + amount);
                break;
            case "hour":
                future.setHours(future.getHours() + amount);
                break;
            case "day":
                future.setDate(future.getDate() + amount);
                break;
        }

        return future.getTime();
    }

    // Handle "next Monday/Tuesday/etc"
    const dayNames = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
    ];
    const nextDayMatch = str.match(/next\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i);
    if (nextDayMatch) {
        const targetDay = dayNames.indexOf(nextDayMatch[1].toLowerCase());
        const currentDay = now.getDay();
        let daysToAdd = targetDay - currentDay;
        if (daysToAdd <= 0) daysToAdd += 7;

        const nextDate = new Date(now);
        nextDate.setDate(nextDate.getDate() + daysToAdd);
        nextDate.setHours(9, 0, 0, 0); // Default to 9 AM

        return nextDate.getTime();
    }

    // Try to parse as a date string
    try {
        const parsed = new Date(dateTimeStr);
        if (!isNaN(parsed.getTime()) && parsed.getTime() > now.getTime()) {
            return parsed.getTime();
        }
    } catch (e) {
        // Fall through
    }

    // If we reach here, parsing failed; do not silently default
    throw new Error(`Unable to parse date/time string: ${dateTimeStr}`);
}
