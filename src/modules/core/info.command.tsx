import { Message, renderDiscordMessage } from "disjsx";
import { defineCommand } from "../../commands/index.js";
import { logger } from "../../logging.js";
import { DDUser } from "../../store/models/DDUser.js";
import { Card, Details, memberAuthor, withoutPings } from "../../ui/index.js";
import { branding } from "../../util/branding.js";

export const InfoCommand = defineCommand({
	name: "info",
	description: "Show information about the bot and server",

	async handle(interaction) {
		await interaction.deferReply();
		const guild = interaction.guild;
		const totalXP = (await DDUser.sum("xp")) ?? 0;
		const memberCount = guild.memberCount;
		const membersStored = await DDUser.count();
		const dateCreated = `<t:${(guild.createdAt.getTime() / 1000) | 0}>`;
		const levelUps = (await DDUser.sum("level")) ?? 0;
		logger.debug(`totalXP: ${totalXP} (${typeof totalXP})`);
		await interaction.followUp(
			withoutPings(
				renderDiscordMessage(
					<Message isV2>
						<Card
							accent={memberAuthor(interaction.member).color}
							title={branding.name}
							description={
								"This is the bot for the Developer Den server. It's written in **TypeScript** using the **Discord.js** library. " +
								"The source can be found [here](https://github.com/TheDeveloperDen/DevDenBot)"
							}
						>
							<Details
								items={[
									[
										"Version",
										format(
											process.env.npm_package_version ??
												process.env.VERSION ??
												"Unknown",
										),
									],
									[
										"Bot Uptime",
										`<t:${Math.round(Date.now() / 1000) - Math.floor(process.uptime())}:R>`,
									],
									["Total XP", format(totalXP)],
									["Member Count", format(memberCount)],
									["Members Stored", format(membersStored)],
									["Level Ups", format(levelUps)],
									["Date Created", dateCreated],
								]}
							/>
						</Card>
					</Message>,
				),
			),
		);
	},
});

export const format = (val: string | bigint | number) => {
	if (typeof val === "string") {
		return `\`${val}\``;
	} else {
		const format = Intl.NumberFormat("en-US", {
			maximumFractionDigits: 2,
			minimumFractionDigits: 0,
			style: "decimal",
		});
		return `\`${format.format(val)}\``;
	}
};

export default InfoCommand;
