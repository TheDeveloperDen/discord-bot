import {Column, DataType, Model, Table} from 'sequelize-typescript'


@Table({
	tableName: 'Users'
})
export class DDUser extends Model {
	@Column({
		type: new DataType.BIGINT({length: 20}),
		primaryKey: true
	})
	public id!: bigint
	@Column({
		type: new DataType.BIGINT({length: 20})
	})
	public xp!: number
	@Column({
		type: new DataType.INTEGER({length: 11})
	})
	public level!: number
	@Column({
		type: new DataType.INTEGER({length: 11})
	})
	public bumps!: number
}

export const getUserById = async (id: bigint) => {
	const [user] = await DDUser.findOrCreate({
		where: {
			id: id
		},
		defaults: {
			id: id,
			xp: 0,
			level: 0,
			bumps: 0
		}
	})
	return user
}