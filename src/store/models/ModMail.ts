import { Column, DataType, Model, Table } from 'sequelize-typescript'

@Table({
  tableName: 'FAQs'
})
export class ModMailEntry extends Model {
  @Column({
    type: new DataType.BIGINT({ length: 20 }),
    primaryKey: true,
    autoIncrement: true
  })
  declare public id: bigint

  @Column({
    type: new DataType.BIGINT({ length: 20 })
  })
  declare public author: bigint

  @Column({
    type: new DataType.STRING(36)
  })
  declare public name: string

  @Column({
    type: new DataType.STRING(64)
  })
  declare public title: string

  @Column({
    type: new DataType.TEXT('long')
  })
  declare public content: string
}
