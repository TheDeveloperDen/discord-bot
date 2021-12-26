import Sequelize from "sequelize";
import {sequelize} from "../storage.js";

const {Model} = Sequelize;

export class DDUser extends Model {
    public id!: bigint;
    public xp!: number;
    public level!: number;
    public bumps!: number;

    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

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
    });
    return user
}

export const Users = DDUser.init({
    id: {
        type: new Sequelize.BIGINT({length: 20}),
        primaryKey: true
    },
    xp: new Sequelize.BIGINT({length: 20}),
    level: new Sequelize.INTEGER({length: 11}),
    bumps: new Sequelize.INTEGER({length: 11}),
}, {
    tableName: 'Users',
    sequelize: sequelize
})