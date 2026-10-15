/** A streak resets once this long has passed since the last claim */
export const STREAK_LAPSES_AFTER_MS = 1000 * 60 * 60 * 24 * 2;

export function formatDayCount(count: number) {
	if (count === 1) {
		return "1 day";
	}
	return `${count} days`;
}
