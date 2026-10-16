import {
	Colors,
	type ComponentType,
	MessageFlags,
	PermissionFlagsBits,
} from "discord.js";
import { Message, renderDiscordMessage } from "disjsx";
import { defineCommand, option } from "../../commands/index.js";
import { type DDUser, getOrCreateUserById } from "../../store/models/DDUser.js";
import {
	Card,
	ConfirmButtons,
	Details,
	memberAuthor,
	withoutPings,
} from "../../ui/index.js";
import { actualMention } from "../../util/users.js";
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

		const reply = await interaction.reply({
			...withoutPings(
				renderDiscordMessage(
					<Message isV2>
						<Card
							accent={memberAuthor(target).color}
							title="Confirm"
							description={`Are you sure you want to set ${actualMention(target)}'s ${field} to ${value}?`}
						>
							<Details
								items={[
									["Current Value", getter(user).toString()],
									["New Value", value.toString()],
								]}
							/>
							<ConfirmButtons confirmId="confirm" cancelId="cancel" />
						</Card>
					</Message>,
				),
			),
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
			await reply.edit(
				withoutPings(
					renderDiscordMessage(
						<Message isV2>
							<Card
								accent={Colors.Green}
								title="Success"
								description={`Set ${actualMention(target)}'s ${field} to ${value}`}
							/>
						</Message>,
					),
				),
			);
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
