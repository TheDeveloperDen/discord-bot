import { Message, renderDiscordMessage } from "disjsx";
import { defineCommand, option } from "../../commands/index.js";
import { getOrCreateUserById } from "../../store/models/DDUser.js";
import { memberAuthor } from "../../ui/index.js";
import { getActualDailyStreak } from "./dailyReward.command.js";
import { ProfileCard } from "./xp.cards.js";
import { tierRoleId } from "./xpForMessage.util.js";

export const XpCommand = defineCommand({
	name: "xp",
	description: "Show a member's XP",
	options: {
		member: option.member({
			description: "The member to show XP for",
		}),
	},

	async handle(interaction, { member = interaction.member }) {
		await interaction.deferReply();
		const ddUser = await getOrCreateUserById(BigInt(member.id));
		const [currentStreak, bumps] = await Promise.all([
			getActualDailyStreak(ddUser),
			ddUser.countBumps(),
		]);
		await interaction.followUp({
			...renderDiscordMessage(
				<Message isV2>
					<ProfileCard
						author={memberAuthor(member)}
						level={ddUser.level}
						xp={ddUser.xp}
						currentStreak={currentStreak}
						highestStreak={ddUser.highestDailyStreak}
						bumps={bumps}
						tierRole={tierRoleId(ddUser.level)}
					/>
				</Message>,
			),
			allowedMentions: { parse: [] },
		});
	},
});
