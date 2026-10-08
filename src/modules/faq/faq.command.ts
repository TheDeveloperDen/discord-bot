import {
	ApplicationCommandOptionType,
	ApplicationCommandType,
	type AutocompleteInteraction,
	type GuildMember,
	MessageFlags,
	PermissionFlagsBits,
} from "discord.js";
import {
	type Command,
	type ExecutableSubcommand,
	respondWithChoices,
} from "../../commands/index.js";
import { FAQ } from "../../store/models/FAQ.js";

import createFaqModal from "./faq.modal.js";
import { createFaqEmbed } from "./faq.util.js";

async function autocompleteFaqNames(interaction: AutocompleteInteraction) {
	const faqs = await FAQ.findAll({ attributes: ["name"] });
	await respondWithChoices(
		interaction,
		faqs.map((it) => ({ name: it.name, value: it.name })),
	);
}

const GetSubcommand: ExecutableSubcommand = {
	type: ApplicationCommandOptionType.Subcommand,
	name: "get",
	description: "Get a FAQ entry's content",
	options: [
		{
			type: ApplicationCommandOptionType.String,
			name: "name",
			description: "The name of the FAQ",
			required: true,
			autocomplete: true,
		},
	],
	autocomplete: autocompleteFaqNames,
	async handle(interaction) {
		const name = interaction.options.get("name")?.value as string | null;
		const faq = await FAQ.findOne({
			where: { name: name ?? undefined },
		});
		if (faq == null) {
			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "No FAQ found with this name",
			});
		}
		return await interaction.reply({ embeds: [createFaqEmbed(faq)] });
	},
};

const EditSubcommand: ExecutableSubcommand = {
	type: ApplicationCommandOptionType.Subcommand,
	name: "edit",
	description: "Edit a FAQ entry, or create a new one if it doesn't exist",
	options: [
		{
			type: ApplicationCommandOptionType.String,
			name: "name",
			description: "The name of the FAQ",
			required: true,
			autocomplete: true,
		},
	],
	autocomplete: autocompleteFaqNames,
	async handle(interaction) {
		const member = interaction.member as GuildMember;
		if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "No permission",
			});
		}
		const name = interaction.options.get("name")?.value as string | null;
		if (name == null) {
			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "No FAQ name provided",
			});
		}
		const faq = await FAQ.findOne({ where: { name } });

		const modal = createFaqModal(faq ?? undefined);

		await interaction.showModal(modal);
		const response = await interaction.awaitModalSubmit({ time: 2 ** 31 - 1 });
		const title = response.fields.getTextInputValue("titleField");
		const content = response.fields.getTextInputValue("faqContentField");

		await FAQ.upsert({
			id: faq?.id,
			name,
			title,
			content,
			author: BigInt(interaction.user.id),
		});
		await response.reply({
			flags: MessageFlags.Ephemeral,
			content: `FAQ named ${name} created`,
		});
	},
};

const DeleteSubcommand: ExecutableSubcommand = {
	type: ApplicationCommandOptionType.Subcommand,
	name: "delete",
	description: "Delete a FAQ entry",
	options: [
		{
			type: ApplicationCommandOptionType.String,
			name: "name",
			description: "The name of the FAQ",
			required: true,
			autocomplete: true,
		},
	],
	autocomplete: autocompleteFaqNames,
	async handle(interaction) {
		const member = interaction.member as GuildMember;
		if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "No permission",
			});
		}
		const name = interaction.options.get("name")?.value as string | null;
		if (name == null) {
			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "No FAQ name provided",
			});
		}

		const faq = await FAQ.findOne({ where: { name } });
		if (faq == null) {
			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "No FAQ found with this name",
			});
		}
		await faq.destroy();
		return await interaction.reply({
			flags: MessageFlags.Ephemeral,
			content: `FAQ named ${name} deleted`,
		});
	},
};

export const FaqCommand: Command<ApplicationCommandType.ChatInput> = {
	name: "faq",
	description: "Get / set FAQs",
	type: ApplicationCommandType.ChatInput,
	options: [GetSubcommand, EditSubcommand, DeleteSubcommand],
	handle() {},
};
