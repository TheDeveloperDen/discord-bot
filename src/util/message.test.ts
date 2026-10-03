import { expect, test } from "bun:test";
import { Collection, type Message, type TextBasedChannel } from "discord.js";
import { fetchAllMessages } from "./message.js";

test("rejects instead of returning a partial message history", async () => {
	let fetchCount = 0;
	const firstPage = new Collection<string, Message>(
		Array.from({ length: 100 }, (_, index) => {
			const id = String(1000 - index);
			return [id, { id } as Message];
		}),
	);
	const channel = {
		messages: {
			fetch: async () => {
				fetchCount += 1;
				if (fetchCount === 1) return firstPage;
				throw new Error("history page unavailable");
			},
		},
	} as unknown as TextBasedChannel;

	await expect(fetchAllMessages(channel, -1, 0)).rejects.toThrow(
		"history page unavailable",
	);
	expect(fetchCount).toBe(2);
});
