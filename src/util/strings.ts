export const truncateTo = (str: string, maxLength: number): string => {
	if (str.length <= maxLength) {
		return str;
	}
	return `${str.substring(0, maxLength - 3)}...`;
};

/**
 * The start of `text`, at most `maxLines` lines and `maxLength` characters, ending in "…" if anything was cut.
 */
export function excerpt(
	text: string,
	{
		maxLength,
		maxLines = Number.POSITIVE_INFINITY,
	}: { maxLength: number; maxLines?: number },
): string {
	const lines = text.split("\n");
	let result = lines.slice(0, maxLines).join("\n");
	let cut = lines.length > maxLines;
	// leaves room for the "…" and a closing ```
	if (result.length > maxLength - 5) {
		result = result.slice(0, maxLength - 5);
		cut = true;
	}
	if (!cut) return text;
	result = `${result.trimEnd()}…`;
	// close a code block if necessary
	const openFence = (result.match(/```/g)?.length ?? 0) % 2 === 1;
	return openFence ? `${result}\n\`\`\`` : result;
}
