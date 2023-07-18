import { inChildOf, inTransactionWith, wrapInTransactionWith } from '../../sentry.js'
import { logger } from '../../logging.js'
import {
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  SaveOptions
} from '@sequelize/core'
import { AllowNull, Attribute, NotNull, PrimaryKey, Table } from '@sequelize/core/decorators-legacy'
import { RealBigInt } from '../RealBigInt.js'

@Table({ tableName: 'Users' })
export class DDUser extends Model<InferAttributes<DDUser>, InferCreationAttributes<DDUser>> {
  @Attribute(RealBigInt)
  @PrimaryKey
  @NotNull
  declare public id: bigint

  @Attribute(RealBigInt)
  @NotNull
  declare public xp: bigint

  @Attribute(DataTypes.INTEGER({ length: 11 }))
  declare public level: number

  @Attribute(DataTypes.INTEGER({ length: 11 }))
  declare public bumps: number

  @Attribute(DataTypes.INTEGER)
  declare public currentDailyStreak: number

  @Attribute(DataTypes.INTEGER)
  declare public highestDailyStreak: number

  @AllowNull
  @Attribute(DataTypes.DATE)
  declare public lastDailyTime?: Date

  async save (options?: SaveOptions): Promise<this> {
    return await inTransactionWith('DDUser#save', {
      data: {
        id: this.id,
        options
      }
    }, async () => {
      return await super.save(options)
    })
  }

  async reload (options?: SaveOptions): Promise<this> {
    return await inTransactionWith('DDUser#reload', {
      data: {
        id: this.id,
        options
      }
    }, async () => {
      return await super.reload(options)
    })
  }
}

export const getOrCreateUserById = wrapInTransactionWith(
  'getOrCreateUserById',
  (id: bigint) => {
    return { data: { id: id.toString() } }
  },
  async (transaction, id: bigint) => {
    const inCache = userCache.get(id)
    if (inCache != null) {
      logger.debug(`Found user ${id} in cache`)
      const [lastUpdated, user] = inCache
      if (new Date().getTime() - lastUpdated.getTime() < 1000 * 60 * 5) {
        return user
      }
      logger.debug(
        `User ${id} is stale (last updated at ${lastUpdated.toLocaleString()}), reloading`)
      await user.reload()
      userCache.set(id, [new Date(), user])
      return user
    }

    logger.debug(`User ${id} not found in cache, querying database`)
    return await inChildOf(transaction, 'DDUser.findOrCreate', {
      data: { id }
    }, async () => {
      const [user] = await DDUser.findOrCreate<DDUser>({
        where: {
          id
        },
        defaults: {
          id,
          xp: 0n,
          level: 0,
          bumps: 0,
          currentDailyStreak: 0,
          highestDailyStreak: 0
        },
        benchmark: true
      })
      userCache.set(id, [new Date(), user])
      return user
    })
  }
)

const userCache = new Map<bigint, [Date, DDUser]>()
