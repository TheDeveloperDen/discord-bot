import Canvas from "@napi-rs/canvas";
import { profileFont } from "../modules/user/user.js";
export function createCanvasContext(
	width: number,
	height: number,
): Canvas.SKRSContext2D {
	const canvas = Canvas.createCanvas(width, height);
	return canvas.getContext("2d");
}

export async function loadAndDrawImage(
	ctx: Canvas.SKRSContext2D,
	imageUrl: string,
	x: number,
	y: number,
	width: number,
	height: number,
): Promise<void> {
	try {
		const image = await Canvas.loadImage(imageUrl);
		ctx.drawImage(image, x, y, width, height);
	} catch (error) {
		throw new Error(`Failed to load image from ${imageUrl}: ${error}`);
	}
}

export function setFont(
	ctx: Canvas.SKRSContext2D,
	size: number,
	fontFamily: string = profileFont,
): void {
	ctx.font = `bold ${size}px ${fontFamily}`;
}

export function getTextSize(
	ctx: Canvas.SKRSContext2D,
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
