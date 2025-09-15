/**
 * Discord timestamp format styles
 */
export enum DiscordTimestampStyle {
	/** Short time format (16:20) */
	SHORT_TIME = "t",
	/** Long time format (16:20:30) */
	LONG_TIME = "T",
	/** Short date format (20/04/2021) */
	SHORT_DATE = "d",
	/** Long date format (20 April 2021) */
	LONG_DATE = "D",
	/** Short date and time format (20 April 2021 16:20) */
	SHORT_DATE_TIME = "f",
	/** Long date and time format (Tuesday, 20 April 2021 16:20) */
	LONG_DATE_TIME = "F",
	/** Relative time format (2 months ago) */
	RELATIVE = "R",
}

/**
 * Formats a Date object into Discord timestamp format
 * @param date The date to format
 * @param style The Discord timestamp style (t, T, d, D, f, F, R)
 * @returns Discord timestamp string
 * @example
 * const shortTime = `<t:${timestamp}:t>`; // 16:20
 * const longTime = `<t:${timestamp}:T>`; // 16:20:30
 * const shortDate = `<t:${timestamp}:d>`; // 20/04/2021
 * const longDate = `<t:${timestamp}:D>`; // 20 April 2021
 * const shortDateTime = `<t:${timestamp}:f>`; // 20 April 2021 16:20
 * const longDateTime = `<t:${timestamp}:F>`; // Tuesday, 20 April 2021 16:20
 * const relative = `<t:${timestamp}:R>`; // 2 months ago
 */
export function formatDiscordTimestamp(
	date: Date,
	style: DiscordTimestampStyle = DiscordTimestampStyle.SHORT_DATE_TIME,
): string {
	const timestamp = Math.floor(date.getTime() / 1000);
	return `<t:${timestamp}:${style}>`;
}
