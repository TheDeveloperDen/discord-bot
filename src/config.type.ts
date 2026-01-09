import type { Snowflake } from "discord.js";
import type { InformationMessage } from "./modules/information/information.js";
import type { BrandingConfig } from "./util/branding.js";

export interface ThreatDetectionConfig {
	enabled: boolean;
	alertChannel?: Snowflake;
	exemptRoles?: Snowflake[];
	scamLinks?: {
		enabled: boolean;
		useExternalApi?: boolean;
		blockShorteners?: boolean;
		safeDomains?: string[];
	};
	spam?: {
		enabled: boolean;
		maxMessagesPerWindow: number;
		windowSeconds: number;
		duplicateThreshold: number;
		action: "delete" | "mute";
		muteDuration?: number;
	};
	raid?: {
		enabled: boolean;
		maxJoinsPerWindow: number;
		windowSeconds: number;
		action: "alert" | "lockdown" | "kick_new";
		newAccountThreshold: number;
	};
	mentionSpam?: {
		enabled: boolean;
		maxMentionsPerMessage: number;
		maxMentionsPerWindow: number;
		windowSeconds: number;
		action: "delete" | "mute";
	};
	toxicContent?: {
		enabled: boolean;
		detectBypasses: boolean;
		action: "flag" | "delete";
	};
	suspiciousAccounts?: {
		enabled: boolean;
		minAgeDays: number;
		flagDefaultAvatar: boolean;
		flagSuspiciousNames: boolean;
		suspiciousNamePatterns?: string[];
		action: "flag" | "kick";
	};
	escalation?: {
		warningsBeforeMute: number;
		mutesBeforeKick: number;
		scoreDecayRate: number;
	};
}

export interface Config {
	guildId: string;
	clientId: string;
	poll?: {
		emojiId: string;
		yesEmojiId: string;
		noEmojiId: string;
	};
  devbin: {
    url: string;
    api_url: string;
    threshold: number
  };
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
	deletedMessageLog?: {
		/** Cache TTL in milliseconds (default: 24 hours) */
		cacheTtlMs?: number;
		/** Additional channel IDs to exclude from tracking (mod channels auto-excluded) */
		excludedChannels?: Snowflake[];
	};
	branding: BrandingConfig;
	informationMessage?: InformationMessage;
	threatDetection?: ThreatDetectionConfig;
	reputation?: {
		enabled: boolean;
		warningThresholds: {
			muteAt: number;
			muteDuration: string;
			banAt: number;
		};
		warningExpiration: {
			minor: string;
			moderate: string;
			severe: string;
		};
		scoreVisibility: "public" | "mods-only" | "self-only";
		allowAppeals: boolean;
		appealCooldown: string;
	};
}
