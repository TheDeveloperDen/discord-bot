import { createCanvas, loadImage } from "@napi-rs/canvas";
import { AttachmentBuilder } from "discord.js";
import { logger } from "../../logging.js";

const SIZE = 128;

/** The file name the thumbnail's `attachment://` url points at */
export const EMOJI_FILE = "emoji.png";

/**
 * A copy of the image centred on a transparent square.
 * This is necessary since Discord crops thumbnails to a square and not every emoji is one.
 */
export async function padToSquare(image: Buffer): Promise<Buffer> {
	const source = await loadImage(image);
	const scale = Math.min(SIZE / source.width, SIZE / source.height);
	const width = Math.round(source.width * scale);
	const height = Math.round(source.height * scale);
	const canvas = createCanvas(SIZE, SIZE);
	canvas
		.getContext("2d")
		.drawImage(source, (SIZE - width) / 2, (SIZE - height) / 2, width, height);
	return canvas.toBuffer("image/png");
}

const cache = new Map<string, Buffer | null>();

/** Fetches and pads a custom emoji so `squareEmoji` can return it */
export async function prepareEmoji(id: string): Promise<void> {
	if (cache.has(id)) return;
	try {
		const response = await fetch(
			`https://cdn.discordapp.com/emojis/${id}.png?size=${SIZE}`,
			{ signal: AbortSignal.timeout(5000) },
		);
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		cache.set(id, await padToSquare(Buffer.from(await response.arrayBuffer())));
	} catch (error) {
		logger.warn(`Could not prepare the image of emoji ${id}:`, error);
		cache.set(id, null);
	}
}

/** The padded emoji as an attachment, if `prepareEmoji` got it */
export function squareEmoji(id: string): AttachmentBuilder | null {
	const image = cache.get(id);
	return image ? new AttachmentBuilder(image, { name: EMOJI_FILE }) : null;
}
