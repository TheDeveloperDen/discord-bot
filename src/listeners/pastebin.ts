import {EventHandler} from '../EventHandler.js'
import {config} from '../Config.js'
import {logger} from '../logging.js'
import {createStandardEmbed} from '../util/embeds.js'
import fetch from 'node-fetch'
import {mention} from '../util/users.js'

const codeBlockPattern = /```(?:(?<lang>[a-zA-Z]+)?\n)?(?<content>(?:.|\n)*?)```/

/*
 * Uploads if all the following is true:
 *
 * - Contains either:
 *   - a code block
 *   - one of the chars `{}<>()=`
 * - Has a line count above the threshold as set in the config
 * - Does not start with '!nopaste' or a forward slash
 */
function contentToUpload(message: string): { lang?: string, content: string } | null {
	if (message.startsWith('!nopaste') || message.startsWith('/')) return null
	const lineCount = (message.match(/\n/g) || []).length
	if (lineCount < config.pastebin.threshold) return null

	const match = codeBlockPattern.exec(message)
	if (match) {
		const content = match?.groups?.content
		return content?.startsWith('```') && content?.endsWith('````') || false ?
			{
				lang: match?.groups?.lang,
				content: match?.groups?.content || ''
			} :
			{content: message}
	}

	return message.match(/[{}<>()=]+/g) ? {content: message} : null
}

export const pastebinListener: EventHandler = (client) => {
	client.on('messageCreate', async (message) => {
		const content = contentToUpload(message.content)
		if (content == null) return

		const response = await fetch(`${config.pastebin.url}/documents`, {
			method: 'POST',
			body: content.content
		})

		if (!response.ok) {
			logger.warn(`Failed to upload message to pastebin: ${response.statusText}`)
			return
		}

		const key = (await response.json() as { key: string })['key']

		if (!key) {
			logger.warn('Key was missing from pastebin response')
			return
		}

		await message.reply({
			embeds: [{
				...createStandardEmbed(message.member ?? undefined),
				description: `${mention(message.member!)} ${config.pastebin.url}/${key}${content.lang ? '.' + content.lang : ''}`,
				footer: {
					text: 'This message was converted automatically to keep the channels clean from large code blocks.'
				}
			}]
		})

		await message.delete()
	})
}