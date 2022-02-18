import {Sequelize} from 'sequelize-typescript'
import {logger} from '../logging.js'
import {sentry} from '../util/errors.js'

const database = process.env.DATABASE ?? 'database'
const username = process.env.USERNAME ?? 'admin'
const password = process.env.PASSWORD ?? 'password'
const host = process.env.HOST ?? 'localhost'

export const sequelize = new Sequelize({
	database: database,
	username: username,
	password: password,
	models: [],
	host: host,
	dialect: 'mariadb',
	logging: (msg) => logger.debug(msg),
})


// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
sequelize.query = async function (...args) {
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	return Sequelize.prototype.query.apply(this, args).catch(err => {
		sentry(err)
		throw err
	})
}

