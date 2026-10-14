export type Clue = {
	cell: number;
	size: number;
};

export type Puzzle = {
	id: string;
	size: number;
	clues: Clue[];
};

export type Block = {
	clue: number;
	cells: number[];
};

export type PlacementResult =
	| { ok: true; block: Block }
	| { ok: false; reason: string };

const MIN_REGION_SIZE = 2;
const MAX_REGION_SIZE = 8;
const GENERATION_ATTEMPTS = 48;
const MAX_EXTRA_MERGES = 7;

type Region = {
	cells: number[];
};

type RegionPair = {
	first: number;
	second: number;
};

type ExistingBlocksResult =
	| { ok: true; blocks: Block[] }
	| { ok: false; reason: string };

const fail = (reason: string): PlacementResult => ({ ok: false, reason });

const toSeed = (seed: string): number => {
	let value = 2_166_136_261;
	for (let index = 0; index < seed.length; index += 1) {
		value ^= seed.charCodeAt(index);
		value = Math.imul(value, 16_777_619);
	}
	return value >>> 0;
};

const createRandom = (seed: string): (() => number) => {
	let state = toSeed(seed);
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let value = state;
		value = Math.imul(value ^ (value >>> 15), value | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
	};
};

const randomItem = <Value>(
	items: readonly Value[],
	random: () => number,
): Value => {
	return items[Math.floor(random() * items.length)];
};

const isBoardCell = (size: number, cell: unknown): cell is number => {
	return (
		typeof cell === "number" &&
		Number.isInteger(cell) &&
		cell >= 0 &&
		cell < size * size
	);
};

const areNeighbors = (size: number, first: number, second: number): boolean => {
	const firstRow = Math.floor(first / size);
	const secondRow = Math.floor(second / size);
	if (firstRow === secondRow) return Math.abs(first - second) === 1;
	return Math.abs(first - second) === size;
};

const areConnected = (size: number, cells: readonly number[]): boolean => {
	if (cells.length === 0) return false;

	const selected = new Set(cells);
	const visited = new Set<number>();
	const pending = [cells[0]];

	while (pending.length > 0) {
		const cell = pending.pop();
		if (cell === undefined) continue;
		if (visited.has(cell)) continue;
		visited.add(cell);

		const row = Math.floor(cell / size);
		const column = cell % size;
		const neighbors = [
			row > 0 ? cell - size : -1,
			row < size - 1 ? cell + size : -1,
			column > 0 ? cell - 1 : -1,
			column < size - 1 ? cell + 1 : -1,
		];
		for (const neighbor of neighbors) {
			if (selected.has(neighbor) && !visited.has(neighbor))
				pending.push(neighbor);
		}
	}

	return visited.size === cells.length;
};

const regionsTouch = (size: number, first: Region, second: Region): boolean => {
	for (const firstCell of first.cells) {
		for (const secondCell of second.cells) {
			if (areNeighbors(size, firstCell, secondCell)) return true;
		}
	}
	return false;
};

const availableMerges = (
	size: number,
	regions: readonly Region[],
): RegionPair[] => {
	const pairs: RegionPair[] = [];
	for (let first = 0; first < regions.length; first += 1) {
		for (let second = first + 1; second < regions.length; second += 1) {
			const firstRegion = regions[first];
			const secondRegion = regions[second];
			if (
				firstRegion.cells.length + secondRegion.cells.length <=
					MAX_REGION_SIZE &&
				regionsTouch(size, firstRegion, secondRegion)
			) {
				pairs.push({ first, second });
			}
		}
	}
	return pairs;
};

const mergeRegions = (regions: Region[], pair: RegionPair): void => {
	const merged: Region = {
		cells: [...regions[pair.first].cells, ...regions[pair.second].cells],
	};
	regions.splice(pair.second, 1);
	regions[pair.first] = merged;
};

