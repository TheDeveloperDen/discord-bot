import {Column, DataType, Model, Table} from 'sequelize-typescript'

@Table({
	tableName: 'Users'
})
export class DDUser extends Model {
	@Column({
		type: new DataType.BIGINT({length: 20}),
		primaryKey: true
	})
	declare public id: bigint
	@Column({
		type: new DataType.BIGINT({length: 20})
	})
	declare public xp: number
	@Column({
		type: new DataType.INTEGER({length: 11})
	})
	declare public level: number
	@Column({
		type: new DataType.INTEGER({length: 11})
	})
	declare public bumps: number

	@Column({
		type: new DataType.INTEGER({length: 11})
	})
	declare public currentDailyStreak: number

	@Column({
		type: new DataType.INTEGER({length: 11}),

	})
	declare public highestDailyStreak: number

	@Column({
		type: new DataType.DATE(),
		allowNull: true
	})
	declare public lastDailyTime?: Date
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
			bumps: 0,
			currentDailyStreak: 0,
			highestDailyStreak: 0
		},
		benchmark: true
	})
	return user
}
