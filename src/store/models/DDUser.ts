import { inChildOf, inTransactionWith, wrapInTransactionWith } from '../../sentry.js'
import { logger } from '../../logging.js'
import { AllowNull, Column, DataType, Model, PrimaryKey, Table } from 'sequelize-typescript'
import { REAL_BIGINT } from '../RealBigInt.js'
import { Optional, SaveOptions } from 'sequelize'

interface DDUserAttributes {
  id: bigint
  xp: bigint
  level: number
  bumps: number
  currentDailyStreak: number
  highestDailyStreak: number
  lastDailyTime?: Date
}

interface DDUserCreationAttributes extends Optional<DDUserAttributes, 'id'> {}

@Table({
  tableName: 'Users'
})
export class DDUser extends Model<DDUserAttributes, DDUserCreationAttributes> {
  @PrimaryKey
  @Column({ type: REAL_BIGINT })
  declare public id: bigint

  @Column(REAL_BIGINT)
  declare public xp: bigint

  @Column(new DataType.INTEGER({ length: 11 }))
  declare public level: number

  @Column(new DataType.INTEGER({ length: 11 }))
  declare public bumps: number

  @Column(new DataType.INTEGER())
  declare public currentDailyStreak: number

  @Column(new DataType.INTEGER())
  declare public highestDailyStreak: number

  @AllowNull
  @Column(new DataType.DATE())
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
  (id) => {
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
          id: BigInt(id),
          xp: BigInt(0),
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
