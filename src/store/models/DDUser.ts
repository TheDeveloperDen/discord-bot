import { logger } from "../../logging.js";
import {
  DataTypes,
  type InferAttributes,
  type InferCreationAttributes,
  Model,
  type SaveOptions,
} from "@sequelize/core";
import {
  AllowNull,
  Attribute,
  NotNull,
  PrimaryKey,
  Table,
} from "@sequelize/core/decorators-legacy";
import { RealBigInt } from "../RealBigInt.js";
import * as Sentry from "@sentry/node";
import { Bump } from "./Bump.js";

@Table({ tableName: "Users" })
export class DDUser extends Model<
  InferAttributes<DDUser>,
  InferCreationAttributes<DDUser>
> {
  @Attribute(RealBigInt)
  @PrimaryKey
  @NotNull
  declare public id: bigint;

  @Attribute(RealBigInt)
  @NotNull
  declare public xp: bigint;

  @Attribute(DataTypes.INTEGER({ length: 11 }))
  declare public level: number;

  @Attribute(DataTypes.INTEGER({ length: 11 }))
  declare public bumps: number;

  @Attribute(DataTypes.INTEGER)
  declare public currentDailyStreak: number;

  @Attribute(DataTypes.INTEGER)
  declare public highestDailyStreak: number;

  @AllowNull
  @Attribute(DataTypes.DATE)
  declare public lastDailyTime: Date | null;

  override async save(options?: SaveOptions): Promise<this> {
    return await Sentry.startSpan(
      {
        name: "DDUser#save",
        attributes: {
          id: this.id.toString(),
        },
      },
      async () => {
        return await super.save(options);
      },
    );
  }

  override async reload(options?: SaveOptions): Promise<this> {
    return await Sentry.startSpan(
      {
        name: "DDUser#reload",
        attributes: {
          id: this.id.toString(),
        },
      },
      async () => {
        return await super.reload(options);
      },
    );
  }

  async countBumps(): Promise<number> {
    return await Sentry.startSpan(
      { name: "DDUser#bumps", attributes: { id: this.id.toString() } },
      async () => {
        logger.debug(`Getting bumps for user ${this.id}`);
        const newBumpCount = await Bump.count({
          where: {
            userId: this.id,
          },
        });
        return newBumpCount + this.bumps;
      },
    );
  }
}

export const getOrCreateUserById = async (id: bigint) =>
  await Sentry.startSpan(
    { name: "getOrCreateUserById", attributes: { id: id.toString() } },
    async () => {
      const inCache = userCache.get(id);
      if (inCache != null) {
        logger.debug(`Found user ${id} in cache`);
        const [lastUpdated, user] = inCache;
        if (new Date().getTime() - lastUpdated.getTime() < 1000 * 60 * 5) {
          return user;
        }
        logger.debug(
          `User ${id} is stale (last updated at ${lastUpdated.toLocaleString()}), reloading`,
        );
        await user.reload();
        userCache.set(id, [new Date(), user]);
        return user;
      }

      logger.debug(`User ${id} not found in cache, querying database`);
      return await Sentry.startSpan(
        { name: "DDUser.findOrCreate", attributes: { id: id.toString() } },
        async () => {
          const [user] = await DDUser.findOrCreate<DDUser>({
            where: {
              id,
            },
            defaults: {
              id,
              xp: 0n,
              level: 0,
              bumps: 0,
              currentDailyStreak: 0,
              highestDailyStreak: 0,
            },
            benchmark: true,
          });
          userCache.set(id, [new Date(), user]);
          return user;
        },
      );
    },
  );

const userCache = new Map<bigint, [Date, DDUser]>();

export const clearUserCache = () => {
  userCache.clear();
};
