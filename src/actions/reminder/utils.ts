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

        // Check if a time is specified
        const timeMatch = str.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
        if (timeMatch) {
            let hours = parseInt(timeMatch[1], 10);
            const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
            const meridiem = timeMatch[3]?.toLowerCase();

            if (meridiem === "pm" && hours < 12) hours += 12;
            if (meridiem === "am" && hours === 12) hours = 0;

            tomorrow.setHours(hours, minutes, 0, 0);
        } else {
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

    // Default: tomorrow at 9 AM
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    return tomorrow.getTime();
}
