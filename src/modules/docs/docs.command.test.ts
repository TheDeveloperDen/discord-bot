import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
	AutocompleteInteraction,
	ChatInputCommandInteraction,
} from "discord.js";

import { createDocsCommand } from "./docs.command.js";
import { DocsService } from "./docs.service.js";
import type { DocsSnapshot, DocsSource } from "./types.js";

const source: DocsSource = {
	id: "typescript",
	name: "TypeScript",
	aliases: ["ts"],
	targets: [
		{
			id: "stable",
			label: "Stable",
			provider: "devdocs",
			slug: "typescript",
		},
	],
};

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => rm(directory, { recursive: true, force: true })),
	);
});

describe("/docs autocomplete", () => {
	test("preserves an @ symbol name as the selectable query value", async () => {
		const cacheDir = await mkdtemp(join(tmpdir(), "docs-command-"));
		temporaryDirectories.push(cacheDir);
		const service = new DocsService({
			cacheDir,
			sources: [source],
			loadSnapshot: async (): Promise<DocsSnapshot> => ({
				sourceId: "typescript",
				targetId: "stable",
				provider: "devdocs",
				version: "5.8",
				entries: [
					{
						name: "@callback",
						type: "Callback",
						url: "https://devdocs.io/typescript/@callback",
					},
				],
				refreshedAt: 1_000,
			}),
		});
		await service.refresh();

		const choices: Array<{ name: string; value: string }> = [];
		const autocompleteInteraction = {
			options: {
				getFocused: () => ({ name: "query", value: "callback" }),
				getString: (name: string) => {
					if (name === "source") return "typescript";
					if (name === "version") return "stable";
					return null;
				},
			},
			respond: async (result: Array<{ name: string; value: string }>) => {
				choices.push(...result);
			},
		} as unknown as AutocompleteInteraction;

		const command = createDocsCommand(service);
		if (!command.autocomplete) throw new Error("Expected autocomplete handler");
		await command.autocomplete(autocompleteInteraction);

		expect(choices).toHaveLength(1);
		const selectedValue = choices[0]?.value ?? "";
		expect(selectedValue).toBe("@callback");
		expect(service.lookup("typescript", "stable", selectedValue)).toMatchObject(
			{
				status: "ready",
				exact: true,
				entries: [{ name: "@callback" }],
			},
		);

		const replies: Array<{
			embeds?: Array<{ data: { title?: string } }>;
		}> = [];
		const lookupInteraction = {
			options: {
				getString: (name: string) => {
					if (name === "source") return "typescript";
					if (name === "version") return "stable";
					if (name === "query") return selectedValue;
					return null;
				},
			},
			reply: async (payload: {
				embeds?: Array<{ data: { title?: string } }>;
			}) => {
				replies.push(payload);
			},
		} as unknown as ChatInputCommandInteraction;
		await command.handle(lookupInteraction);

		expect(replies).toHaveLength(1);
		expect(replies[0]?.embeds?.[0]?.data.title).toBe("@\u200bcallback");
	});
});
