import {
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute,
} from "@sequelize/core";
import {
  Attribute,
  BelongsTo,
  Index,
  NotNull,
  PrimaryKey,
  Table,
} from "@sequelize/core/decorators-legacy";
import { RealBigInt } from "../RealBigInt.js";
import type { DDUser as DDUserType } from "./DDUser.js";
import * as Sentry from "@sentry/node";

@Table
export class Bump extends Model<
  InferAttributes<Bump>,
  InferCreationAttributes<Bump>
> {
  @Attribute(RealBigInt)
  @PrimaryKey
  @NotNull
  declare public messageId: bigint;

  @Attribute(RealBigInt)
  @NotNull
  declare public userId: bigint;

  @BelongsTo(() => DDUser, "userId")
  declare public user: NonAttribute<ReturnType<() => DDUserType>>;

  @Attribute(DataTypes.DATE)
  @NotNull
  @Index
  declare public timestamp: Date;
}

/**

 * @returns All bumps in ascending order of timestamp.
 */
export const getAllBumps = async (): Promise<Bump[]> =>
  await Sentry.startSpan({ name: "getAllBumps" }, async () => {
    if (
      bumpsCache.bumps.length > 0 &&
      new Date().getTime() - bumpsCache.lastUpdated.getTime() < 1000 * 60 * 60 // 1 hour to be safe
    ) {
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

export const getBumpStreak = async (user: DDUserType): Promise<Streak> =>
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
 * @returns A map of user IDs to their streaks.
 */
export function getStreaks(bumpStreaks: { userId: bigint }[][]): ({
  userId: bigint;
} & Streak)[] {
  const streakMap = new Map<bigint, Streak>();
  for (const streak of bumpStreaks) {
    const userId = streak[0]!.userId;
    const currentStreak = streak.length;
    const highestStreak = streakMap.get(userId)?.highest ?? 0;
    streakMap.set(userId, {
      current: currentStreak,
      highest: Math.max(highestStreak, currentStreak),
    });
  }
  return Array.from(streakMap.entries()).map(([userId, streak]) => ({
    userId,
    ...streak,
  }));
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

import { DDUser } from "./DDUser.js";
