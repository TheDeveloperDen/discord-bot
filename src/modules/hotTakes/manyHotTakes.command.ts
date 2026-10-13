import { range } from "discord.js";
import { defineCommand, option } from "../../commands/index.js";
import { upload } from "../pastify/pastify.js";
import generateHotTake from "./hotTakes.util.js";

export const ManyHotTakesCommand = defineCommand({
	name: "manyhottakes",
	description: "Summon MANY hot takes from the database.",
	options: {
		count: option.integer({
			description: "The number of hot takes to summon.",
			required: true,
		}),
	},

	async handle(interaction, { count }) {
		const guild = interaction.guild;
		await interaction.deferReply();
		const takes = await Promise.all(
			Array.from(range(count)).map(async () => await generateHotTake(guild)),
		).then((x) => x.join("\n\n"));

		if (count > 10 || takes.length > 2000) {
			const pastebinURL = await upload({ content: takes });
			await interaction.followUp({ content: pastebinURL });
		} else {
			await interaction.followUp({
				content: takes,
				allowedMentions: { users: [] },
			});
		}
	},
});

export default ManyHotTakesCommand;
