import {randomElement} from "./util/random.js";
import {Guild, TextChannel} from "discord.js";
import {EventHandler} from "./EventHandler.js";
import {MarkedClient} from "./MarkedClient.js";
import {config} from "./Config.js";
import {hotTakeData} from "./hotTakeData.js";
import {actualMention} from "./util/users.js";

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

function placeholderValues(placeholder: Placeholder, extraUsers: string[] = []): string[] {
	if (Array.isArray(placeholder)) {
		return placeholder.flatMap(p => placeholderValues(p, extraUsers))
	}
	switch (placeholder) {
		case 'language':
			return hotTakeData.languages
		case 'technology':
			return hotTakeData.technologies
		case 'thing':
			return hotTakeData.languages.concat(hotTakeData.technologies)
		case 'person':
			return hotTakeData.people.concat(extraUsers)
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

function getRandomPlaceholderValue(placeholder: Placeholder, extraUsers: string[]): string {
	return randomElement(placeholderValues(placeholder, extraUsers))
}

export async function generateHotTake(guild?: Guild): Promise<string> {
	const data = hotTakeData
	let take = data.takes[Math.floor(Math.random() * data.takes.length)]
	const placeholders = findPlaceholders(take)
	const extraUsers = (guild && await getExtraUsersInGuild(guild)) ?? []
	placeholders.forEach(placeholder => {
		take = take.replace(`{${stringPlaceholder(placeholder)}}`, () => getRandomPlaceholderValue(placeholder, extraUsers))
	})
	return capitalize(take)
}

async function getExtraUsersInGuild(guild: Guild): Promise<string[]> {
	const users = await guild.members.fetch()
	return users.filter(user => {
		return user.premiumSinceTimestamp != null || user.roles.cache.has(config.roles.staff) || user.roles.cache.has(config.roles.notable ?? "")
	}).map(user => actualMention(user))
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
		if (lastMessage?.author == client.user || timeSinceLastMessage < 60 * 30) {
			return
		}
		const hotTake = await generateHotTake(channel.guild)
		await channel.send({content: hotTake, allowedMentions: {users: []}})
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
