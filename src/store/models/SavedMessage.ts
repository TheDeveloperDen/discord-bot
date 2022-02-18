import {Column, DataType, Model, Table} from 'sequelize-typescript'


@Table({
	timestamps: false,
	tableName: 'Messages'
})
export class SavedMessage extends Model {
	@Column({
		type: DataType.INTEGER,
		primaryKey: true,
		autoIncrement: true
	})

	declare public id: bigint

	@Column(DataType.DATE(6))
	public timestamp!: Date

	@Column(DataType.BIGINT({length: 20}))
	public user_id!: bigint

	@Column(DataType.BIGINT({length: 20}))
	public message_id!: bigint

	@Column(DataType.BIGINT({length: 20}))
	public channel_id!: bigint

	@Column(DataType.TEXT({length: 'long'}))
	public content!: string

	@Column(DataType.STRING({length: 10}))
	public type!: string
}