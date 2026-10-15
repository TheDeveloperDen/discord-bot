import { defineCommand } from "../../commands/index.js";
import generateHotTake from "./hotTakes.util.js";

export const HotTakeCommand = defineCommand({
	name: "hottake",
	description: "Summon a hot take from the database.",

	async handle(interaction) {
		await interaction.deferReply();

		const take = await generateHotTake(interaction.guild);
		await interaction.followUp({
			content: take,
			allowedMentions: { users: [] },
		});
	},
});

export default HotTakeCommand;
