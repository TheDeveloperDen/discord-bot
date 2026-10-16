import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	Colors,
	type ComponentType,
	MessageFlags,
	PermissionFlagsBits,
} from "discord.js";
import { defineCommand, option } from "../../commands/index.js";
import { type DDUser, getOrCreateUserById } from "../../store/models/DDUser.js";
import { createStandardEmbed } from "../../util/embeds.js";

import { mentionIfPingable } from "../../util/users.js";
import { evaluateLevelAchievements } from "../xp/xpForMessage.util.js";
import { levelForXp } from "../xp/xpRoles.util.js";

export const SetCommand = defineCommand({
	name: "set",
	default_member_permissions: PermissionFlagsBits.Administrator,
	description: "Set data for a user",
	options: {
		target: option.member({
			description: "The user to edit",
			required: true,
		}),
		field: option.string({
			description: "The field to edit",
			required: true,
			choices: ["xp", "daily"].map((it) => ({
				name: it,
				value: it,
			})),
		}),
		value: option.integer({
			description: "The value to set",
			required: true,
		}),
	},

	async handle(interaction, { target, field, value }) {
		const user = await getOrCreateUserById(BigInt(target.id));

		const getter = getters.get(field);
		const setter = setters.get(field);
		if (getter == null || setter == null) return;

		const embed = createStandardEmbed(target)
			.setTitle("Confirm")
			.setDescription(
				`Are you sure you want to set ${mentionIfPingable(
					target,
				)}'s ${field} to ${value}?`,
			)
			.setFields([
				{
					name: "Current Value",
					value: getter(user).toString(),
					inline: true,
				},
				{
					name: "New Value",
					value: value.toString(),
					inline: true,
				},
			]);
		const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId("confirm")
				.setStyle(ButtonStyle.Success)
				.setLabel("Confirm"),
			new ButtonBuilder()
				.setCustomId("cancel")
				.setStyle(ButtonStyle.Danger)
				.setLabel("Cancel"),
		);
		const reply = await interaction.reply({
			embeds: [embed],
			components: [buttons],
			withResponse: false,
		});

		const channel = interaction.channel;
		if (channel == null) {
			await interaction.reply("You can't do this in DMs");
			return;
		}
		if (!channel.isSendable()) {
			await interaction.reply("Channel is not sendable");
			return;
		}
		const collector =
			channel.createMessageComponentCollector<ComponentType.Button>({
				filter: (i) =>
					i.isButton() &&
					i.message?.interactionMetadata?.id === interaction.id &&
					i.user.id === interaction.user.id,
				time: 15000,
				maxComponents: 1,
			});

		const event = await collector.next;
		if (event.customId === "cancel") {
			await event.reply({
				flags: MessageFlags.Ephemeral,
				content: "**Cancelled**",
			});
		} else if (event.customId === "confirm") {
			await event.deferReply({
				flags: MessageFlags.Ephemeral,
			});
			setter(user, value);
			await user.save();
			if (field === "xp") {
				await evaluateLevelAchievements(target, user, channel);
			}
			await reply.edit({
				components: [],
				embeds: [
					createStandardEmbed(target)
						.setTitle("Success")
						.setColor(Colors.Green)
						.setDescription(
							`Set ${mentionIfPingable(target)}'s ${field} to ${value}`,
						),
				],
			});
			await event.followUp({
				flags: MessageFlags.Ephemeral,
				content: "Success!",
			});
		}
	},
});

const getters = new Map([
	["xp", (user: DDUser) => user.xp],
	["daily", (user: DDUser) => BigInt(user.currentDailyStreak)],
]);

const setters = new Map([
	[
		"xp",
		(user: DDUser, value: number) => {
			user.xp = BigInt(value);
			user.level = levelForXp(user.xp);
		},
	],
	[
		"daily",
		(user: DDUser, value: number) => {
			user.currentDailyStreak = value;
			if (value > user.highestDailyStreak) {
				user.highestDailyStreak = value;
			}
		},
	],
]);

export default SetCommand;
