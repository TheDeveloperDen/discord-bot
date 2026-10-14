import { describe, expect, test } from "bun:test";
import {
	Collection,
	ComponentType,
	type Message,
	MessageFlags,
} from "discord.js";
import { copyForModLog } from "./starboard.js";

const gifUrl =
	"https://cdn.discordapp.com/attachments/1/2/starboard.gif?ex=abc&is=def&hm=123";
const attachments = new Collection([
	["a", { url: gifUrl, name: "starboard.gif" }],
]);

describe("copyForModLog", () => {
	test("copies a Components V2 post, pointing its media at re-uploaded copies", () => {
		const post = {
			flags: { has: (flag: number) => flag === MessageFlags.IsComponentsV2 },
			components: [
				{
					toJSON: () => ({
						type: ComponentType.Container,
						components: [
							{ type: ComponentType.TextDisplay, content: "look" },
							{
								type: ComponentType.MediaGallery,
								items: [
									{ media: { url: gifUrl } },
									{ media: { url: "https://media.tenor.com/x.png" } },
								],
							},
						],
					}),
				},
			],
			attachments,
		} as unknown as Message;

		const copy = copyForModLog(post, "starboard");

		expect(copy.flags).toBe(MessageFlags.IsComponentsV2);
		const [notice, container] = copy.components as {
			content?: string;
			components?: { items?: { media: { url: string } }[] }[];
		}[];
		expect(notice.content).toContain("Removed from the starboard");
		expect(
			container.components?.[1].items?.map((item) => item.media.url),
		).toEqual(["attachment://starboard.gif", "https://media.tenor.com/x.png"]);
		expect(copy.files.map((file) => file.name)).toEqual(["starboard.gif"]);
		expect(copy.allowedMentions).toEqual({ parse: [] });
	});

	test("copies a post from before Components V2 with its embeds", () => {
		const post = {
			flags: { has: () => false },
			content: "⭐: 5 | https://discord.com/channels/g/c/1",
			embeds: [
				{ toJSON: () => ({ description: "look", image: { url: gifUrl } }) },
			],
			attachments,
		} as unknown as Message;

		const copy = copyForModLog(post, "starboard");

		expect("content" in copy && copy.content).toContain(post.content);
		expect("embeds" in copy && copy.embeds?.[0].image).toEqual({
			url: "attachment://starboard.gif",
		});
	});
});
