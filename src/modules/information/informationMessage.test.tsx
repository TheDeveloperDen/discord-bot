import { describe, expect, test } from "bun:test";
import { ButtonStyle, ComponentType } from "discord.js";
import { config } from "../../Config.js";
import {
	flatten,
	type RenderedComponent,
	type RenderedMessage,
	texts,
} from "../../tests/render.js";
import type { InformationMessage } from "./information.js";
import { renderInformationMessage } from "./informationMessage.command.js";

const render = (info: InformationMessage) =>
	renderInformationMessage(info) as unknown as RenderedMessage;

const info: InformationMessage = {
	title: "About",
	description: "Welcome!",
	banner: "https://example.com/banner.png",
	buttonRows: [
		[{ type: "link", label: "Site", url: "https://example.com" }],
		[
			{
				type: "faq",
				faqId: "ask",
				label: "Ask",
				style: ButtonStyle.Primary,
			},
			{ type: "learning", label: "Learn", style: ButtonStyle.Success },
		],
	],
};

const rows = (message: RenderedMessage) =>
	flatten(message).filter((c) => c.type === ComponentType.ActionRow);

describe("renderInformationMessage", () => {
	test("shows the title, description and banner", () => {
		const message = render(info);
		expect(texts(message)).toContain("## About");
		expect(texts(message)).toContain("Welcome!");
		const gallery = flatten(message).find(
			(c) => c.type === ComponentType.MediaGallery,
		);
		expect(gallery?.items?.[0]?.media.url).toBe(info.banner);
	});

	test("has no banner when there isn't one", () => {
		const message = render({ ...info, banner: undefined });
		expect(
			flatten(message).some((c) => c.type === ComponentType.MediaGallery),
		).toBe(false);
	});

	test("keeps the button rows, with the same custom ids", () => {
		const message = render(info);
		const buttonsOf = (row: RenderedComponent) =>
			(row.components ?? []) as unknown as {
				custom_id?: string;
				url?: string;
			}[];
		const [link, second] = rows(message).map(buttonsOf);
		expect(link?.[0]?.url).toBe("https://example.com");
		expect(second?.map((b) => b.custom_id)).toEqual([
			"information:faq:ask",
			"information:learning",
		]);
	});

	test("is a Components V2 message", () => {
		expect(render(info).flags).toBeDefined();
	});

	test("the configured message fits in a message", () => {
		if (!config.informationMessage) throw new Error("not configured");
		const message = render(config.informationMessage);
		expect(flatten(message).length).toBeLessThanOrEqual(40);
		expect(texts(message).join("").length).toBeLessThan(4000);
	});
});
