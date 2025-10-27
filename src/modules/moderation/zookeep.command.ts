import {
	ApplicationCommandType,
	ContextMenuCommandType,
	UserMention,
} from "discord.js";
import { type Command, InteractionFor } from "djs-slash-helper";
import { config } from "../../Config.js";
import { createStandardEmbed } from "../../util/embeds.js";
import randomElementFromArray from "../../util/random.js";
import { actualMention, type UserMentionable } from "../../util/users.js";

const zooGifs = [
	"https://media1.tenor.com/m/hZGXVfUTKkIAAAAd/twirl-twist.gif",
	"https://media1.tenor.com/m/rVp0HbYphkEAAAAd/butterfly-girl-running.gif",
	"https://media1.tenor.com/m/xD622Ai2sLMAAAAC/nigel-marven-prehistoric-park.gif",
	"https://media1.tenor.com/m/3fuiv47KDrkAAAAd/bruh-bonk.gif",
];

const zooMessages: ((user: UserMentionable) => string)[] = [
	(user) => `${actualMention(user)} has been sent to the zoo! 🦁`,
	(user) => `${actualMention(user)} will make a fine new exhibit! 🐯`,
	(user) => `Look at ${actualMention(user)} go! Such a majestic creature! 🦒`,
	(user) =>
		`Everyone, please welcome our latest exhibit: ${actualMention(user)}! 🐵`,
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

		const member = await interaction.guild?.members.fetch(user.id);
		if (!member) {
			await interaction.reply({
				content: "User not found in this guild.",
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
		await member.roles.add(
			config.roles.zooExhibit,
			`Zookeep command used by ${interaction.user.tag}`,
		);

		const gif = randomElementFromArray(zooGifs);
		const message = randomElementFromArray(zooMessages)(user);

		const embed = createStandardEmbed(user)
			.setTitle("Zoo Exhibit Captured!")
			.setDescription(
				`${message}\nThanks, ${actualMention(interaction.user)} for keeping our civilization safe!`,
			)
			.setImage(gif);

		await interaction.reply({ embeds: [embed] });
	},
};
