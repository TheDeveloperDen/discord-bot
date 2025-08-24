import * as Sentry from "@sentry/node";
import { compose } from "../../util/functions.js";
import { compareTwoStrings as distance } from "string-similarity";
import { Channel, GuildMember, Message, User } from "discord.js";
import { Config } from "../../config.type.js";
import { logger } from "../../logging.js";
import { config } from "../../Config.js";
import { getOrCreateUserById } from "../../store/models/DDUser.js";
import { levelUp } from "./xpRoles.util.js";

const pingRegex = /<[a-zA-Z0-9@:&!#]+?[0-9]+>/g;

const punctuationRegex = /[.?,!\-'"` ]/g;
const stripPunctuation = (message: string) =>
  message.replace(punctuationRegex, "");

const stripPings = (message: string) => message.replace(pingRegex, "");
const strip = compose(stripPunctuation, stripPings);

export const xpForLevel = (level: number): bigint =>
  BigInt(Math.floor(level ** 3 + 27 * level ** 2 + 125 * level));

export const getTierByLevel = (level: number): number =>
  level === 0 ? 0 : Math.floor(level / 10) + 1;

function findForward(input: string, index: number, set: Set<string>): number {
  let current = "";
  while (set.has(current) && index < input.length) {
    current = current.concat(input[index]!);
    index++;
  }
  set.add(current);
  return current.length;
}

function compressibility(input: string): number {
  input = input.toLowerCase();
  const things = new Set<string>();
  things.add("");
  let cut = 0;
  let i = 0;
  while (i < input.length) {
    const length = Math.max(findForward(input, i, things) - 1, 0);
    cut += length;
    i += length + 1;
  }
  return cut / input.length;
}

export function xpForMessage(message: string) {
  const length = strip(message).length;
  return Math.round(
    (1 - compressibility(message)) * Math.tanh(length / 3) +
      Math.pow(length, 0.75),
  );
}

const similarityProportion = (a: string, b: string) => distance(a, b);
const minMessageLength = 6;
const maxSimilarity = 0.6;

export async function shouldCountForStats(
  author: User,
  message: Message,
  channel: Channel,
  config: Config,
) {
  if (
    author.bot ||
    channel.id === config.channels.botCommands ||
    message.content.length < minMessageLength
  ) {
    return false;
  }

  const messages = message.channel.messages.cache.last(3);
  if (messages == null) {
    return true;
  }
  if (messages instanceof Message) {
    return true; // this probably won't happen
  }
  for (const msg of messages) {
    if (msg.author.id !== author.id || msg.id === message.id) continue;
    if (similarityProportion(msg.content, message.content) > maxSimilarity) {
      logger.debug(
        `Discarded message ${message.id} from user ${author.id} because it was too similar to previous messages`,
      );
      return false;
    }
  }
  const asArray = message.content.split("");
  return asArray.some((it) => it.match(/[a-z ]/i));
}

export const tierOf = (level: number) =>
  level <= 0 ? 0 : 1 + Math.floor(level / 10);

export function tierRoleId(level: number): string {
  const tier = tierOf(level);
  if (tier < config.roles.tiers.length) return config.roles.tiers[tier]!;
  return config.roles.tiers[config.roles.tiers.length - 1]!;
}

/**
 * Result of giving a member XP
 * @param xpGiven The amount of XP given
 * @param multiplier The multiplier used. If undefined, no multiplier was used, i.e. the multiplier was 1
 */
export interface XPResult {
  xpGiven: number;
  multiplier?: number;
}

/**
 * Gives XP to a member
 * @param user the member to give XP to
 * @param xp the amount of XP to give
 * @returns How much XP was given. This may be affected by perks such as boosting. If something went wrong, -1 will be returned.
 */
export const giveXp = async (
  user: GuildMember,
  xp: number,
): Promise<XPResult> =>
  await Sentry.startSpan(
    { name: "giveXP", attributes: { user: user.id, xp } },

    async (): Promise<XPResult> => {
      const client = user.client;
      const ddUser = await getOrCreateUserById(BigInt(user.id));

      const multiplier = user.premiumSince != null ? 2 : 1;
      ddUser.xp += BigInt(xp * multiplier);
      await Promise.all([levelUp(client, user, ddUser), ddUser.save()]);
      logger.info(`Gave ${xp} XP to user ${user.id}`);
      return {
        xpGiven: xp,
        multiplier: multiplier === 1 ? undefined : multiplier,
      }; // A multiplier of 1 means no multiplier was used
    },
  );