const isIrregular = (size: number, cells: readonly number[]): boolean => {
	let minimumRow = size;
	let maximumRow = 0;
	let minimumColumn = size;
	let maximumColumn = 0;
	for (const cell of cells) {
		const row = Math.floor(cell / size);
		const column = cell % size;
		minimumRow = Math.min(minimumRow, row);
		maximumRow = Math.max(maximumRow, row);
		minimumColumn = Math.min(minimumColumn, column);
		maximumColumn = Math.max(maximumColumn, column);
	}

	const height = maximumRow - minimumRow + 1;
	const width = maximumColumn - minimumColumn + 1;
	return height > 1 && width > 1 && height * width !== cells.length;
};

const createRandomRegions = (random: () => number): Region[] | null => {
	const size = 8;
	const regions: Region[] = Array.from({ length: size * size }, (_, cell) => ({
		cells: [cell],
	}));

	while (regions.some((region) => region.cells.length === 1)) {
		const pairs = availableMerges(size, regions);
		if (pairs.length === 0) return null;
		mergeRegions(regions, randomItem(pairs, random));
	}

	const extraMerges = 1 + Math.floor(random() * MAX_EXTRA_MERGES);
	for (let merge = 0; merge < extraMerges; merge += 1) {
		const pairs = availableMerges(size, regions);
		if (pairs.length === 0) break;

		const irregularPairs = pairs.filter((pair) => {
			const cells = [
				...regions[pair.first].cells,
				...regions[pair.second].cells,
			];
			return isIrregular(size, cells);
		});
		const preferredPairs = irregularPairs.length > 0 ? irregularPairs : pairs;
		mergeRegions(regions, randomItem(preferredPairs, random));
	}

	return regions.filter((region) => region.cells.length >= MIN_REGION_SIZE);
};

const createFallbackRegions = (random: () => number): Region[] => {
	const regions: Region[] = [];
	const size = 8;

	for (let top = 0; top < size; top += 2) {
		for (let left = 0; left < size; left += 4) {
			const flipHorizontally = random() < 0.5;
			const flipVertically = random() < 0.5;
			const firstCells = [
				[0, 0],
				[1, 0],
				[0, 1],
			].map(([column, row]) => {
				const transformedColumn = flipHorizontally ? 3 - column : column;
				const transformedRow = flipVertically ? 1 - row : row;
				return (top + transformedRow) * size + left + transformedColumn;
			});
			const firstCellSet = new Set(firstCells);
			const secondCells: number[] = [];
			for (let row = 0; row < 2; row += 1) {
				for (let column = 0; column < 4; column += 1) {
					const cell = (top + row) * size + left + column;
					if (!firstCellSet.has(cell)) secondCells.push(cell);
				}
			}

			regions.push({ cells: firstCells }, { cells: secondCells });
		}
	}

	return regions;
};

const createPuzzle = (
	seed: string,
	regions: readonly Region[],
	random: () => number,
) => {
	const clues = regions.map((region) => ({
		cell: randomItem(region.cells, random),
		size: region.cells.length,
	}));
	const solution = regions.map((region, clue) => ({
		clue,
		cells: [...region.cells],
	}));

	return {
		puzzle: {
			id: `blockcount-${toSeed(seed).toString(36)}`,
			size: 8,
			clues,
		},
		solution,
	};
};

export const generatePuzzle = (
	seed: string,
): { puzzle: Puzzle; solution: Block[] } => {
	const random = createRandom(seed);
	for (let attempt = 0; attempt < GENERATION_ATTEMPTS; attempt += 1) {
		const regions = createRandomRegions(random);
		if (
			regions &&
			regions.filter((region) => isIrregular(8, region.cells)).length >= 2
		) {
			return createPuzzle(seed, regions, random);
		}
	}

	return createPuzzle(seed, createFallbackRegions(random), random);
};

const puzzleError = (puzzle: Puzzle): string | null => {
	if (!puzzle || !Number.isInteger(puzzle.size) || puzzle.size < 1) {
		return "Puzzle data has an invalid board size.";
	}
	if (!Array.isArray(puzzle.clues)) return "Puzzle data has no clue list.";

	const clueCells = new Set<number>();
	for (const clue of puzzle.clues) {
		if (!clue || !isBoardCell(puzzle.size, clue.cell)) {
			return "Puzzle data has a clue outside the board.";
		}
		if (
			!Number.isInteger(clue.size) ||
			clue.size < MIN_REGION_SIZE ||
			clue.size > MAX_REGION_SIZE
		) {
			return "Puzzle data has an invalid clue size.";
		}
		if (clueCells.has(clue.cell))
			return "Puzzle data has more than one clue in a cell.";
		clueCells.add(clue.cell);
	}

	return null;
};

