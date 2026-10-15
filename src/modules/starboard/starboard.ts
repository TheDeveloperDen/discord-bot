import {
	AttachmentBuilder,
	type ColorResolvable,
	ComponentType,
	type Message,
	type MessageCreateOptions,
	MessageFlags,
	type Snowflake,
} from "discord.js";
import { AntiStarboardMessage } from "../../store/models/AntiStarboardMessage.js";
import { StarboardMessage } from "../../store/models/StarboardMessage.js";
import { convertVideoToGif } from "../../util/video.js";
import type { StarboardContentRenderOptions } from "./starboard.content.js";

export interface StarboardRenderOptions extends StarboardContentRenderOptions {}

export const createStarboardMessage: (
	originalMessageId: Snowflake,
	originalMessageChannelId: Snowflake,
	starboardMessageId: Snowflake,
) => Promise<StarboardMessage> = async (
	originalMessageId,
	originalMessageChannelId,
	starboardMessageId,
) => {
	return await StarboardMessage.create({
		originalMessageId: BigInt(originalMessageId),
		originalMessageChannelId: BigInt(originalMessageChannelId),
		starboardMessageId: BigInt(starboardMessageId),
	});
};

export const getStarboardMessageForOriginalMessageId: (
	originalMessageId: Snowflake,
) => Promise<StarboardMessage | null> = async (originalMessageId) => {
	return await StarboardMessage.findOne({
		where: {
			originalMessageId: BigInt(originalMessageId),
		},
	});
};

export const createAntiStarboardMessage: (
	originalMessageId: Snowflake,
	originalMessageChannelId: Snowflake,
	starboardMessageId: Snowflake,
) => Promise<AntiStarboardMessage> = async (
	originalMessageId,
	originalMessageChannelId,
	starboardMessageId,
) => {
	return await AntiStarboardMessage.create({
		originalMessageId: BigInt(originalMessageId),
		originalMessageChannelId: BigInt(originalMessageChannelId),
		starboardMessageId: BigInt(starboardMessageId),
	});
};

export const getAntiStarboardMessageForOriginalMessageId: (
	originalMessageId: Snowflake,
) => Promise<AntiStarboardMessage | null> = async (originalMessageId) => {
	return await AntiStarboardMessage.findOne({
		where: {
			originalMessageId: BigInt(originalMessageId),
		},
	});
};

export const getColorForStars: (
	stars: number,
	threshold: number,
	baseColor: ColorResolvable,
) => ColorResolvable = (stars, threshold, baseColor) => {
	if (stars === -1) {
		return "DarkButNotBlack";
	}

	const overthreshold = stars - threshold;
	switch (overthreshold) {
		case 2:
			return "Red";
		case 4:
			return "Orange";
		case 6:
			return "Gold";

		default:
			return baseColor;
	}
};
const isEmbedableContentType = (type: string) => {
	const imageFormats = [
		"image/jpeg",
		"image/jpg",
		"image/png",
		"image/gif",
		"image/webp", // Static WebP only, animated WebP not supported
	];
	return imageFormats.includes(type.toLowerCase());
};

export const getImageOrGifEmbed: (message: Message) => Promise<
	| undefined
	| { gifBuffer: Buffer; gifName: string }
	| {
			url: string;
	  }
> = async (message) => {
	const embeds = message.embeds.filter(
		(emb) => emb.data.type === "image" || emb.data.type === "gifv",
	);
	const [embed] = embeds;
	if (embed) {
		if (embed.video) {
			const gifBuffer = await convertVideoToGif(
				embed.video.proxyURL ?? embed.video.url,
			);
			return {
				gifBuffer,
				gifName: "starboard.gif",
			};
		} else if (embed.image) {
			return {
				url: embed.image.proxyURL ?? embed.image.url,
			};
		}
	}

	const attachments = message.attachments.filter(
		(x) => x.contentType && isEmbedableContentType(x.contentType),
	);

	const attachment = attachments.first();
	if (attachment) {
		return {
			url: attachment.proxyURL ?? attachment.url,
		};
	}

	const stickers = message.stickers;
	const sticker = stickers.first();
	if (sticker) {
		return {
			url: sticker.url,
		};
	}

	return undefined;
};

/**
 * A copy of a board post for the mod log. The post's attachments (e.g. a converted GIF) are re-uploaded and its media
 * pointed at the copies, since the post's own attachment links stop working once it's deleted.
 */
export function copyForModLog(post: Message, boardName: string) {
	const notice = `Removed from the ${boardName} because the original message was deleted.`;
	const files = post.attachments.map(
		(attachment) =>
			new AttachmentBuilder(attachment.url, { name: attachment.name }),
	);
	/** `url`, or a reference to the re-uploaded copy if it's one of the post's attachments */
	const local = (url: string) => {
		const attachment = post.attachments.find((a) =>
			new URL(url).pathname.endsWith(`/${a.name}`),
		);
		return attachment ? `attachment://${attachment.name}` : url;
	};

	if (post.flags.has(MessageFlags.IsComponentsV2)) {
		return {
			flags: MessageFlags.IsComponentsV2,
			components: [
				{ type: ComponentType.TextDisplay, content: notice },
				...post.components.map((component) =>
					withLocalMedia(component.toJSON(), local),
				),
			],
			files,
			allowedMentions: { parse: [] },
		} satisfies MessageCreateOptions;
	}
	// posts from before starboard used Components V2
	const embeds = post.embeds.map((embed) => {
		const json = embed.toJSON();
		if (json.image?.url) json.image = { url: local(json.image.url) };
		return json;
	});
	return {
		content: `${notice}\n${post.content}`,
		embeds,
		files,
		allowedMentions: { parse: [] },
	} satisfies MessageCreateOptions;
}

/** A copy of a component's JSON with every media URL (thumbnails, gallery items) passed through `local` */
function withLocalMedia<T>(json: T, local: (url: string) => string): T {
	if (Array.isArray(json)) {
		return json.map((item) => withLocalMedia(item, local)) as T;
	}
	if (json === null || typeof json !== "object") return json;
	return Object.fromEntries(
		Object.entries(json).map(([key, value]) =>
			key === "media" && value && typeof value === "object" && "url" in value
				? [key, { ...value, url: local(String(value.url)) }]
				: [key, withLocalMedia(value, local)],
		),
	) as T;
}
