import { Column, DataType, Model, Table } from 'sequelize-typescript'
import { SaveOptions } from 'sequelize'
import { inChildOf, inTransactionWith, wrapInTransactionWith } from '../../sentry.js'

@Table({
  tableName: 'Users'
})
export class DDUser extends Model {
  @Column({
    type: new DataType.BIGINT({ length: 20 }),
    primaryKey: true
  })
  declare public id: bigint

  @Column({
    type: new DataType.BIGINT({ length: 20 })
  })
  declare public xp: number

  @Column({
    type: new DataType.INTEGER({ length: 11 })
  })
  declare public level: number

  @Column({
    type: new DataType.INTEGER({ length: 11 })
  })
  declare public bumps: number

  @Column({
    type: new DataType.INTEGER({ length: 11 })
  })
  declare public currentDailyStreak: number

  @Column({
    type: new DataType.INTEGER({ length: 11 })

  })
  declare public highestDailyStreak: number

  @Column({
    type: new DataType.DATE(),
    allowNull: true
  })
  declare public lastDailyTime?: Date

  async save (options?: SaveOptions): Promise<this> {
    return await inTransactionWith('DDUser#save', {
      data: {
        id: this.id.toString(),
        options: JSON.stringify(options)
      }
    },
    async () => {
      return await super.save(options)
    })
  }
}

export const getOrCreateUserById = wrapInTransactionWith(
  'getOrCreateUserById',
  (id) => { return { data: { id: id.toString() } } },
  async (transaction, id: bigint) => {
    const inCache = userCache.get(id)
    if (inCache != null) {
      const [lastUpdated, user] = inCache
      if (new Date().getTime() - lastUpdated.getTime() < 1000 * 60 * 5) {
        return user
      }
      await user.reload()
      userCache.set(id, [new Date(), user])
      return user
    }

    return await inChildOf(transaction, 'DDUser.findOrCreate', {
      data: { id: id.toString() }
    }, async () => {
      const [user] = await DDUser.findOrCreate({
        where: {
          id
        },
        defaults: {
          id,
          xp: 0,
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
  })

const userCache = new Map<bigint, [Date, DDUser]>()
