import { MessageFlags, PermissionFlagsBits } from "discord.js";
import { TextDisplay } from "disjsx";
import { defineCommand, option, subcommand } from "../../commands/index.js";
import { Card, definePaginator } from "../../ui/index.js";
import { getModuleManager } from "../moduleManager.js";
import { prepareEmoji, squareEmoji } from "./emojiImage.js";
import {
	CONTRIBUTE_LINK,
	customEmojiId,
	ResourceCard,
	resourceTitle,
} from "./learning.render.js";
import {
	getAllCachedResources,
	getCachedResource,
	getResource,
	updateAllResources,
} from "./resourcesCache.util.js";

const resources: Array<{ name: string; value: string }> = [];

export async function updateResourcesForCommands() {
	await updateAllResources();
	resources.length = 0;
	resources.push(
		...getAllCachedResources().map(([fileName, res]) => ({
			name: res.name,
			value: fileName,
		})),
	);
}

/**
 * One learning resource set
 */
export const ResourcePages = definePaginator({
	id: "learning:resource",
	args: ["resource"],
	pageSize: 3,
	fetch: async ({ resource }, { offset, limit }) => {
		const set = await getResource(resource);
		if (set == null) return { items: [], total: 0 };
		// render and files are synchronous, so the emoji's image is prepared here
		const emoji = customEmojiId(set);
		if (emoji) await prepareEmoji(emoji);
		return {
			items: set.resources.slice(offset, offset + limit),
			total: set.resources.length,
		};
	},
	render: ({ items, footer }, { resource }, { client }) => {
		const set = getCachedResource(resource);
		if (!set) return <Card title="Resource not found" />;
		return (
			<ResourceCard
				client={client}
				resourceSet={set}
				resources={items}
				footer={footer}
			/>
		);
	},
	files: ({ resource }) => {
		const set = getCachedResource(resource);
		const emoji = set && customEmojiId(set);
		const image = emoji ? squareEmoji(emoji) : null;
		return image ? [image] : [];
	},
});

export const LearningListPages = definePaginator({
	id: "learning:list",
	pageSize: 10,
	fetch: (_args, { offset, limit }) => {
		const all = getAllCachedResources();
		return { items: all.slice(offset, offset + limit), total: all.length };
	},
	render: ({ items, footer }, _args, { client }) => (
		<Card title="Resource List" footer={footer}>
			<TextDisplay>
				{items.map(([, res]) => resourceTitle(client, res)).join("\n")}
			</TextDisplay>
			<TextDisplay>{CONTRIBUTE_LINK}</TextDisplay>
		</Card>
	),
});

const LearningGetSubcommand = subcommand({
	description: "Get a learning resource",
	options: {
		resource: option.string({
			description: "The resource to lookup",
			required: true,
			choices: resources,
		}),
	},
	async handle(interaction, { resource: name }) {
		const fileName = getAllCachedResources().find(
			([key]) => key.toLowerCase() === name.toLowerCase(),
		)?.[0];
		if (fileName == null) {
			await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: `Could not find resource ${name}`,
			});
			return;
		}

		await interaction.deferReply();
		await interaction.followUp(
			await ResourcePages.message(
				{ resource: fileName },
				{ client: interaction.client, owner: interaction.user.id },
			),
		);
	},
});

const LearningUpdateSubcommand = subcommand({
	description: "Update the learning resources cache",
	async handle(interaction) {
		if (
			!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)
		) {
			await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "No permission",
			});
			return;
		}

		await interaction.deferReply({
			flags: MessageFlags.Ephemeral,
		});
		await updateResourcesForCommands();
		await getModuleManager().refreshCommands();
		await interaction.followUp("Updated learning resources cache");
	},
});

const LearningListSubcommand = subcommand({
	description: "List all learning resources",

	async handle(interaction) {
		await interaction.reply(
			await LearningListPages.message(
				{},
				{
					client: interaction.client,
					owner: interaction.user.id,
					ephemeral: true,
				},
			),
		);
	},
});

export const LearningCommand = defineCommand({
	name: "learning",
	description: "Manage learning resources",
	subcommands: {
		list: LearningListSubcommand,
		get: LearningGetSubcommand,
		update: LearningUpdateSubcommand,
	},
});
