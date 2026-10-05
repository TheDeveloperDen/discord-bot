import {
	ActionRowBuilder,
	ApplicationCommandOptionType,
	ApplicationCommandType,
	type AutocompleteInteraction,
	type ChatInputCommandInteraction,
	type ComponentType,
	EmbedBuilder,
	MessageFlags,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
} from "discord.js";
import type { Command } from "../../commands/index.js";
import { runObserved } from "../../observe.js";

import type { DocsLookupResult, DocsService } from "./docs.service.js";
import type { DocsEntry } from "./types.js";

const MAX_AUTOCOMPLETE_CHOICES = 25;
const MAX_OPTION_TEXT_LENGTH = 100;
const SELECT_TIMEOUT_MS = 120_000;

/** Creates the /docs command around a single local documentation index. */
export function createDocsCommand(
	service: DocsService,
): Command<ApplicationCommandType.ChatInput> {
	return {
		type: ApplicationCommandType.ChatInput,
		name: "docs",
		description: "Look up documentation from the local docs index",
		options: [
			{
				type: ApplicationCommandOptionType.String,
				name: "source",
				description: "Documentation source, such as python or typescript",
				required: true,
				autocomplete: true,
				max_length: MAX_OPTION_TEXT_LENGTH,
			},
			{
				type: ApplicationCommandOptionType.String,
				name: "query",
				description: "Name of the API, type, or topic to find",
				required: true,
				autocomplete: true,
				max_length: MAX_OPTION_TEXT_LENGTH,
			},
			{
				type: ApplicationCommandOptionType.String,
				name: "version",
				description: "Documentation version (defaults to stable)",
				autocomplete: true,
				max_length: MAX_OPTION_TEXT_LENGTH,
			},
		],
		autocomplete: (interaction) => autocompleteDocs(service, interaction),
		handle: (interaction) => handleDocs(service, interaction),
	};
}

async function autocompleteDocs(
	service: DocsService,
	interaction: AutocompleteInteraction,
): Promise<void> {
	const focused = interaction.options.getFocused(true);
	const input = String(focused.value).trim().toLocaleLowerCase();

	if (focused.name === "source") {
		await interaction.respond(
			service.sources
				.filter((source) => sourceMatches(source, input))
				.slice(0, MAX_AUTOCOMPLETE_CHOICES)
				.map((source) => ({
					name: choiceText(source.name, MAX_OPTION_TEXT_LENGTH),
					value: choiceText(source.id, MAX_OPTION_TEXT_LENGTH),
				})),
		);
		return;
	}

	const sourceInput = interaction.options.getString("source")?.trim();
	const source = sourceInput ? service.resolveSource(sourceInput) : undefined;
	if (!source) {
		await interaction.respond([]);
		return;
	}

	if (focused.name === "version") {
		await interaction.respond(
			source.targets
				.filter((target) => target.id.toLocaleLowerCase().includes(input))
				.slice(0, MAX_AUTOCOMPLETE_CHOICES)
				.map((target) => ({
					name: choiceText(target.label, MAX_OPTION_TEXT_LENGTH),
					value: choiceText(target.id, MAX_OPTION_TEXT_LENGTH),
				})),
		);
		return;
	}

	if (focused.name !== "query") {
		await interaction.respond([]);
		return;
	}

	const version = interaction.options.getString("version")?.trim() || "stable";
	const result = service.lookup(
		source.id,
		version,
		String(focused.value),
		MAX_AUTOCOMPLETE_CHOICES,
	);
	if (result.status !== "ready") {
		await interaction.respond([]);
		return;
	}

	await interaction.respond(
		result.entries.slice(0, MAX_AUTOCOMPLETE_CHOICES).flatMap((entry) => {
			if (!entry.name || entry.name.length > MAX_OPTION_TEXT_LENGTH) {
				return [];
			}
			const type = choiceText(entry.type, 30);
			return [
				{
					name: choiceText(
						type ? `${entry.name} — ${type}` : entry.name,
						MAX_OPTION_TEXT_LENGTH,
					),
					value: entry.name,
				},
			];
		}),
	);
}

