import { describe, expect, it } from "bun:test";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { drawText } from "./textRendering.js";

GlobalFonts.registerFromPath("CascadiaCode.ttf", "Cascadia Code");

const options = {
	fontFamily: "Cascadia Code",
	hAlign: "center",
	vAlign: "center",
	maxSize: 100,
	minSize: 1,
	granularity: 3,
};

function render(text: string) {
	const canvas = createCanvas(300, 150);
	const ctx = canvas.getContext("2d");
	ctx.fillStyle = "#ffffff";
	drawText(ctx, text, { x: 0, y: 0, width: 300, height: 150 }, options);
	return ctx.getImageData(0, 0, 300, 150).data;
}

const hasInk = (data: Uint8ClampedArray) => data.some((v) => v !== 0);

describe("drawText", () => {
	it("draws multi-character text", () => {
		expect(hasInk(render("1,234 XP"))).toBe(true);
	});

	it("shrinks text that does not fit at max size", () => {
		const data = render("987,654,321,987,654,321 XP");
		expect(hasInk(data)).toBe(true);
		// text must stay inside the rectangle: first and last columns stay empty
		for (let y = 0; y < 150; y++) {
			expect(data[(y * 300 + 0) * 4 + 3]).toBe(0);
			expect(data[(y * 300 + 299) * 4 + 3]).toBe(0);
		}
	});

	it("rejects an invalid size range", () => {
		const ctx = createCanvas(10, 10).getContext("2d");
		expect(() =>
			drawText(
				ctx,
				"x",
				{ x: 0, y: 0, width: 10, height: 10 },
				{ ...options, minSize: 10, maxSize: 1 },
			),
		).toThrow();
	});
});
