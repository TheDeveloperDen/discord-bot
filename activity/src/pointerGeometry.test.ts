import { describe, expect, test } from "bun:test";
import { getCellsCrossedByGridSegment } from "./pointerGeometry.js";

describe("getCellsCrossedByGridSegment", () => {
	test("includes cells crossed by a single coalesced horizontal segment", () => {
		expect(getCellsCrossedByGridSegment(0.5, 0.5, 2.5, 0.5, 8)).toEqual([
			0, 1, 2,
		]);
	});

	test("resolves diagonal corner crossings through a deterministic connected path", () => {
		expect(getCellsCrossedByGridSegment(0.5, 0.5, 1.5, 1.5, 8)).toEqual([
			0, 1, 9,
		]);
	});

	test("stops at exact mixed-direction endpoint boundaries", () => {
		expect(getCellsCrossedByGridSegment(0.5, 1.5, 1, 1, 8)).toEqual([8, 9]);
		expect(getCellsCrossedByGridSegment(1.5, 0.5, 1, 1, 8)).toEqual([1, 9]);
	});

	test("traverses vertical segments and exact positive and negative endpoints", () => {
		expect(getCellsCrossedByGridSegment(2.5, 0.5, 2.5, 2.5, 8)).toEqual([
			2, 10, 18,
		]);
		expect(getCellsCrossedByGridSegment(2.5, 2.5, 2.5, 1, 8)).toEqual([18, 10]);
		expect(getCellsCrossedByGridSegment(0.5, 0.5, 1, 0.5, 8)).toEqual([0, 1]);
		expect(getCellsCrossedByGridSegment(2.5, 0.5, 1, 0.5, 8)).toEqual([2, 1]);
	});

	test("keeps a retraced branch path connected", () => {
		expect(getCellsCrossedByGridSegment(2.5, 1.5, 0.5, 1.5, 8)).toEqual([
			10, 9, 8,
		]);
	});
});
