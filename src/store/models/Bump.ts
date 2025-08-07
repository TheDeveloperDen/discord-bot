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
    return await Bump.findAll({
      order: [["timestamp", "ASC"]],
    });
  });

export type Streak = {
  current: number;
  highest: number;
};

export const getBumpStreak = async (user: DDUserType): Promise<Streak> =>
  await Sentry.startSpan({ name: "getBumpStreak" }, async () => {
    // query every bump. TODO optimise
    const bumps = await Bump.findAll({
      order: [["timestamp", "ASC"]],
    });

    const streaks = extractStreaks(bumps);

    return getStreak(user.id, streaks);
  });

export function getStreak(
  userId: bigint,
  bumpStreaks: { userId: bigint }[][],
): Streak {
  // now search through the streaks for the user's bumps
  let currentStreak = 0;
  let highestStreak = 0;
  for (const streak of bumpStreaks) {
    console.debug(`Streak for user ${userId}:`, streak);

    if (streak[0]!.userId === userId) {
      currentStreak += streak.length;
      console.debug(`Current streak for user ${userId}:`, currentStreak);
    } else {
      highestStreak = Math.max(highestStreak, currentStreak);
      console.debug(
        `Reset current streak for user at ${userId}:`,
        currentStreak,
      );
      currentStreak = 0;
    }
    highestStreak = Math.max(highestStreak, currentStreak);
    console.debug(`Highest streak for user ${userId}:`, highestStreak);
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
