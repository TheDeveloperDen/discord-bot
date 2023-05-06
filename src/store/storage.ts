import {Sequelize} from 'sequelize-typescript'
import {logger} from '../logging.js'
import {DDUser} from './models/DDUser.js'
import {ColourRoles} from './models/ColourRoles.js'
import {FAQ} from './models/FAQ.js'
import {Dialect} from 'sequelize/types'

const database = process.env.DATABASE ?? 'database'
const username = process.env.USERNAME ?? 'root'
const password = process.env.PASSWORD ?? 'password'
const host = process.env.HOST ?? 'localhost'
const port = process.env.PORT ?? '3306'
const dialect = process.env.DIALECT ?? 'mariadb'

const commonSequelizeSettings = {
	logging: sequelizeLog,
	logQueryParameters: true,
	benchmark: true,
	models: []
}

export const sequelize = process.env.HOST ? new Sequelize({
		database: database,
		username: username,
		password: password,
		host: host,
		port: parseInt(port),
		dialect: dialect as Dialect,
		...commonSequelizeSettings
	})
	: new Sequelize("sqlite::memory:", commonSequelizeSettings)


function sequelizeLog(sql: string, timing?: number) {
	if (timing) {
		if (timing >= 50) {
			logger.warn(`Slow query (${timing}ms): ${sql}`)
		}
	} else {
		logger.debug(sql)
	}
}


let resolve: () => void
export const databaseInit = new Promise<void>(r => resolve = r)

export async function init() {
	const models = [DDUser, ColourRoles, FAQ]
	sequelize.addModels(models)
	for (const model of models) {
		await model.sync()
	}
	resolve()
	logger.info('Initialised database')
}

await init()
