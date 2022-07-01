import {Sequelize} from 'sequelize-typescript'
import {logger} from '../logging.js'
import {DDUser} from './models/DDUser.js'
import {SavedMessage} from './models/SavedMessage.js'
import {ColourRoles} from './models/ColourRoles.js'
import {FAQ} from './models/FAQ.js'

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

export async function init() {
	const models = [DDUser, SavedMessage, ColourRoles, FAQ]
	sequelize.addModels(models)
	for (const model of models) {
		await model.sync()
	}
	logger.info('Initialised database')
}
