import {Column, DataType, Model, Table} from 'sequelize-typescript'

@Table({
	tableName: 'RoleColours'
})
export class ColourRoles extends Model {
	@Column({
		type: new DataType.BIGINT({length: 20}),
		primaryKey: true
	})
	public id!: bigint
	@Column({
		type: new DataType.BIGINT({length: 20})
	})
	public colourRole!: bigint
}