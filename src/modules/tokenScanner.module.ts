import Module from './module.js'
import { createStandardEmbed } from '../util/embeds.js'

const tokenPattern = /[MN][A-Za-z\d]{23}\.[\w-]{6}\.[\w-]{27}/g

export const TokenScannerModule: Module = {
  name: 'tokenScanner',
  listeners: [
    {
      async messageCreate (_, message) {
        const matches = message.content.match(tokenPattern)
        if ((matches == null) || matches.length === 0) return

        await message.delete()

        await message.member?.send({
          embeds: [
            {
              ...createStandardEmbed(message.member),
              title: ':exclamation: TOKENS DETECTED :exclamation:',
              description: `We found Discord tokens in a message you sent!\n\n${matches.map(
                x => `\`${x}\``).join('\n')}\n
We've deleted the message, but we can't reset the token for you - make sure to do this yourself.
Be careful when handling tokens in the future - **they're secrets, keep them that way!**`
            }]
        })
      }
    }]
}
