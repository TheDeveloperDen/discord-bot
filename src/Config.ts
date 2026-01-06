import { config as prodConfig } from "./Config.prod.js";
import type { Config } from "./config.type.js";
import { actualMention } from "./util/users.js";

// Config file for the DevDen Testing server
const devConfig: Config = {
	channels: {
		welcome: "932633680634081301",
		botCommands: "906954540039938048",
		hotTake: "904478147351806015",
		showcase: "952536628533030942",
		auditLog: "994623474557538415",
		modLog: "994623474557538415",
		general: "904478147351806015",
		leaderboard: "904478147351806015",
	},
	starboard: {
		emojiId: "⭐",
		channel: "1407366658552631296",
		threshold: 1,
		blacklistChannelIds: ["904478147351806015"],
	},
	commands: {
		daily: "1029850807794937949",
	},
	deletedMessageLog: {
		cacheTtlMs: 1000 * 60 * 60 * 24,
		excludedChannels: [],
	},
	roles: {
		tiers: [
			"904478147351806012", // @everyone (tier 0)
			"932637161528909865", // tier 1
			"932637187030257694", // tier 2
		],
		admin: "932644914066501652",
		staff: "932644914066501652",
		separators: {
			general: "932638046153744434",
			tags: "932638097311666218",
			langs: "932638149618835466",
		},
		noPing: "932637353263128577",
		zooExhibit: "1432483356393734194",
	},
	clientId: "932387188585398353",
	guildId: "904478147351806012",
	poll: {
		emojiId: "skull",
		yesEmojiId: "thumbsup",
		noEmojiId: "thumbsdown",
	},
	suggest: {
		suggestionsChannel: "1407001821674868746",
		archiveChannel: "1407001847239016550",
		yesEmojiId: "👍",
		noEmojiId: "👎",
	},
	threatDetection: {
		enabled: true,
		alertChannel: "1432483525155623063",
		scamLinks: {
			enabled: true,
			blockShorteners: true,
			useExternalApi: true,
		},
	},
	modmail: {
		pingRole: "1412470653050818724",
		archiveChannel: "1412470199495561338",
		channel: "1412470223004766268",
	},
	pastebin: prodConfig.pastebin,
	branding: {
		color: "#ffffff",
		font: "CascadiaCode.ttf",
		welcomeMessage: (member) =>
			`Welcome ${actualMention(
				member,
			)} to the Developer Den test server!\nCurrent Member Count: ${member.guild.memberCount}`,
		goodbyeMessage: (member) =>
			`Goodbye ${actualMention(
				member,
			)} from the Developer Den test server!\nCurrent Member Count: ${member.guild.memberCount}`,
	},

	informationMessage: prodConfig.informationMessage,
};

const isProd = process.env.NODE_ENV === "production";

export const config: Config = isProd ? prodConfig : devConfig;
