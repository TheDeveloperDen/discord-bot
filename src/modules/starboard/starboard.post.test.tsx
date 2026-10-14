import { describe, expect, mock, test } from "bun:test";
import {
	ButtonStyle,
	Collection,
	ComponentType,
	type GuildMember,
	type Message,
	MessageFlags,
} from "discord.js";

mock.module("../../util/video.js", () => ({
	convertVideoToGif: async () => Buffer.from("gif"),
}));
const { config } = await import("../../Config.js");
const { renderStarboardPost } = await import("./starboard.post.js");

const member = (id: string, name: string) =>
	({
		id,
		displayName: name,
		displayAvatarURL: () => `https://cdn/${id}.png`,
	}) as unknown as GuildMember;

const fakeMessage = (fields: {
	id: string;
	content: string;
	embeds?: unknown[];
	attachments?: unknown[];
	replyTo?: Message;
	author?: GuildMember;
}) =>
	({
		id: fields.id,
		url: `https://discord.com/channels/g/c/${fields.id}`,
		content: fields.content,
		createdTimestamp: 1_700_000_000_000,
		editedTimestamp: null,
		embeds: fields.embeds ?? [],
		attachments: new Collection(
			(fields.attachments ?? []).map((a, i) => [String(i), a]),
		),
		stickers: new Collection(),
		reactions: { cache: { find: () => undefined } },
		reference: fields.replyTo ? {} : null,
		fetchReference: async () => fields.replyTo,
		inGuild: () => true,
		guildId: "g",
		member: fields.author,
	}) as unknown as Message<true>;

const settings = {
	emojiId: config.starboard.emojiId,
	threshold: config.starboard.threshold,
	color: config.starboard.color,
};

type Node = {
	type: number;
	content?: string;
	url?: string;
	style?: number;
	items?: { media: { url: string } }[];
	components?: Node[];
};

describe("renderStarboardPost", () => {
	test("renders a Components V2 card with the reply, text, media and a jump link", async () => {
		const reply = fakeMessage({
			id: "1",
			content: "which language?",
			author: member("20", "Bob"),
			embeds: [
				{
					data: { type: "gifv" },
					video: { url: "https://media.tenor.com/v.mp4", proxyURL: null },
				},
			],
		});
		const message = fakeMessage({
			id: "2",
			content: "rust, obviously",
			replyTo: reply,
			attachments: [
				{
					contentType: "image/png",
					proxyURL: "https://p/a.png",
					url: "https://a.png",
				},
			],
		});

		const post = await renderStarboardPost(
			message,
			member("10", "Alice"),
			5,
			settings,
		);

		expect(post.flags).toBe(MessageFlags.IsComponentsV2);
		const [card, row] = post.components as Node[];
		expect(card.type).toBe(ComponentType.Container);
		// the score is the heading; the reply and the text sit beside the author's avatar
		expect(card.components?.[0].content).toBe(
			`## ${config.starboard.emojiId} 5`,
		);
		const header = card.components?.[1];
		expect(header?.type).toBe(ComponentType.Section);
		expect(header?.components?.map((text) => text.content)).toEqual([
			"<@10>",
			"Replying to **<@20>**\n> which language?",
			"rust, obviously",
		]);
		// the image links to the original; the reply's video is uploaded as a GIF under its own name
		const gallery = card.components?.find(
			(c) => c.type === ComponentType.MediaGallery,
		);
		expect(gallery?.items?.map((item) => item.media.url)).toEqual([
			"https://p/a.png",
			"attachment://starboard-reply.gif",
		]);
		expect(post.files?.map((file) => file.name)).toEqual([
			"starboard-reply.gif",
		]);
		expect(row.components?.[0]).toMatchObject({
			style: ButtonStyle.Link,
			url: message.url,
		});
	});

	test("keeps the text within Discord's limit", async () => {
		const message = fakeMessage({ id: "3", content: "a".repeat(5000) });

		const post = await renderStarboardPost(
			message,
			member("10", "Alice"),
			5,
			settings,
		);

		const [card] = post.components as Node[];
		const total = card.components
			?.map(
				(c) =>
					c.content ?? c.components?.map((n) => n.content ?? "").join("") ?? "",
			)
			.join("").length;
		expect(total).toBeLessThanOrEqual(4000);
		expect(post.files).toBeUndefined();
	});
});
