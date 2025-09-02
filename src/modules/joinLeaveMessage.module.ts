import type {
	Client,
	GuildMember,
	PartialGuildMember,
	TextChannel,
} from "discord.js";
import { config } from "../Config.js";
import { logger } from "../logging.js";
import { branding } from "../util/branding.js";
import { createStandardEmbed } from "../util/embeds.js";
import { awaitTimeout } from "../util/timeouts.js";
import { fakeMention } from "../util/users.js";
import type Module from "./module.js";

const handler =
	(isAdding: boolean) =>
	async (client: Client, member: PartialGuildMember | GuildMember) => {
		const channel = (await client.channels.fetch(
			config.channels.welcome,
		)) as TextChannel;
		if (!channel) {
			logger.error("Could not find welcome channel");
			return;
		}
		await awaitTimeout(1000);
		await client.users.fetch(member.id);
		await channel.send({
			embeds: [
				createStandardEmbed(member)
					.setTitle(`members${isAdding ? "++" : "--"};`)
					.setDescription(
						isAdding
							? branding.welcomeMessage(member)
							: branding.goodbyeMessage(member),
					)
					.setColor(isAdding ? "#77dd77" : "#aa4344")
					.setThumbnail(
						member.user.avatarURL() ??
							"https://cdn.discordapp.com/embed/avatars/0.png",
					)
					.setAuthor({
						name: fakeMention(member.user),
					}),
			],
		});
	};

export const JoinLeaveMessageModule: Module = {
	name: "joinLeaveMessage",
	listeners: [
		{
			guildMemberAdd: handler(true),
			guildMemberRemove: handler(false),
		},
	],
};

export default JoinLeaveMessageModule;
