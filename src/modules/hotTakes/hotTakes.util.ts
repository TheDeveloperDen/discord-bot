import {randomInt} from 'crypto'
import {Guild} from 'discord.js'
import {config} from '../../Config.js'
import {actualMention} from '../../util/users.js'
import {readFileSync} from 'fs'

const hotTakeData: {
	people: string[],
	companies: string[],
	languages: string[]
	technologies: string[],
	problems: string[]
	takes: string[],
} = JSON.parse(readFileSync(process.cwd()+'/hotTakeData.json').toString())

const placeholders = {
	language: () => hotTakeData.languages,
	technology: () => hotTakeData.technologies,
	thing: combineSources('languages', 'technologies'),
	person: combineSources('people'),
	company: () => hotTakeData.companies,
	group: combineSources('people', 'companies'),
	problem: () => hotTakeData.problems,
	entity: combineSources('languages', 'technologies', 'people', 'companies'),
	year: () => [randomInt(1900, 2022).toString()]
}

type Placeholder = keyof typeof placeholders

function isValidPlaceholder(value: string): value is Placeholder {
	return Object.keys(placeholders).includes(value)
}

function combineSources(...source: (keyof typeof hotTakeData)[]) {
	return (users: string[]) => hotTakeData[source[0]].concat(source.slice(1).flatMap(it => hotTakeData[it]), users)
}

async function getAdditionalUsers(guild: Guild): Promise<string[]> {
	const users = await guild.members.fetch()
	return users.filter(user => {
		return user.premiumSinceTimestamp != null || user.roles.cache.has(config.roles.staff) || user.roles.cache.has(config.roles.notable ?? '')
	}).map(user => actualMention(user))
}


export default async function generateHotTake(guild: Guild) {
	const members = await getAdditionalUsers(guild)
	return hotTakeData.takes.randomElement().replace(/{[\w|]+}/g, value => value
		.slice(1, -1)
		.split('|')
		.filter(isValidPlaceholder)
		.flatMap(it => placeholders[it](members))
		.randomElement()
	)
}

/**
 * todo:
 * - auto creation and stuff
 */
