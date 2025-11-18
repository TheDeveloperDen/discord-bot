import { type CanvasRenderingContext2D, createCanvas, loadImage } from "canvas";
import { logger } from "../logging.js";
import { profileFont } from "../modules/user/user.js";
import { font } from "./imageUtils.js";

export function createCanvasContext(
	width: number,
	height: number,
): CanvasRenderingContext2D {
	const canvas = createCanvas(width, height);
	return canvas.getContext("2d");
}

export async function loadAndDrawImage(
	ctx: CanvasRenderingContext2D,
	imageUrl: string,
	x: number,
	y: number,
	width: number,
	height: number,
): Promise<void> {
	try {
		const image = await loadImage(imageUrl);
		ctx.drawImage(image, x, y, width, height);
	} catch (error) {
		throw new Error(`Failed to load image from ${imageUrl}: ${error}`);
	}
}

export function setFont(
	ctx: CanvasRenderingContext2D,
	size: number,
	fontFamily: string = profileFont,
): void {
	ctx.font = `bold ${size}px ${fontFamily}`;
}

export function getTextSize(
	ctx: CanvasRenderingContext2D,
	text: string,
): {
	width: number;
	height: number;
} {
	const metrics = ctx.measureText(text);
	return {
		width: metrics.width,
		height: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent,
	};
}
