import { describe, expect, mock, test } from "bun:test";
import {
	AttachmentBuilder,
	type ButtonInteraction,
	MessageFlags,
} from "discord.js";
import { TextDisplay } from "disjsx";
import { parseCustomId } from "../components/component.js";
import { buttons, type RenderedMessage, texts } from "../tests/render.js";
import { Card } from "./Card.js";
import { definePaginator, type PageRequest } from "./Paginator.js";

const ITEMS = Array.from({ length: 25 }, (_, i) => `item ${i + 1}`);

function setup(items: string[] = ITEMS) {
	const fetch = mock(
		(_args: { list: string }, { offset, limit }: PageRequest) => ({
			items: items.slice(offset, offset + limit),
			total: items.length,
		}),
	);
	const Pages = definePaginator({
		id: "test:page",
		args: ["list"],
		pageSize: 10,
		fetch,
		render: ({ items, footer }, { list }) => (
			<Card title={list} footer={footer}>
				<TextDisplay>{items.join("\n") || "nothing"}</TextDisplay>
			</Card>
		),
	});
	return { Pages, fetch };
}

/** A button click that records how it was acknowledged and what it was edited to */
function click(customId: string, userId: string) {
	const deferUpdate = mock(() => Promise.resolve());
	const deferReply = mock((_options: { flags?: number }) => Promise.resolve());
	const editReply = mock((_payload: RenderedMessage) => Promise.resolve());
	const interaction = {
		customId,
		user: { id: userId },
		deferUpdate,
		deferReply,
		editReply,
	} as unknown as ButtonInteraction;
	const shown = () => editReply.mock.calls[0]?.[0] as RenderedMessage;
	return { interaction, deferUpdate, deferReply, shown };
}

async function clickButton(
	Pages: ReturnType<typeof setup>["Pages"],
	button: { custom_id?: string } | undefined,
	userId: string,
) {
	const customId = button?.custom_id;
	if (!customId) throw new Error("button has no custom id");
	const args = parseCustomId(Pages, customId);
	if (!args) throw new Error(`${customId} isn't the paginator's`);
	const clicked = click(customId, userId);
	await Pages.handle(clicked.interaction, args as never);
	return clicked;
}

describe("Paginator", () => {
	test("first page shows the first items, the page count, and only next enabled", async () => {
		const { Pages, fetch } = setup();
		const payload = (await Pages.message(
			{ list: "things" },
			{ owner: "1" },
		)) as RenderedMessage;

		expect(fetch).toHaveBeenCalledWith(
			{ list: "things" },
			{ offset: 0, limit: 10 },
		);
		expect(texts(payload)).toContain(ITEMS.slice(0, 10).join("\n"));
		expect(texts(payload).at(-1)).toContain("Page 1 of 3");
		const [prev, next] = buttons(payload);
		expect(prev?.disabled).toBe(true);
		expect(next?.disabled).toBeFalsy();
	});

	test("pages never ping the people they mention", async () => {
		const { Pages } = setup();
		const payload = await Pages.message({ list: "things" }, { owner: "1" });

		expect(payload.allowedMentions).toEqual({ parse: [] });
	});

	test("sends the files the pages refer to, and none when there aren't any", async () => {
		const file = new AttachmentBuilder(Buffer.from("x"), { name: "a.png" });
		const withFiles = definePaginator({
			id: "test:files",
			pageSize: 10,
			fetch: () => ({ items: [], total: 0 }),
			render: () => <Card title="t" />,
			files: () => [file],
		});
		const payload = await withFiles.message({}, { owner: "1" });
		expect(payload.files).toEqual([file]);

		const { Pages } = setup();
		const plain = await Pages.message({ list: "things" }, { owner: "1" });
		expect("files" in plain).toBe(false);
	});

	test("a single page has no buttons and no page count", async () => {
		const { Pages } = setup(ITEMS.slice(0, 4));
		const payload = (await Pages.message(
			{ list: "things" },
			{ owner: "1" },
		)) as RenderedMessage;

		expect(buttons(payload)).toEqual([]);
		expect(texts(payload).at(-1)).not.toContain("Page");
	});

	test("an empty list still renders one page", async () => {
		const { Pages } = setup([]);
		const payload = (await Pages.message(
			{ list: "things" },
			{ owner: "1" },
		)) as RenderedMessage;

		expect(texts(payload)).toContain("nothing");
		expect(buttons(payload)).toEqual([]);
	});

	test("the owner clicking next updates the message to the next page", async () => {
		const { Pages, fetch } = setup();
		const first = (await Pages.message(
			{ list: "a:b" },
			{ owner: "1" },
		)) as RenderedMessage;

		const clicked = await clickButton(Pages, buttons(first)[1], "1");

		// acknowledged straight away, since fetching a page may take longer than Discord's 3 seconds
		expect(clicked.deferUpdate).toHaveBeenCalled();
		expect(clicked.deferReply).not.toHaveBeenCalled();
		expect(fetch).toHaveBeenLastCalledWith(
			{ list: "a:b" },
			{ offset: 10, limit: 10 },
		);
		const second = clicked.shown();
		expect(texts(second)).toContain(ITEMS.slice(10, 20).join("\n"));
		expect(texts(second).at(-1)).toContain("Page 2 of 3");
		const [prev, next] = buttons(second);
		expect(prev?.disabled).toBeFalsy();
		expect(next?.disabled).toBeFalsy();
	});

	test("the last page disables next", async () => {
		const { Pages } = setup();
		const payload = (await Pages.message(
			{ list: "things" },
			{ owner: "1", page: 2 },
		)) as RenderedMessage;

		expect(texts(payload)).toContain(ITEMS.slice(20).join("\n"));
		const [prev, next] = buttons(payload);
		expect(prev?.disabled).toBeFalsy();
		expect(next?.disabled).toBe(true);
	});

	test("someone else clicking gets an ephemeral copy that they own", async () => {
		const { Pages } = setup();
		const first = (await Pages.message(
			{ list: "things" },
			{ owner: "1" },
		)) as RenderedMessage;

		const clicked = await clickButton(Pages, buttons(first)[1], "2");

		expect(clicked.deferUpdate).not.toHaveBeenCalled();
		expect(clicked.deferReply).toHaveBeenCalledWith({
			flags: MessageFlags.Ephemeral,
		});
		const copy = clicked.shown();
		expect(texts(copy).at(-1)).toContain("Page 2 of 3");

		// their copy's buttons are theirs, so clicking them turns their copy's page
		const again = await clickButton(Pages, buttons(copy)[1], "2");
		expect(again.deferUpdate).toHaveBeenCalled();
		expect(texts(again.shown()).at(-1)).toContain("Page 3 of 3");
	});

	test("a page past the end (the list shrank) shows the last page", async () => {
		const { Pages } = setup(ITEMS.slice(0, 15));
		const payload = (await Pages.message(
			{ list: "things" },
			{ owner: "1", page: 5 },
		)) as RenderedMessage;

		expect(texts(payload)).toContain(ITEMS.slice(10, 15).join("\n"));
		expect(texts(payload).at(-1)).toContain("Page 2 of 2");
	});
});
