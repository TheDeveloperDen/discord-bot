import {EventHandler} from '../EventHandler.js'
import {config} from '../Config.js'
import {logger} from '../logging.js'
import {createStandardEmbed} from '../util/embeds.js'
import fetch from 'node-fetch'
import {mention} from '../util/users.js'

const codeBlockPattern = /```(?:(?<lang>[a-zA-Z]+)?\n)?(?<content>(?:.|\n)*?)```|(?:(?:.|\n)(?!```))+/g

type SplitMessageComponent = {text: string} | {content: string, language?: string};

function splitMessage(message: string) {
	const matches = message.matchAll(codeBlockPattern)

	const out: SplitMessageComponent[] = []

	for (const match of matches) {
		if (match[0].split('\n').length < config.pastebin.threshold) {
			out.push({text: match[0]})
			continue
		}

		if ((match.groups?.content || match[0].match(/[{}<>()=]+/g))) {
			out.push({ content: match.groups?.content || match[0], language: match?.groups?.lang || undefined })
		}
	}

	return out
}

async function upload(component: SplitMessageComponent) {
	if ('text' in component) {
		return component.text
	}

	const response = await fetch(`${config.pastebin.url}/documents`, {
		method: 'POST',
		body: component.content
	})

	if (!response.ok) {
		logger.warn(`Failed to upload message to pastebin: ${response.statusText}`)
		return ''
	}

	const key = (await response.json() as { key: string })['key']

	if (!key) {
		logger.warn('Key was missing from pastebin response')
		return ''
	}

	return `${config.pastebin.url}/${key}${component.language ? '.' + component.language : ''}`
}

export const pastebinListener: EventHandler = (client) => {
	client.on('messageCreate', async (message) => {
		
		const split = splitMessage(message.content)

		// if it's just a string, do nothing
		if (!split.some(part => 'content' in part)) return

		const lines = await Promise.all(split.map(upload))
	
		await message.reply({
			embeds: [{
				...createStandardEmbed(message.member ?? undefined),
				description: `${mention(message.member!)} \n${lines.join('\n')}`,
				footer: {
					text: 'This message was converted automatically to keep the channels clean from large code blocks.'
				}
			}]
		})

		await message.delete()
	})
}
