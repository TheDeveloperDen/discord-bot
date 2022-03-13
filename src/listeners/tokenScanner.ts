import {Listener} from './listener.js'
import {Message} from 'discord.js'
import {createStandardEmbed} from '../util/embeds.js'

const tokenPattern = /[MN][A-Za-z\d]{23}\.[\w-]{6}\.[\w-]{27}/g

export const tokenScanner: Listener = (client) => {

	client.on('messageCreate', async (message: Message) => {
		const matches = message.content.match(tokenPattern)
		if (!matches || matches.length == 0) return

		await message.delete()

		message.member?.send({
			embeds: [{
				...createStandardEmbed(message.member),
				title: ':exclamation: TOKENS DETECTED :exclamation:',
				description: `We found Discord tokens in a message you sent!\n\n${matches.map(x => `\`${x}\``).join('\n')}\n
				We've deleted the message, but we can't reset the token for you - make sure to do this yourself.
				Be careful when handling tokens in the future - **they're secrets, keep them that way!**`,
			}]
		})
	})
}
