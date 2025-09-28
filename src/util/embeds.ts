import {
	type ColorResolvable,
	EmbedBuilder,
	type EmbedFooterOptions,
	type GuildMember,
	type PartialGuildMember,
	type User,
	type UserResolvable,
} from "discord.js";
import { branding } from "./branding.js";

export function createStandardEmbed(
	user?: GuildMember | PartialGuildMember | User | UserResolvable,
): EmbedBuilder {
	const builder = new EmbedBuilder();
	if (user && typeof user === "object" && "roles" in user) {
		builder.setColor(
			user?.roles?.color?.hexColor ?? (branding.color as ColorResolvable),
		);
	} else {
		builder.setColor(branding.color as ColorResolvable);
	}
	const options = standardFooter();
	builder.setFooter(options);
	builder.setTimestamp(new Date());
	return builder;
}

export const standardFooter = (): EmbedFooterOptions => {
	const b = branding;
	if (b.name === "" || b.iconUrl === "")
		throw new Error("Branding name is empty. Have we finished initialising?");
	return {
		text: b.name,
		iconURL: b.iconUrl,
	};
};
