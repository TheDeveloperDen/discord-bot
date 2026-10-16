import {
	type ChatInputCommandInteraction,
	MessageFlags,
	PermissionFlagsBits,
} from "discord.js";
import { renderDiscordModal } from "disjsx";
import { defineCommand, option, subcommand } from "../../commands/index.js";
import { FAQ } from "../../store/models/FAQ.js";
import { FaqEditForm } from "./faq.modal.js";
import { renderFaq } from "./faq.render.js";

const faqName = (maxLength?: number) =>
	option.string({
		description: "The name of the FAQ",
		required: true,
		max_length: maxLength,
		autocomplete: async () => {
			const faqs = await FAQ.findAll({ attributes: ["name"] });
			return faqs.map((it) => ({ name: it.name, value: it.name }));
		},
	});

const isModerator = (interaction: ChatInputCommandInteraction<"cached">) =>
	interaction.member.permissions.has(PermissionFlagsBits.ManageMessages);

const denyPermission = (interaction: ChatInputCommandInteraction<"cached">) =>
	interaction.reply({
		flags: MessageFlags.Ephemeral,
		content: "No permission",
	});

const GetSubcommand = subcommand({
	description: "Get a FAQ entry's content",
	options: { name: faqName() },
	async handle(interaction, { name }) {
		const faq = await FAQ.findOne({ where: { name } });
		if (faq == null) {
			return await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "No FAQ found with this name",
			});
		}
		return await interaction.reply(renderFaq(faq));
	},
});

const EditSubcommand = subcommand({
	description: "Edit a FAQ entry, or create a new one if it doesn't exist",
	options: { name: faqName(64) },
	async handle(interaction, { name }) {
		if (!isModerator(interaction)) {
			await denyPermission(interaction);
			return;
		}
		const faq = await FAQ.findOne({ where: { name } });

		await interaction.showModal(
			renderDiscordModal(<FaqEditForm name={name} faq={faq ?? undefined} />),
		);
	},
});

const DeleteSubcommand = subcommand({
	description: "Delete a FAQ entry",
	options: { name: faqName() },
	async handle(interaction, { name }) {
		if (!isModerator(interaction)) {
			await denyPermission(interaction);
			return;
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
});

export const FaqCommand = defineCommand({
	name: "faq",
	description: "Get / set FAQs",
	subcommands: {
		get: GetSubcommand,
		edit: EditSubcommand,
		delete: DeleteSubcommand,
	},
});
