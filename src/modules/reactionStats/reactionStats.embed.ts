export const EMBED_FIELD_VALUE_LIMIT = 1024;

export function chunkEmbedFieldValues(
	lines: string[],
	maxLength = EMBED_FIELD_VALUE_LIMIT,
): string[] {
	if (lines.length === 0) return [];

	const chunks: string[] = [];
	let current = "";

	for (const line of lines) {
		const normalizedLine =
			line.length <= maxLength
				? line
				: `${line.slice(0, Math.max(0, maxLength - 3))}...`;

		if (current.length === 0) {
			current = normalizedLine;
			continue;
		}

		const candidate = `${current}\n\n${normalizedLine}`;
		if (candidate.length <= maxLength) {
			current = candidate;
			continue;
		}

		chunks.push(current);
		current = normalizedLine;
	}

	if (current.length > 0) {
		chunks.push(current);
	}

	return chunks;
}
