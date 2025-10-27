import * as Sentry from "@sentry/node";
import { ApplicationCommandType } from "discord.js";
import type { Command } from "djs-slash-helper";
import { config } from "../../Config.js";
import { createStandardEmbed } from "../../util/embeds.js";
import randomElementFromArray from "../../util/random.js";
import { actualMention, type UserMentionable } from "../../util/users.js";

const zooGifs = [
	"https://c.tenor.com/hZGXVfUTKkIAAAAd/tenor.gif",
	"https://c.tenor.com/rVp0HbYphkEAAAAd/tenor.gif",
	"https://c.tenor.com/xD622Ai2sLMAAAAC/tenor.gif",
	"https://c.tenor.com/3fuiv47KDrkAAAAd/tenor.gif",
	"https://images-ext-1.discordapp.net/external/6YzW5IqUn2yPzaKOWpXLw4Za2GXLmEJl2Ky_ubFU-04/https/media.tenor.com/bySzwVy_BWEAAAPo/manul-pallas-cat.mp4",
];

const zooMessages: ((user: UserMentionable) => string)[] = [
	(user) => `${actualMention(user)} has been sent to the zoo! 🦁`,
	(user) => `${actualMention(user)} will make a fine new exhibit! 🐯`,
	(user) => `Look at ${actualMention(user)} go! Such a majestic creature! 🦒`,
	(user) =>
		`Everyone, please welcome our latest exhibit: ${actualMention(user)}! 🐵`,
	(user) =>
		`${actualMention(user)} has been safely secured in their new habitat! 🐼`,
	(user) =>
		`The zookeepers have successfully captured ${actualMention(user)}! 🦊`,
	(user) =>
		`${actualMention(user)} couldn't behave and has been placed in the zoo! 🐸`,
];

export const ZookeepCommand: Command<ApplicationCommandType.User> = {
	name: "Zookeep",
	default_permission: false,
	type: ApplicationCommandType.User,
	async handle(interaction) {
		if (!config.roles.zooExhibit) {
			await interaction.reply({
				content: "Sorry, there's no zoo configured.",
				flags: "Ephemeral",
			});
			return;
		}
		const user = interaction.targetUser;

		const guild = interaction.guild;
		if (!guild) {
			await interaction.reply({
				content: "This command can only be used in a guild.",
				flags: "Ephemeral",
			});
			return;
		}
		const member = await guild?.members.fetch(user.id);
		if (!member) {
			await interaction.reply({
				content: "User not found in this guild.",
				flags: "Ephemeral",
			});
			return;
		}
		if (member.user.bot) {
			await interaction.reply({
				content: `Bots can't be sent to the zoo!`,
				flags: "Ephemeral",
			});
			return;
		}

		const interactionMember = await interaction.guild.members.fetch(
			interaction.user.id,
		);
		if (member.roles.highest >= interactionMember.roles.highest) {
			await interaction.reply({
				content: `You cannot send ${actualMention(user)} to the zoo because they have an equal or higher role than you.`,
				flags: "Ephemeral",
			});
			return;
		}

		if (member.roles.cache.has(config.roles.zooExhibit)) {
			await interaction.reply({
				content: `${actualMention(user)} is already in the zoo!`,
				flags: "Ephemeral",
			});
			return;
		}
		try {
			await member.roles.add(
				config.roles.zooExhibit,
				`Zookeep command used by ${interaction.user.tag}`,
			);
		} catch (error) {
			Sentry.captureException(error);
			await interaction.reply({
				content: `Failed to send ${actualMention(user)} to the zoo. Do I have the correct permissions?`,
				flags: "Ephemeral",
			});
			return;
		}

		const gif = randomElementFromArray(zooGifs);
		const message = randomElementFromArray(zooMessages)(user);

		const embed = createStandardEmbed(user)
			.setTitle("Zoo Exhibit Captured!")
			.setDescription(message)
			.setColor("Purple")
			.setImage(gif);
		console.log(gif);

		if (!interaction.inCachedGuild()) {
			await interaction.reply({ embeds: [embed] });
			return;
		}
		const applicableChannel = interaction.channel;

		// if the command is being done in a private or special channel...
		if (
			applicableChannel &&
			!applicableChannel
				.permissionsFor(guild.roles.everyone)
				.has("SendMessages")
		) {
			// send it in general instead
			const generalChannel = guild.channels.cache.get(config.channels.general);
			if (
				generalChannel?.isTextBased() &&
				generalChannel.permissionsFor(interaction.user.id)?.has("SendMessages")
			) {
				await interaction.reply({
					content: `Zookept successfully executed! Posting the result in <#${config.channels.general}>.`,
					flags: "Ephemeral",
				});
				embed.setDescription(
					`${message}\nThanks ${actualMention(interaction.user)} for keeping our civilization safe!`,
				);
				await generalChannel.send({ embeds: [embed] });
				return;
			}
		}

		await interaction.reply({ embeds: [embed] });
	},
};
