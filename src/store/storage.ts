import {Sequelize} from 'sequelize-typescript'
import {logger} from "../logging.js";
import {SavedMessage} from "./models/SavedMessage.js";
import {sentry} from "../util/errors.js";

const database = process.env.DATABASE ?? 'database'
const username = process.env.USERNAME ?? 'admin'
const password = process.env.PASSWORD ?? 'password'
const host = process.env.HOST ?? 'localhost'

export const sequelize = new Sequelize({
    database: database,
    username: username,
    password: password,
    models: [SavedMessage],
    host: host,
    dialect: 'mariadb',
    logging: (msg) => logger.debug(msg),
})

// @ts-ignore
sequelize.query = async function () {
    // proxy this call
    // @ts-ignore
    return Sequelize.prototype.query.apply(this, arguments).catch(function (err) {
        sentry(err);
        throw err;
    });
};

