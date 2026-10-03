import {
	ActionRowBuilder,
	ApplicationCommandType,
	MessageFlags,
	PermissionFlagsBits,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
} from "discord.js";
import type { Command } from "djs-slash-helper";
import { getMemberFromInteraction } from "../../util/member.js";
import {
	createSupportThreadRemovalCustomId,
	isEligibleSupportThread,
	SUPPORT_THREAD_REMOVAL_REASONS,
} from "./supportThreadRemoval.js";

export const RemoveSupportThreadCommand: Command<ApplicationCommandType.Message> =
	{
		name: "Remove Support Thread",
		default_permission: false,
		type: ApplicationCommandType.Message,
		async handle(interaction) {
			if (!interaction.inGuild()) {
				await interaction.reply({
					content: "This action can only be used in a server.",
					flags: MessageFlags.Ephemeral,
				});
				return;
			}

			const thread = interaction.targetMessage.channel;
			if (
				!thread.isThread() ||
				!(await isEligibleSupportThread(interaction.client, thread))
			) {
				await interaction.reply({
					content:
						"This action can only be used in the configured ModMail support channel.",
					flags: MessageFlags.Ephemeral,
				});
				return;
			}
			const member = await getMemberFromInteraction(interaction);
			if (
				member == null ||
				thread.permissionsFor(member)?.has(PermissionFlagsBits.ManageThreads)
			) {
				await interaction.reply({
					content:
						"You need the Manage Threads permission to remove support tickets.",
					flags: MessageFlags.Ephemeral,
				});
				return;
			}

			const selectMenu = new StringSelectMenuBuilder()
				.setCustomId(
					createSupportThreadRemovalCustomId(thread.id, interaction.user.id),
				)
				.setPlaceholder("Select a removal reason")
				.setMinValues(1)
				.setMaxValues(1)
				.setOptions(
					SUPPORT_THREAD_REMOVAL_REASONS.map((reason) =>
						new StringSelectMenuOptionBuilder()
							.setValue(reason.value)
							.setLabel(reason.label)
							.setDescription(reason.description),
					),
				);

			await interaction.reply({
				content:
					"Choose why this support ticket should be removed. Its creator will receive a full conversation archive before anything is deleted.",
				components: [
					new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
						selectMenu,
					),
				],
				flags: MessageFlags.Ephemeral,
			});
		},
	};
