export const xpForLevel = (level: number): bigint =>
	BigInt(Math.floor(level ** 3 + 27 * level ** 2 + 125 * level));

export const getTierByLevel = (level: number): number =>
	level === 0 ? 0 : Math.floor(level / 10) + 1;