async function handleDocs(
	service: DocsService,
	interaction: ChatInputCommandInteraction,
): Promise<void> {
	const sourceInput = interaction.options.getString("source", true).trim();
	const query = interaction.options.getString("query", true).trim();
	const version = interaction.options.getString("version")?.trim() || "stable";

	if (!sourceInput) {
		await replyEphemeral(interaction, "Choose a documentation source first.");
		return;
	}
	if (!query) {
		await replyEphemeral(interaction, "Enter a documentation query first.");
		return;
	}

	const result = service.lookup(
		sourceInput,
		version,
		query,
		MAX_AUTOCOMPLETE_CHOICES,
	);
	if (result.status !== "ready") {
		await replyLookupFailure(interaction, result, sourceInput, version);
		return;
	}

	if (result.entries.length === 0) {
		const sourceName = inlineText(result.source.name);
		const queryText = inlineText(query);
		const versionText = inlineText(version);
		await replyEphemeral(
			interaction,
			`No documentation matches ${queryText} in ${sourceName} (${versionText}).`,
		);
		return;
	}

	if (result.exact || result.entries.length === 1) {
		await replyEntry(interaction, result, result.entries[0]);
		return;
	}

	await replySelection(interaction, result);
}

async function replyLookupFailure(
	interaction: ChatInputCommandInteraction,
	result: Exclude<DocsLookupResult, { status: "ready" }>,
	sourceInput: string,
	version: string,
): Promise<void> {
	switch (result.status) {
		case "unknown-source":
			await replyEphemeral(
				interaction,
				`I don't recognize the documentation source ${inlineText(sourceInput)}.`,
			);
			return;
		case "unknown-version": {
			const source =
				interaction.options.getString("source")?.trim() || sourceInput;
			const message = [
				`Version ${inlineText(version)} is not available for ${inlineText(source)}.`,
				"Choose a listed version or use stable.",
			].join(" ");
			await replyEphemeral(interaction, message);
			return;
		}
		case "unavailable": {
			const source = inlineText(sourceInput);
			const versionText = inlineText(version);
			const message = [
				`Documentation for ${source} (${versionText}) is not available yet.`,
				"Try again after the next refresh.",
			].join(" ");
			await replyEphemeral(interaction, message);
			return;
		}
	}
}

async function replyEntry(
	interaction: ChatInputCommandInteraction,
	result: Extract<DocsLookupResult, { status: "ready" }>,
	entry: DocsEntry,
): Promise<void> {
	const url = safeUrl(entry.url);
	if (!url) {
		await replyEphemeral(
			interaction,
			"This documentation result has an unsafe link.",
		);
		return;
	}

	await interaction.reply({ embeds: [entryEmbed(result, entry, url)] });
}

async function replySelection(
	interaction: ChatInputCommandInteraction,
	result: Extract<DocsLookupResult, { status: "ready" }>,
): Promise<void> {
	const entries = result.entries.slice(0, MAX_AUTOCOMPLETE_CHOICES);
	const choices = entries.flatMap((entry, index) => {
		if (!safeUrl(entry.url)) return [];
		const option = new StringSelectMenuOptionBuilder()
			.setLabel(
				choiceText(entry.name, MAX_OPTION_TEXT_LENGTH) ||
					"Documentation result",
			)
			.setValue(index.toString());
		const type = choiceText(entry.type, MAX_OPTION_TEXT_LENGTH);
		if (type) option.setDescription(type);
		return [option];
	});

	if (choices.length === 0) {
		await replyEphemeral(
			interaction,
			"No documentation results have safe links.",
		);
		return;
	}

	const customId = `docs-result-${interaction.id}`;
	const select = new StringSelectMenuBuilder()
		.setCustomId(customId)
		.setPlaceholder("Choose a documentation result")
		.setOptions(choices);
	const sourceName = inlineText(result.source.name);
	const provider =
		result.snapshot.provider === "sphinx"
			? "Official Sphinx inventory"
			: "DevDocs";
	const summary = [
		inlineText(result.snapshot.version),
		provider,
		result.stale ? "stale" : "fresh",
	].join(", ");
	await interaction.reply({
		content: `Choose a documentation result for ${sourceName} (${summary}).`,
		components: [
			new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select),
		],
	});

	const channel = interaction.channel;
	if (channel === null || !channel.isSendable()) {
		await interaction.editReply({ components: [] });
		return;
	}

	const collector =
		channel.createMessageComponentCollector<ComponentType.StringSelect>({
			filter: (component) =>
				component.isStringSelectMenu() &&
				component.customId === customId &&
				component.message.interactionMetadata?.id === interaction.id &&
				component.user.id === interaction.user.id,
			time: SELECT_TIMEOUT_MS,
			maxComponents: 1,
		});

	collector.once("collect", (component) => {
		void runObserved(
			{
				op: "component",
				name: "docs.resultSelect",
				interaction: component,
			},
			async () => {
				const index = Number(component.values[0]);
				const entry = entries[index];
				const url = entry && safeUrl(entry.url);
				if (!Number.isSafeInteger(index) || !entry || !url) {
					await component.reply({
						content: "That documentation result is no longer available.",
						flags: MessageFlags.Ephemeral,
					});
					await interaction.editReply({ components: [] });
					return;
				}

				await component.update({
					content: null,
					embeds: [entryEmbed(result, entry, url)],
					components: [],
				});
			},
		);
	});
	collector.once("end", (_, reason) => {
		if (reason === "limit") return;
		void runObserved(
			{ op: "component", name: "docs.resultSelect.cleanup", interaction },
			() => interaction.editReply({ components: [] }),
		);
	});
}

