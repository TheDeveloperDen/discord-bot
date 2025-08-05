import {
  ColorResolvable,
  EmbedBuilder,
  EmbedFooterOptions,
  GuildMember,
  PartialGuildMember,
} from "discord.js";
import { branding } from "./branding.js";

export function createStandardEmbed(
  user?: GuildMember | PartialGuildMember,
): EmbedBuilder {
  const builder = new EmbedBuilder();
  builder.setColor(
    user?.roles?.color?.hexColor ?? (branding.color as ColorResolvable),
  );
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
