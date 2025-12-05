import type { Snowflake } from "discord.js";
import type { InformationMessage } from "./modules/information/information.js";
import type { BrandingConfig } from "./util/branding.js";

export interface Config {
	guildId: string;
	clientId: string;
	poll?: {
		emojiId: string;
		yesEmojiId: string;
		noEmojiId: string;
	};
	pastebin: { url: string; threshold: number };
	channels: {
		welcome: string;
		botCommands: string;
		hotTake: string;
		showcase: string;
		auditLog: string;
		modLog: string;
		introductions?: string;
		general: string;
		leaderboard?: string;
	};
	starboard: {
		emojiId: string;
		channel: string;
		threshold: number;
		blacklistChannelIds?: Snowflake[];
	};
	suggest: {
		suggestionsChannel: string;
		archiveChannel: string;
		yesEmojiId: string;
		noEmojiId: string;
	};
	commands: {
		daily: Snowflake;
	};
	roles: {
		tiers: Snowflake[];
		admin: Snowflake;
		notable?: Snowflake;
		staff: Snowflake;
		separators: { general: Snowflake; tags: Snowflake; langs: Snowflake };
		noPing: Snowflake;
		bumpNotifications?: Snowflake;
		zooExhibit?: Snowflake;
	};
	modmail: {
		channel: string;
		archiveChannel: string;
		pingRole?: Snowflake;
	};
	branding: BrandingConfig;
	informationMessage?: InformationMessage;
}
