import {Listener} from './listener.js'
import {pastify} from '../util/pastify.js'
import {Channel, PartialDMChannel, TextChannel} from 'discord.js'
import {randomInt} from 'crypto'
import {Snowflake} from 'discord-api-types'

const expressions: readonly string[] = [
	'>_<', ':3', 'ʕʘ‿ʘʔ', ':D', '._.',
	';3', 'xD', 'ㅇㅅㅇ', '(人◕ω◕)',
	'>_>', 'ÙωÙ', 'UwU', 'OwO', ':P',
	'(◠‿◠✿)', '^_^', ';_;', 'XDDD',
	'x3', '(• o •)', '<_<'
] as const

const uwuChannels: readonly Snowflake[] = [
	'932633680634081301', // testing general
	'821743100657270876', // general
	'932661343520194640', // random
	'881463087037841430', // memes
	'946856101817757767', // no-mic
]

function isTextChannel(channel: Channel | PartialDMChannel): channel is TextChannel {
	return channel.type === 'GUILD_TEXT'
}

function uwuify(message: string, filterMentions: boolean): string {
	const words = message.split(' ')
	const out: string[] = []


	for (const word of words) {
		if (word.startsWith('@')) {
			if (filterMentions) out.push(word)
			continue
		}
		// if it's an expression, leave it intact
		if (expressions.includes(word)) {
			out.push(word)
			continue
		}

		const noMatcher = word.match(/n(o+)(?!\w)/)

		if (noMatcher) {
			out.push('na' + 'w'.repeat(noMatcher[1].length ))
			continue
		}

		out.push(
			// owo speak just doesn't hit the same in caps
			word.toLowerCase()
				.replace(/l/g, 'w')
				.replace(/r/g, 'w')
				// replace all 'o's unless at the end of a word
				.replace(/o(?!o|h|$)/g, 'u')
				.replace(/th/g, 'd')
		)
	}

	return out.join(' ') + (randomInt(4) == 1 ? ' ' + expressions[randomInt(0, expressions.length - 1)] : '')
}

export const pastebinListener: Listener = (client) => {
	client.on('messageCreate', async (message) => {
		const pastified = await pastify(message)
		if (pastified) {
			message.channel.send(pastified)
			return
		}
		if (message.author.bot ||
			!uwuChannels.includes(message.channel.id) ||
			message.content.endsWith('(nouwu)')) return
		// start the uwu.
		else if (isTextChannel(message.channel)) {
			const hooks = await message.channel.fetchWebhooks()
			const hook = hooks.first() ?? await message.channel.createWebhook('DevUwUper Den')
			const user = `${message.author.username}#${message.author.discriminator}`
			const name = message.member?.nickname ? `${message.member?.nickname} [${user}]` : user
			const uwu = uwuify(message.content, message.member?.permissions.has('MENTION_EVERYONE') ?? false)
			if (uwu.trim() === '') return
			await Promise.all([
				hook.send({
					content: [uwu, ...message.attachments.map(m => `${m.url}}`)].join('\n'),
					username: name,
					avatarURL: message.author.avatarURL() ?? 'https://cdn.discordapp.com/embed/avatars/0.png'
				}),
				message.delete()
			])
		}
	})
}
