import { describe, expect, test } from "bun:test";
import { Collection, type Message } from "discord.js";
import { copyForModLog } from "./starboard.js";

describe("copyForModLog", () => {
	test("re-uploads the post's attachments and points its embeds at the copies", () => {
		const gifUrl =
			"https://cdn.discordapp.com/attachments/1/2/starboard.gif?ex=abc&is=def&hm=123";
		const post = {
			content: "⭐: 5 | https://discord.com/channels/g/c/1",
			embeds: [
				{
					toJSON: () => ({ description: "look", image: { url: gifUrl } }),
				},
				{
					toJSON: () => ({ image: { url: "https://media.tenor.com/x.png" } }),
				},
			],
			attachments: new Collection([
				["a", { url: gifUrl, name: "starboard.gif" }],
			]),
		} as unknown as Message;

		const copy = copyForModLog(post, "starboard");

		expect(copy.content).toContain(post.content);
		expect(copy.embeds[0].image).toEqual({ url: "attachment://starboard.gif" });
		// an image that isn't one of the post's attachments keeps its own link
		expect(copy.embeds[1].image).toEqual({
			url: "https://media.tenor.com/x.png",
		});
		expect(copy.files.map((file) => file.name)).toEqual(["starboard.gif"]);
		expect(copy.allowedMentions).toEqual({ parse: [] });
	});
});
