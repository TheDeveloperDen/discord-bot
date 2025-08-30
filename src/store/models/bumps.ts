import { Bump } from "./Bump.js";
import * as Sentry from "@sentry/node";
import type { DDUser } from "./DDUser.js";
import { logger } from "../../logging.js";

/**

 * @returns All bumps in ascending order of timestamp.
 */
export const getAllBumps = async (): Promise<Bump[]> =>
  await Sentry.startSpan({ name: "getAllBumps" }, async () => {
    if (
      bumpsCache.bumps.length > 0 &&
      new Date().getTime() - bumpsCache.lastUpdated.getTime() < 1000 * 60 * 60 // 1 hour to be safe
    ) {
      logger.debug("Using cached bumps");
      return bumpsCache.bumps;
    }
    const bumps = await Bump.findAll({
      order: [["timestamp", "ASC"]],
    });
    bumpsCache.bumps = bumps;
    bumpsCache.lastUpdated = new Date();
    return bumps;
  });

export type Streak = {
  current: number;
  highest: number;
};

const bumpsCache: {
  bumps: Bump[];
  lastUpdated: Date;
} = {
  bumps: [],
  lastUpdated: new Date(),
};

export const getBumpStreak = async (user: DDUser): Promise<Streak> =>
  await Sentry.startSpan({ name: "getBumpStreak" }, async () => {
    // query every bump. TODO optimise
    const bumps = await getAllBumps();

    const streaks = extractStreaks(bumps);

    return getStreak(user.id, streaks);
  });

/**
 * Turns a list of bump streaks into a list of user IDs and their streaks.
 * This will preserve the order of the streaks.
 * @param bumpStreaks  A list of bump streaks.
 * @returns An associative array of user IDs and their streaks, which may contain user IDs.
 */
export function getStreaks(bumpStreaks: { userId: bigint }[][]): ({
  userId: bigint;
} & Streak)[] {
  const maxStreakMap = new Map<bigint, number>();
  const streaks: ({
    userId: bigint;
  } & Streak)[] = [];
  for (const streak of bumpStreaks) {
    const userId = streak[0]!.userId;
    const currentStreak = streak.length;
    const highestStreak = maxStreakMap.get(userId) ?? 0;
    maxStreakMap.set(userId, Math.max(highestStreak, currentStreak));
    streaks.push({
      userId,
      current: currentStreak,
      highest: Math.max(highestStreak, currentStreak),
    });
  }
  return streaks;
}

export function getStreak(
  userId: bigint,
  bumpStreaks: { userId: bigint }[][],
): Streak {
  // now search through the streaks for the user's bumps
  let currentStreak = 0;
  let highestStreak = 0;
  for (const streak of bumpStreaks) {
    if (streak[0]!.userId === userId) {
      currentStreak += streak.length;
    } else {
      highestStreak = Math.max(highestStreak, currentStreak);
      currentStreak = 0;
    }
    highestStreak = Math.max(highestStreak, currentStreak);
  }
  return {
    current: currentStreak,
    highest: highestStreak,
  };
}

export function extractStreaks<T extends { userId: bigint }>(
  bumps: T[],
): T[][] {
  // group by same user
  const streaks: T[][] = [];

  for (const bump of bumps) {
    if (
      streaks.length === 0 ||
      streaks[streaks.length - 1]![0]!.userId !== bump.userId
    ) {
      streaks.push([bump]);
    } else {
      streaks[streaks.length - 1]!.push(bump);
    }
  }
  return streaks;
}

export const clearBumpsCache = () => {
  bumpsCache.bumps = [];
  bumpsCache.lastUpdated = new Date(0);
};
