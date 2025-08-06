import {
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute,
  Op,
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

export const getAllBumps = async (): Promise<Bump[]> =>
  await Sentry.startSpan({ name: "getAllBumps" }, async () => {
    return await Bump.findAll({
      order: [["timestamp", "DESC"]],
    });
  });

export type Streak = {
  current: number;
  highest: number;
};

export const getBumpStreak = async (user: DDUserType): Promise<Streak> =>
  await Sentry.startSpan({ name: "getBumpStreak" }, async () => {
    // first, retrieve the 50 most recent bumps
    const bumps = await Bump.findAll({
      order: [["timestamp", "DESC"]],
      limit: 50,
    });

    const streaks = extractStreaks(bumps);

    // if the earliest (i.e. last) streak is from the user, we need to potentially search further
    while (
      streaks.length > 0 &&
      streaks[streaks.length - 1]![0]!.userId === user.id
    ) {
      const earliestBump = streaks[streaks.length - 1]![0]!;
      const earliestBumpDate = earliestBump.timestamp;

      const additionalBumps = await Bump.findAll({
        where: {
          userId: user.id,
          timestamp: {
            [Op.lt]: earliestBumpDate,
          },
        },
        order: [["timestamp", "DESC"]],
        limit: 50,
      });
      if (additionalBumps.length > 0) {
        streaks.push(additionalBumps);
      }
    }

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

export const extractStreaks = (bumps: Bump[]): Bump[][] => {
  // group by same user
  const streaks: Bump[][] = [];

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
};

import { DDUser } from "./DDUser.js";
