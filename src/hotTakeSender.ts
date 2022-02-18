import hotTakeData from '../hotTakeData.json'
import {randomElement} from "./util/random.js";
import {TextChannel} from "discord.js";
import {EventHandler} from "./EventHandler.js";
import {MarkedClient} from "./MarkedClient.js";
import {config} from "./Config.js";

type HotTakeData = {
	people: string[],
	companies: string[],
	languages: string[]
	technologies: string[],
	problems: string[]
	takes: string[],
}

const placeholderRegex = /{([^}]+)}/g;

type Placeholder
	= 'language'
	| 'technology'
	| 'thing' // Alias for language|technology
	| 'person'
	| 'company'
	| 'group' // Alias for person|company
	| 'problem'
	| Placeholder[]

function findPlaceholders(message: string): Placeholder[] {
	const matches = Array.from(message.matchAll(placeholderRegex))
	// @ts-ignore We know the group will be present
	return matches.map(match => parsePlaceholder(match[1]))
}

function parsePlaceholder(message: string): Placeholder {
	const parts = message.split('|')
	if (parts.length == 1) {
		return parts[0] as Placeholder
	} else {
		return parts.map(part => part as Placeholder)
	}
}

function placeholderValues(placeholder: Placeholder): string[] {
	if (Array.isArray(placeholder)) {
		return placeholder.flatMap(placeholderValues)
	}
	switch (placeholder) {
		case 'language':
			return hotTakeData.languages
		case 'technology':
			return hotTakeData.technologies
		case 'thing':
			return hotTakeData.languages.concat(hotTakeData.technologies)
		case 'person':
			return hotTakeData.people
		case 'company':
			return hotTakeData.companies
		case 'group':
			return hotTakeData.people.concat(hotTakeData.companies)
		case 'problem':
			return hotTakeData.problems
		default:
			throw new Error(`Unknown placeholder: ${placeholder}`)
	}
}

function stringPlaceholder(placeholder: Placeholder): string {
	if (Array.isArray(placeholder)) {
		return placeholder.map(stringPlaceholder).join('|')
	}
	return placeholder
}

function getRandomPlaceholderValue(placeholder: Placeholder): string {
	return randomElement(placeholderValues(placeholder))
}

export function generateHotTake(): string {
	const data = hotTakeData as HotTakeData
	let take = data.takes[Math.floor(Math.random() * data.takes.length)]

	const placeholders = findPlaceholders(take)
	placeholders.forEach(placeholder => {
		take = take.replace(`{${stringPlaceholder(placeholder)}}`, () => getRandomPlaceholderValue(placeholder))
	})
	return "Hot take! " + capitalize(take)
}


function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1)
}

export const hotTakeListener: EventHandler = (client: MarkedClient) => {
	async function sendHotTake(channel?: TextChannel) {
		channel = channel || await client.channels.fetch(config.channels.hotTake) as TextChannel
		const lastMessage = await channel.messages.fetch({limit: 1}).then(m => m.first())
		const lastMessageSentAt = lastMessage?.createdAt ?? new Date(0);
		const timeSinceLastMessage = (Date.now() - lastMessageSentAt.getTime()) / 1000
		if (timeSinceLastMessage < 60 * 10) {
			return
		}
		const hotTake = generateHotTake()
		await channel.send(hotTake)
	}

	async function hotTakeLoop() {
		await sendHotTake()
		setTimeout(async () => {
			await hotTakeLoop()
		}, 60 * 1000)
	}

	client.on('ready', async () => {
		await hotTakeLoop()
	})

}
