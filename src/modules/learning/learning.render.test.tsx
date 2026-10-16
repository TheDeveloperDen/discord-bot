import { afterEach, describe, expect, test } from "bun:test";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { ComponentType } from "discord.js";
import {
	flatten,
	type RenderedComponent,
	renderV2,
	texts,
} from "../../tests/render.js";
import { padToSquare, prepareEmoji, squareEmoji } from "./emojiImage.js";
import { ResourceCard } from "./learning.render.js";
import type { LearningResource } from "./learningResource.model.js";

const client = { emojis: { resolve: () => null, cache: { find: () => null } } };

const cpp: LearningResource = {
	name: "C++",
	description: "A statically typed language",
	emoji: "821822658169536542",
	resources: [
		{
			name: "cppreference.com",
			url: "https://en.cppreference.com/",
			pros: ["Documents the whole standard library"],
			cons: ["Can be overwhelming"],
		},
		{
			name: "Paid course",
			url: "https://example.com/course",
			price: "$20",
			description: "A video course",
			pros: [],
			cons: [],
		},
	],
};

const render = (set: LearningResource, footer?: string) =>
	renderV2(
		<ResourceCard
			client={client as never}
			resourceSet={set}
			resources={set.resources}
			footer={footer}
		/>,
	);

/** Every component, including the accessories that `flatten` doesn't walk */
const withAccessories = (message: ReturnType<typeof render>) =>
	flatten(message).flatMap((c): RenderedComponent[] =>
		c.accessory ? [c, c.accessory] : [c],
	);

const png = (width: number, height: number) => {
	const canvas = createCanvas(width, height);
	const context = canvas.getContext("2d");
	context.fillStyle = "#f00";
	context.fillRect(0, 0, width, height);
	return canvas.toBuffer("image/png");
};

describe("ResourceCard", () => {
	test("each resource has a link button, a price and its pros and cons", () => {
		const message = render(cpp);
		const links = withAccessories(message).filter(
			(c) => c.type === ComponentType.Button,
		) as unknown as { url: string }[];
		expect(links.map((l) => l.url)).toEqual([
			"https://en.cppreference.com/",
			"https://example.com/course",
		]);
		const text = texts(message);
		expect(text).toContain(
			"### cppreference.com\n🏷️ **Free**\n✅ Documents the whole standard library\n⚠️ Can be overwhelming",
		);
		expect(text).toContain("### Paid course\n🏷️ **$20**\nA video course");
	});

	test("empty pros and cons add no blank lines or 'undefined'", () => {
		const text = texts(render(cpp)).join("\n");
		expect(text).not.toContain("undefined");
		expect(text).not.toContain("\n\n\n");
	});

	test("a set with no resources is just the header", () => {
		const message = render({ ...cpp, resources: [] });
		expect(
			withAccessories(message).some((c) => c.type === ComponentType.Button),
		).toBe(false);
		expect(texts(message)).toContain("A statically typed language");
	});

	test("without a prepared image the emoji stays in the title text", () => {
		const message = render({ ...cpp, emoji: "123" });
		expect(
			withAccessories(message).some((c) => c.type === ComponentType.Thumbnail),
		).toBe(false);
	});

	test("shows the footer it's given", () => {
		expect(texts(render(cpp, "Page 2 of 3")).join("\n")).toContain(
			"Page 2 of 3",
		);
	});
});

describe("emoji images", () => {
	const realFetch = globalThis.fetch;
	afterEach(() => {
		globalThis.fetch = realFetch;
	});

	test("padToSquare centres a tall image on a square canvas", async () => {
		const padded = await loadImage(await padToSquare(png(70, 128)));
		expect([padded.width, padded.height]).toEqual([128, 128]);
	});

	test("padToSquare centres a wide image too", async () => {
		const padded = await loadImage(await padToSquare(png(128, 72)));
		expect([padded.width, padded.height]).toEqual([128, 128]);
	});

	test("a prepared emoji becomes the thumbnail, attached as emoji.png", async () => {
		globalThis.fetch = (async () =>
			new Response(png(70, 128))) as unknown as typeof fetch;
		await prepareEmoji("999");
		expect(squareEmoji("999")?.name).toBe("emoji.png");

		const message = render({ ...cpp, emoji: "999" });
		const thumbnail = withAccessories(message).find(
			(c) => c.type === ComponentType.Thumbnail,
		);
		expect(thumbnail?.media?.url).toBe("attachment://emoji.png");
		expect(texts(message)[0]).toBe("## C++");
	});

	test("an emoji that can't be fetched is skipped, not fatal", async () => {
		globalThis.fetch = (async () =>
			new Response("nope", { status: 404 })) as unknown as typeof fetch;
		await prepareEmoji("404");
		expect(squareEmoji("404")).toBeNull();
	});
});
