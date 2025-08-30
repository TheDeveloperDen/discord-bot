import type {
  APIInteractionDataResolvedGuildMember,
  GuildMember,
} from "discord.js";

export function getResolvedMember(
  member:
    | GuildMember
    | APIInteractionDataResolvedGuildMember
    | undefined
    | null,
): GuildMember | undefined {
  if (!member) {
    return undefined;
  }

  if ("user" in member) {
    return member;
  }
  return undefined;
}
