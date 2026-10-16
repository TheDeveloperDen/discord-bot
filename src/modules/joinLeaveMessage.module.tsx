import type {
	Client,
	GuildMember,
	PartialGuildMember,
	TextChannel,
} from "discord.js";
import { Message, renderDiscordMessage } from "disjsx";
import { config } from "../Config.js";
import { logger } from "../logging.js";
import { Card, withoutPings } from "../ui/index.js";
import { branding } from "../util/branding.js";
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
		await channel.send(
			withoutPings(
				renderDiscordMessage(
					<Message isV2>
						<Card
							accent={isAdding ? "#77dd77" : "#aa4344"}
							title={`members${isAdding ? "++" : "--"};`}
							author={{
								name: fakeMention(member.user),
								iconUrl:
									member.user.avatarURL() ??
									"https://cdn.discordapp.com/embed/avatars/0.png",
							}}
							description={
								isAdding
									? branding.welcomeMessage(member)
									: branding.goodbyeMessage(member)
							}
						/>
					</Message>,
				),
			),
		);
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
