import type { SKRSContext2D } from "@napi-rs/canvas";

const measureText = (
	ctx: SKRSContext2D,
	text: string,
	fontFamily: string,
	fontSize: number,
): {
	width: number;
	height: number;
	actualBoundingBoxDescent: number;
} => {
	ctx.font = `${fontSize}px ${fontFamily}`;
	const metrics = ctx.measureText(text);
	return {
		width: metrics.width,
		height:
			Math.abs(metrics.actualBoundingBoxAscent) +
			Math.abs(metrics.actualBoundingBoxDescent),
		actualBoundingBoxDescent: metrics.actualBoundingBoxDescent,
	};
};

interface Rectangle {
	x: number;
	y: number;
	width: number;
	height: number;
}

interface Options {
	fontFamily: string;
	minSize: number;
	maxSize: number;
	hAlign: string;
	vAlign: string;
	granularity: number;
}

export function drawText(
	ctx: SKRSContext2D,
	text: string,
	rectangle: Rectangle,
	options: Options,
): void {
	if (options.minSize > options.maxSize) {
		throw new Error("Min font size can not be larger than max font size");
	}

	ctx.save();

	let fontSize = options.maxSize;
	let textMetrics = measureText(ctx, text, options.fontFamily, fontSize);
	let textWidth = textMetrics.width;
	let textHeight = textMetrics.height;

	while (
		(textWidth > rectangle.width || textHeight > rectangle.height) &&
		fontSize >= options.minSize
	) {
		fontSize = fontSize - options.granularity;
		textMetrics = measureText(ctx, text, options.fontFamily, fontSize);
		textWidth = textMetrics.width;
		textHeight = textMetrics.height;
	}

	// Calculate text coordinates
	let xPos = rectangle.x;
	let yPos =
		rectangle.y +
		rectangle.height -
		Math.abs(textMetrics.actualBoundingBoxDescent);

	switch (options.hAlign) {
		case "right":
			xPos = xPos + rectangle.width - textWidth;
			break;
		case "center":
		case "middle":
			xPos = xPos + rectangle.width / 2 - textWidth / 2;
			break;
		case "left":
			break;
		default:
			throw new Error(`Invalid options.hAlign parameter: ${options.hAlign}`);
	}

	switch (options.vAlign) {
		case "top":
			yPos = yPos - rectangle.height + textHeight;
			break;
		case "center":
		case "middle":
			yPos = yPos + textHeight / 2 - rectangle.height / 2;
			break;
		case "bottom":
		case "baseline":
			break;
		default:
			throw new Error(`Invalid options.vAlign parameter: ${options.vAlign}`);
	}

	// Draw text
	ctx.font = `${fontSize}px ${options.fontFamily}`;
	ctx.textBaseline = "alphabetic";
	ctx.textAlign = "left";
	ctx.fillText(text, xPos, yPos);

	ctx.restore();
}