function entryEmbed(
	result: Extract<DocsLookupResult, { status: "ready" }>,
	entry: DocsEntry,
	url: string,
): EmbedBuilder {
	const refreshedAt = Math.floor(result.snapshot.refreshedAt / 1000);
	const freshness = result.stale
		? `Stale — refreshed <t:${refreshedAt}:R>`
		: `Refreshed <t:${refreshedAt}:R>`;
	const provider =
		result.snapshot.provider === "sphinx"
			? "Official Sphinx inventory"
			: "DevDocs";
	const fields: Array<{ name: string; value: string; inline?: boolean }> = [
		{ name: "Provider", value: provider, inline: true },
		{
			name: "Version",
			value: inlineText(result.snapshot.version),
			inline: true,
		},
		{ name: "Freshness", value: freshness, inline: true },
		{ name: "Link", value: `<${url}>` },
	];
	if (result.snapshot.upstreamUpdatedAt) {
		fields.push({
			name: "Upstream updated",
			value: `<t:${Math.floor(result.snapshot.upstreamUpdatedAt / 1000)}:D>`,
		});
	}

	return new EmbedBuilder()
		.setTitle(safeText(entry.name, 256) || "Documentation result")
		.setURL(url)
		.setDescription(safeText(entry.type, 4_096) || "Documentation reference")
		.setFields(fields);
}

async function replyEphemeral(
	interaction: ChatInputCommandInteraction,
	content: string,
): Promise<void> {
	await interaction.reply({ content, flags: MessageFlags.Ephemeral });
}

function sourceMatches(
	source: DocsService["sources"][number],
	input: string,
): boolean {
	if (!input) return true;
	return [source.id, source.name, ...source.aliases].some((candidate) =>
		candidate.toLocaleLowerCase().includes(input),
	);
}

function choiceText(value: string, maxLength: number): string {
	return plainText(value, maxLength);
}

function inlineText(value: string): string {
	const text = plainText(value, 100)
		.replaceAll("\\", "\\\\")
		.replaceAll("`", "\\`");
	return `\`${text}\``;
}

function safeText(value: string, maxLength: number): string {
	const escaped = plainText(value, maxLength).replace(
		/([\\`*_{}[\]<>~|])/g,
		"\\$1",
	);
	if (escaped.length <= maxLength) return escaped;
	return `${escaped.slice(0, Math.max(0, maxLength - 3))}...`;
}

function plainText(value: string, maxLength: number): string {
	const normalized = value
		.replace(/\p{Cc}/gu, " ")
		.replaceAll("@", "@\u200b")
		.trim();
	if (normalized.length <= maxLength) return normalized;
	return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
}

function safeUrl(value: string): string | undefined {
	try {
		const url = new URL(value);
		if (
			url.protocol !== "https:" ||
			url.username ||
			url.password ||
			!url.hostname
		) {
			return undefined;
		}
		return url.toString();
	} catch {
		return undefined;
	}
}
