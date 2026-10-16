import { afterEach, describe, expect, mock, test } from "bun:test";
import type { Message } from "discord.js";
import { config } from "../../Config.js";
import { texts } from "../../tests/render.js";
import { isPastified, pastify, splitMessage } from "./pastify.js";

const lines = (count: number, make: (i: number) => string) =>
	Array.from({ length: count }, (_, i) => make(i)).join("\n");

const codeBlock = (count: number, language = "js") =>
	`\`\`\`${language}\n${lines(count, (i) => `const a${i} = ${i};`)}\n\`\`\``;

describe("splitMessage", () => {
	test("a short message is one text part", () => {
		expect(splitMessage("hello there", 20)).toEqual([{ text: "hello there" }]);
	});

	test("a long code block becomes a content part with its language", () => {
		const parts = splitMessage(codeBlock(25), 20);
		expect(parts).toHaveLength(1);
		expect(parts[0]).toMatchObject({ language: "js" });
		expect(parts[0]).toHaveProperty("content");
	});

	test("long text that looks like code is pasted too", () => {
		const parts = splitMessage(
			lines(25, (i) => `if (a${i} == b) { run(); }`),
			20,
		);
		expect(parts.map((p) => Object.keys(p)[0])).toEqual(["content"]);
	});

	test("long prose is kept as text instead of being dropped", () => {
		const prose = lines(25, (i) => `line ${i} of plain prose`);
		expect(splitMessage(prose, 20)).toEqual([{ text: prose }]);
	});

	test("a long empty code block is kept as text, not pasted", () => {
		const empty = `\`\`\`\n${"\n".repeat(25)}\`\`\``;
		expect(splitMessage(empty, 20)).toEqual([{ text: empty }]);
	});

	test("text around a code block stays as text parts", () => {
		const parts = splitMessage(`hello\n${codeBlock(25)}\nbye`, 20);
		expect(parts.map((p) => Object.keys(p)[0])).toEqual([
			"text",
			"content",
			"text",
		]);
	});

	test("the threshold is the number of lines", () => {
		const block = codeBlock(8);
		expect(splitMessage(block, 20)[0]).toHaveProperty("text");
		expect(splitMessage(block, 5)[0]).toHaveProperty("content");
	});
});

describe("pastify", () => {
	const realFetch = globalThis.fetch;
	afterEach(() => {
		globalThis.fetch = realFetch;
	});

	const fakeMessage = (content: string, id = "1") => {
		const deleteMessage = mock(() => Promise.resolve());
		const message = {
			id,
			content,
			member: null,
			author: {
				id: "42",
				displayName: "Ada",
				displayAvatarURL: () => "https://cdn/ada.png",
			},
			delete: deleteMessage,
		} as unknown as Message;
		return { message, deleteMessage };
	};

	const pasteService = (response: () => Response | Promise<Response>) => {
		const fetchMock = mock(async (..._args: unknown[]) => response());
		globalThis.fetch = fetchMock as unknown as typeof fetch;
		return fetchMock;
	};

	test("replaces code with a paste link, deletes the message and remembers it", async () => {
		const fetchMock = pasteService(
			() => new Response(JSON.stringify({ id: "abc" })),
		);
		const { message, deleteMessage } = fakeMessage(
			codeBlock(25),
			"900000000000000001",
		);

		const card = await pastify(message);

		expect(card).not.toBeNull();
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(deleteMessage).toHaveBeenCalledTimes(1);
		expect(isPastified(900000000000000001n)).toBe(true);
		expect(card).not.toHaveProperty("content");
		expect(card?.allowedMentions).toEqual({ parse: [] });
		expect(texts(card as never).join("\n")).toContain(
			`${config.devbin.url}/paste/abc`,
		);
	});

	test("a message with no code is left alone", async () => {
		const fetchMock = pasteService(() => new Response("{}"));
		const { message, deleteMessage } = fakeMessage("just chatting");

		expect(await pastify(message)).toBeNull();
		expect(deleteMessage).not.toHaveBeenCalled();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test("long prose with no code is left alone, not deleted", async () => {
		pasteService(() => new Response("{}"));
		const { message, deleteMessage } = fakeMessage(
			lines(30, (i) => `line ${i} of plain prose`),
		);

		expect(await pastify(message)).toBeNull();
		expect(deleteMessage).not.toHaveBeenCalled();
	});

	test("an empty message, like just an image, is left alone", async () => {
		const { message, deleteMessage } = fakeMessage("");

		expect(await pastify(message, 10)).toBeNull();
		expect(deleteMessage).not.toHaveBeenCalled();
	});

	test("uses the threshold it's given", async () => {
		pasteService(() => new Response(JSON.stringify({ id: "x" })));
		const { message } = fakeMessage(codeBlock(12));

		expect(await pastify(message)).toBeNull();
		expect(await pastify(message, 10)).not.toBeNull();
	});

	test("keeps the message if the paste service refuses it", async () => {
		pasteService(() => new Response("nope", { status: 500 }));
		const { message, deleteMessage } = fakeMessage(codeBlock(25));

		expect(await pastify(message)).toBeNull();
		expect(deleteMessage).not.toHaveBeenCalled();
	});

	test("keeps the message if the paste service can't be reached", async () => {
		pasteService(() => {
			throw new Error("network down");
		});
		const { message, deleteMessage } = fakeMessage(codeBlock(25));

		expect(await pastify(message)).toBeNull();
		expect(deleteMessage).not.toHaveBeenCalled();
	});

	test("keeps the message if the response has no paste id", async () => {
		pasteService(() => new Response("{}"));
		const { message, deleteMessage } = fakeMessage(codeBlock(25));

		expect(await pastify(message)).toBeNull();
		expect(deleteMessage).not.toHaveBeenCalled();
	});
});
