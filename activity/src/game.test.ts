import { describe, expect, test } from "bun:test";
import {
	type Block,
	generatePuzzle,
	isSolved,
	type Puzzle,
	validatePlacement,
} from "./game.js";

const areOrthogonallyConnected = (
	size: number,
	cells: readonly number[],
): boolean => {
	if (cells.length === 0) return false;

	const remaining = new Set(cells);
	const visited = new Set<number>();
	const pending = [cells[0]];

	while (pending.length > 0) {
		const cell = pending.pop();
		if (cell === undefined) continue;
		if (visited.has(cell)) continue;
		visited.add(cell);

		const row = Math.floor(cell / size);
		const column = cell % size;
		for (const neighbor of [
			row > 0 ? cell - size : -1,
			row < size - 1 ? cell + size : -1,
			column > 0 ? cell - 1 : -1,
			column < size - 1 ? cell + 1 : -1,
		]) {
			if (remaining.has(neighbor) && !visited.has(neighbor))
				pending.push(neighbor);
		}
	}

	return visited.size === cells.length;
};

const hasIrregularRegion = (
	size: number,
	cells: readonly number[],
): boolean => {
	const rows = cells.map((cell) => Math.floor(cell / size));
	const columns = cells.map((cell) => cell % size);
	const height = Math.max(...rows) - Math.min(...rows) + 1;
	const width = Math.max(...columns) - Math.min(...columns) + 1;
	return height > 1 && width > 1 && height * width !== cells.length;
};

const twoByTwoAlternativePuzzle: Puzzle = {
	id: "alternative-arrangements",
	size: 2,
	clues: [
		{ cell: 0, size: 2 },
		{ cell: 3, size: 2 },
	],
};

describe("generatePuzzle", () => {
	test("is deterministic and creates complete irregular 8x8 puzzles", () => {
		for (const seed of ["lavender", "chrome", "🎨", ""]) {
			const first = generatePuzzle(seed);
			const second = generatePuzzle(seed);

			expect(first).toEqual(second);
			expect(first.puzzle.size).toBe(8);
			expect(first.solution).toHaveLength(first.puzzle.clues.length);
			expect(isSolved(first.puzzle, first.solution)).toBe(true);

			const covered = new Set<number>();
			let irregularRegions = 0;
			for (const block of first.solution) {
				expect(block.cells.length).toBeGreaterThanOrEqual(2);
				expect(block.cells.length).toBeLessThanOrEqual(8);
				expect(areOrthogonallyConnected(first.puzzle.size, block.cells)).toBe(
					true,
				);
				expect(block.cells).toContain(first.puzzle.clues[block.clue].cell);
				expect(
					block.cells.filter((cell) =>
						first.puzzle.clues.some((clue) => clue.cell === cell),
					),
				).toHaveLength(1);
				if (hasIrregularRegion(first.puzzle.size, block.cells))
					irregularRegions += 1;

				for (const cell of block.cells) {
					expect(covered.has(cell)).toBe(false);
					covered.add(cell);
				}
			}

			expect(covered.size).toBe(64);
			expect(irregularRegions).toBeGreaterThan(0);
		}
	});
});

describe("validatePlacement", () => {
	test("accepts alternative valid arrangements", () => {
		const first = validatePlacement(twoByTwoAlternativePuzzle, [], [0, 2]);
		expect(first).toEqual({ ok: true, block: { clue: 0, cells: [0, 2] } });
		if (!first.ok) throw new Error(first.reason);

		const placed = [first.block];
		const second = validatePlacement(twoByTwoAlternativePuzzle, placed, [1, 3]);
		expect(second).toEqual({ ok: true, block: { clue: 1, cells: [1, 3] } });
		if (!second.ok) throw new Error(second.reason);
		expect(isSolved(twoByTwoAlternativePuzzle, [...placed, second.block])).toBe(
			true,
		);
	});

	test("rejects empty, malformed, disconnected, overlapping, and invalid-clue selections", () => {
		const singleCluePuzzle: Puzzle = {
			id: "single-clue",
			size: 3,
			clues: [{ cell: 0, size: 3 }],
		};
		const multipleCluePuzzle: Puzzle = {
			id: "multiple-clues",
			size: 2,
			clues: [
				{ cell: 0, size: 2 },
				{ cell: 1, size: 2 },
			],
		};
		const rowWrapPuzzle: Puzzle = {
			id: "row-wrap",
			size: 8,
			clues: [{ cell: 7, size: 2 }],
		};
		const existing: Block[] = [{ clue: 0, cells: [0, 1] }];

		const cases: Array<{
			puzzle: Puzzle;
			blocks: readonly Block[];
			cells: readonly number[];
		}> = [
			{ puzzle: singleCluePuzzle, blocks: [], cells: [] },
			{ puzzle: singleCluePuzzle, blocks: [], cells: [9] },
			{ puzzle: singleCluePuzzle, blocks: [], cells: [0.5] },
			{ puzzle: singleCluePuzzle, blocks: [], cells: [0, 0] },
			{ puzzle: singleCluePuzzle, blocks: [], cells: [0, 2, 5] },
			{ puzzle: rowWrapPuzzle, blocks: [], cells: [7, 8] },
			{
				puzzle: twoByTwoAlternativePuzzle,
				blocks: existing,
				cells: [0, 2],
			},
			{
				puzzle: twoByTwoAlternativePuzzle,
				blocks: [{ clue: 0, cells: [0, 0] }],
				cells: [2, 3],
			},
			{ puzzle: singleCluePuzzle, blocks: [], cells: [1, 2] },
			{
				puzzle: multipleCluePuzzle,
				blocks: [],
				cells: [0, 1],
			},
			{
				puzzle: singleCluePuzzle,
				blocks: [],
				cells: [0, 1],
			},
		];

		for (const { puzzle, blocks, cells } of cases) {
			expect(validatePlacement(puzzle, blocks, cells).ok).toBe(false);
		}
	});

	test("accepts a branched orthogonally connected region", () => {
		const branchedPuzzle: Puzzle = {
			id: "branched-region",
			size: 3,
			clues: [{ cell: 4, size: 4 }],
		};

		expect(validatePlacement(branchedPuzzle, [], [4, 1, 3, 5])).toEqual({
			ok: true,
			block: { clue: 0, cells: [4, 1, 3, 5] },
		});
	});
});

describe("isSolved", () => {
	test("requires every valid block and exact non-overlapping coverage", () => {
		const valid: Block[] = [
			{ clue: 0, cells: [0, 1] },
			{ clue: 1, cells: [2, 3] },
		];

		expect(isSolved(twoByTwoAlternativePuzzle, valid)).toBe(true);
		expect(isSolved(twoByTwoAlternativePuzzle, [valid[0]])).toBe(false);
		expect(
			isSolved(twoByTwoAlternativePuzzle, [
				valid[0],
				{ clue: 1, cells: [1, 3] },
			]),
		).toBe(false);
		expect(
			isSolved(twoByTwoAlternativePuzzle, [
				{ clue: 1, cells: [0, 1] },
				valid[1],
			]),
		).toBe(false);
		expect(
			isSolved(twoByTwoAlternativePuzzle, [
				{ clue: 0, cells: [0, 0] },
				valid[1],
			]),
		).toBe(false);
	});
});
