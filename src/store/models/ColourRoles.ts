import { Column, Model, Table } from 'sequelize-typescript'
import { REAL_BIGINT } from '../RealBigInt.js'

@Table({
  tableName: 'RoleColours'
})
export class ColourRoles extends Model {
  @Column({
    type: REAL_BIGINT,
    primaryKey: true
  })
  declare public id: bigint

  @Column({
    type: REAL_BIGINT,
    allowNull: false,
    field: 'colourRole'
  })
  public role!: bigint
}
