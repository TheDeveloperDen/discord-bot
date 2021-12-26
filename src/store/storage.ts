import Sequelize from "sequelize";

const database = process.env.DATABASE ?? 'database'
const username = process.env.USERNAME ?? 'admin'
const password = process.env.PASSWORD ?? 'password'
const host = process.env.HOST ?? 'localhost'

export const sequelize = new Sequelize.Sequelize(database, username, password, {
    host: host,
    dialect: 'mariadb',
    logging: console.log
})

