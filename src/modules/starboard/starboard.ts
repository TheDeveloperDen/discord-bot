import {
	AttachmentBuilder,
	type ColorResolvable,
	type EmbedBuilder,
	type GuildMember,
	type Message,
	type Snowflake,
} from "discord.js";
import { config } from "../../Config.js";
import { StarboardMessage } from "../../store/models/StarboardMessage.js";
import { createStandardEmbed } from "../../util/embeds.js";
import { convertVideoToGif } from "../../util/video.js";

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

const getColorForStars: (stars: number) => ColorResolvable = (
	stars: number,
) => {
	if (stars === -1) {
		return "DarkButNotBlack";
	}

	const overthreshold = stars - config.starboard.threshold;
	switch (overthreshold) {
		case 2:
			return "Red";
		case 4:
			return "Orange";
		case 6:
			return "Gold";

		default:
			return "Blue";
	}
};
export const extractEmbedAndFilesFromMessage: (
	message: Message,
	member: GuildMember,
	stars: number,
) => Promise<{
	embed: EmbedBuilder;
	files?: AttachmentBuilder[];
}> = async (message: Message, member: GuildMember, stars: number) => {
	const embed = createStandardEmbed(member)
		.setColor(getColorForStars(stars))
		.setAuthor({
			name: member.displayName,
			iconURL: member.user.displayAvatarURL(),
			url: `https://discord.com/users/${member.id}`,
		})
		.setURL(message.url)
		.setDescription(message.content.length > 0 ? message.content : null);
	const files: AttachmentBuilder[] = [];
	const imageOrGif = await getImageOrGifEmbed(message);
	if (imageOrGif) {
		if ("gifBuffer" in imageOrGif) {
			files.push(
				new AttachmentBuilder(imageOrGif.gifBuffer, {
					name: imageOrGif.gifName,
				}),
			);
			embed.setImage(`attachment://${imageOrGif.gifName}`);
		} else if (imageOrGif.url) {
			// If we have a regular image URL, use it directly
			embed.setImage(imageOrGif.url);
		}
	}

	return {
		embed: embed,
		files: files.length > 0 ? files : undefined,
	};
};
export const createStarboardMessageFromMessage: (
	message: Message,
	member: GuildMember,
	stars: number,
	starboardMessage?: Message,
) => Promise<{
	embeds: EmbedBuilder[];
	content: string;
	files?: AttachmentBuilder[];
}> = async (message, member, stars, starboardMessage) => {
	const embeds: EmbedBuilder[] = [];
	const files: AttachmentBuilder[] = [];
	let content: string = `${config.starboard.emojiId}: ${stars} | ${message.url}`;
	if (message.reference) {
		const referencedMessage = await message.fetchReference();

		if (
			referencedMessage.inGuild() &&
			referencedMessage.guildId === message.guildId &&
			referencedMessage.member
		) {
			const { embed: referencedEmbed, files: referencedFiles } =
				await extractEmbedAndFilesFromMessage(
					referencedMessage,
					referencedMessage.member,
					-1,
				);

			referencedEmbed.setAuthor({
				name: `Reply to: ${referencedEmbed.data.author?.name}`,
				iconURL: referencedMessage.member.displayAvatarURL(),
				url: `https://discord.com/channels/${referencedMessage.guildId}/${referencedMessage.channelId}/${referencedMessage.id}`,
			});
			embeds.push(referencedEmbed);
			if (referencedFiles) {
				files.push(...referencedFiles);
			}

			content += ` | Replied to ${referencedMessage.url} by ${referencedMessage.member.displayName}`;
		}
	}
	const { embed, files: mainmessageFiles } =
		await extractEmbedAndFilesFromMessage(message, member, stars);
	embeds.push(embed);
	if (mainmessageFiles) {
		files.push(...mainmessageFiles);
	}

	return {
		embeds: embeds,
		content: content,
		files: files.length > 0 ? files : undefined,
	};
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
	console.log(embeds);
	if (embeds.length > 0) {
		const embed = embeds[0];

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
