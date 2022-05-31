import {Column, DataType, Model, Table} from 'sequelize-typescript'

@Table({
	tableName: 'FAQs'
})
export class FAQ extends Model {
	@Column({
		type: new DataType.BIGINT({length: 20}),
		primaryKey: true,
		autoIncrement: true
	})
	public id!: bigint

	@Column({
		type: new DataType.BIGINT({length: 20})
	})
	public author!: bigint

	@Column({
		type: new DataType.STRING(36)
	})
	public name!: string

	@Column({
		type: new DataType.STRING(64)
	})
	public title!: string

	@Column({
		type: new DataType.TEXT('long')
	})
	public content!: string
}