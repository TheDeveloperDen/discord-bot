import {randomInt} from 'crypto'
import {Guild} from 'discord.js'
import {actualMention, isSpecialUser} from '../../util/users.js'
import {readFileSync} from 'fs'
import ExpiryMap from "expiry-map";

const hotTakeData: {
	people: string[],
	companies: string[],
	languages: string[]
	technologies: string[],
	problems: string[],
	tlds: string[]
	takes: string[],
} = JSON.parse(readFileSync(process.cwd() + '/hotTakeData.json').toString())

const placeholders = {
	language: () => hotTakeData.languages,
	technology: () => hotTakeData.technologies,
	tld: () => hotTakeData.tlds,
	thing: combineSources('languages', 'technologies'),
	anything: combineSources('languages', 'technologies', 'people', 'companies'),
	oneWordAnything: (users: string[]) => mappedPlaceholders('anything', it => it.replace(' ', ''))(users),
	person: () => hotTakeData.people,
	company: () => hotTakeData.companies,
	group: combineSources('people', 'companies'),
	problem: () => hotTakeData.problems,
	entity: combineSources('languages', 'technologies', 'people', 'companies'),
	year: () => [randomInt(1500, 2022).toString()],
	age: () => [randomInt(1, 50).toString()],
	bigNumber: () => [randomInt(2, 100000).toString()],
	percentage: () => [randomInt(1, 100).toString()],
	oneWordThing: (users: string[]) => mappedPlaceholders('thing', it => it.replace(' ', ''))(users),
}

type Placeholder = keyof typeof placeholders

function isValidPlaceholder(value: string): value is Placeholder {
	return Object.keys(placeholders).includes(value)
}

function combineSources(...source: (keyof typeof hotTakeData)[]) {
	return (users: string[]) => hotTakeData[source[0]].concat(source.slice(1).flatMap(it => hotTakeData[it]), users)
}

function mappedPlaceholders(key: Placeholder, f: (s: string) => string): (users: string[]) => string[] {
	return (users: string[]) => placeholders[key](users).map(f)
}

async function getAdditionalUsers(guild: Guild): Promise<string[]> {
	const users = await guild.members.fetch()
	return users
		.filter(isSpecialUser)
		.map(user => actualMention(user))
}


const specialUsersCache = new ExpiryMap(1000 * 60 * 30);

async function getSpecialUsers(guild: Guild) {
	if (specialUsersCache.has(guild.id)) {
		return specialUsersCache.get(guild.id);
	}
	const users = await getAdditionalUsers(guild).catch(() => []);
	specialUsersCache.set(guild.id, users);
	return users;
}

export default async function generateHotTake(guild: Guild) {
	const members = await getSpecialUsers(guild);
	return hotTakeData.takes.randomElement().replace(/{[\w|]+}/g, value => value
		.slice(1, -1)// remove the {}
		.split('|') // split into options
		.filter(isValidPlaceholder) // filter out invalid placeholders
		.flatMap(it => placeholders[it](members))  // get the values for each placeholder
		.randomElement() // pick a random value
	)
}
