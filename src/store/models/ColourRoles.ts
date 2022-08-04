import {Column, DataType, Model, Table} from 'sequelize-typescript'

@Table({
	tableName: 'RoleColours'
})
export class ColourRoles extends Model {
	@Column({
		type: new DataType.BIGINT({length: 20}),
		primaryKey: true
	})
	declare public id: bigint

	@Column({
		type: new DataType.BIGINT({length: 20}),
		allowNull: false,
		field: 'colourRole'
	})
	public role!: bigint
}
