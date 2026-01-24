import type Module from "../module.js";
import { BanCommand } from "./ban.command.js";
import { DeletedMessagesListener } from "./deletedMessages.listener.js";
import { InviteListeners } from "./discordInvitesMonitor.listener.js";
import { KickCommand } from "./kick.command.js";
import { PardonCommand } from "./pardon.command.js";
import { ReputationCommand } from "./reputation.command.js";
import { SoftBanCommand } from "./softBan.command.js";
import { TempBanCommand } from "./tempBan.command.js";
import { TempBanListener } from "./tempBan.listener.js";
import { UnbanCommand } from "./unban.command.js";
import { WarnCommand } from "./warn.command.js";
import { WarningSchedulerListener } from "./warningScheduler.listener.js";
import { WarningsCommand } from "./warnings.command.js";
import { WordlistCommand } from "./wordlist.command.js";
import { ZookeepCommand } from "./zookeep.command.js";

export const ModerationModule: Module = {
	name: "moderation",
	commands: [
		BanCommand,
		UnbanCommand,
		SoftBanCommand,
		TempBanCommand,
		KickCommand,
		ZookeepCommand,
		WarnCommand,
		WarningsCommand,
		PardonCommand,
		WordlistCommand,
		ReputationCommand,
	],
	listeners: [
		...InviteListeners,
		TempBanListener,
		WarningSchedulerListener,
		DeletedMessagesListener,
	],
};