const validateCandidate = (
	puzzle: Puzzle,
	blocks: readonly Block[],
	cells: readonly number[],
): PlacementResult => {
	if (!Array.isArray(cells) || cells.length === 0)
		return fail("Select at least one cell.");

	const selectedCells = new Set<number>();
	for (const cell of cells) {
		if (typeof cell !== "number" || !Number.isInteger(cell)) {
			return fail("Cells must be whole board positions.");
		}
		if (!isBoardCell(puzzle.size, cell))
			return fail("A selected cell is outside the board.");
		if (selectedCells.has(cell))
			return fail("A cell cannot be selected more than once.");
		selectedCells.add(cell);
	}

	const coveredCells = new Set<number>();
	for (const block of blocks) {
		for (const cell of block.cells) coveredCells.add(cell);
	}
	if (cells.some((cell) => coveredCells.has(cell))) {
		return fail("A selected cell is already covered by another block.");
	}
	if (!areConnected(puzzle.size, cells)) {
		return fail("Selected cells must form one orthogonally connected region.");
	}

	const matchingClues = puzzle.clues
		.map((clue, index) => ({ clue, index }))
		.filter(({ clue }) => selectedCells.has(clue.cell));
	if (matchingClues.length === 0)
		return fail("Select a region containing exactly one clue.");
	if (matchingClues.length > 1)
		return fail("A block must contain exactly one clue.");

	const matchingClue = matchingClues[0];
	if (cells.length !== matchingClue.clue.size) {
		return fail(`This clue must cover ${matchingClue.clue.size} cells.`);
	}

	return {
		ok: true,
		block: {
			clue: matchingClue.index,
			cells: [...cells],
		},
	};
};

const validateExistingBlocks = (
	puzzle: Puzzle,
	blocks: readonly Block[],
): ExistingBlocksResult => {
	if (!Array.isArray(blocks))
		return { ok: false, reason: "Placed block data is invalid." };

	const accepted: Block[] = [];
	for (const block of blocks) {
		if (
			!block ||
			typeof block.clue !== "number" ||
			!Number.isInteger(block.clue) ||
			!Array.isArray(block.cells)
		) {
			return { ok: false, reason: "Placed block data is invalid." };
		}

		const result = validateCandidate(puzzle, accepted, block.cells);
		if (!result.ok) {
			return {
				ok: false,
				reason: `A placed block is invalid: ${result.reason}`,
			};
		}
		if (result.block.clue !== block.clue) {
			return { ok: false, reason: "A placed block references the wrong clue." };
		}
		accepted.push(result.block);
	}

	return { ok: true, blocks: accepted };
};

export const validatePlacement = (
	puzzle: Puzzle,
	blocks: readonly Block[],
	cells: readonly number[],
): PlacementResult => {
	const invalidPuzzleReason = puzzleError(puzzle);
	if (invalidPuzzleReason) return fail(invalidPuzzleReason);

	const existingBlocks = validateExistingBlocks(puzzle, blocks);
	if (!existingBlocks.ok) return fail(existingBlocks.reason);
	return validateCandidate(puzzle, existingBlocks.blocks, cells);
};

export const isSolved = (puzzle: Puzzle, blocks: readonly Block[]): boolean => {
	if (puzzleError(puzzle)) return false;

	const existingBlocks = validateExistingBlocks(puzzle, blocks);
	if (!existingBlocks.ok) return false;

	const coveredCellCount = existingBlocks.blocks.reduce(
		(count, block) => count + block.cells.length,
		0,
	);
	return (
		existingBlocks.blocks.length === puzzle.clues.length &&
		coveredCellCount === puzzle.size * puzzle.size
	);
};
