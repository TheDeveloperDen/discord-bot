import fetch from 'node-fetch'
import { config } from '../../Config.js'
import { logger } from '../../logging.js'
import { createStandardEmbed } from '../../util/embeds.js'
import { mention } from '../../util/users.js'
import { InteractionReplyOptions, Message } from 'discord.js'

const codeBlockPattern = /```(?:(?<lang>[a-zA-Z]+)?\n)?(?<content>(?:.|\n)*?)```|(?:(?:.|\n)(?!```))+/g
type SplitMessageComponent = { text: string } | {
  content: string
  language?: string
}

export function splitMessage (
  message: string, threshold: number = config.pastebin.threshold) {
  const matches = message.matchAll(codeBlockPattern)

  const out: SplitMessageComponent[] = []

  for (const match of matches) {
    if (match[0].split('\n').length < threshold) {
      out.push({ text: match[0] })
      continue
    }

    if ((match.groups?.content ?? (match[0].match(/[{}<>()=]+/g) != null))) {
      out.push({
        content: match.groups?.content ?? match[0],
        language: match?.groups?.lang ?? undefined
      })
    }
  }

  return out
}

export async function upload (component: SplitMessageComponent) {
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

  const key = (await response.json() as { key: string }).key

  if (!key) {
    logger.warn('Key was missing from pastebin response')
    return ''
  }

  return `${config.pastebin.url}/${key}${component.language
    ? '.' + component.language
    : ''}`
}

type PastifyReturn<T extends boolean> = T extends true
  ? InteractionReplyOptions
  : InteractionReplyOptions | null

/**
 * Pastifies a message.
 * @param message the message to pastify
 * @param forcePaste whether to pastify the message regardless of whether there's any code
 * @param threshold the point at which a message should be uploaded to the pastebin
 * @return an embed containing a pastified message, or null if the message is empty
 */
export async function pastify<force extends boolean = false>
(
  message: Message, forcePaste?: force,
  threshold?: number): Promise<PastifyReturn<force>> {
  const split = splitMessage(message.content, threshold)

  // if it's just a string, do nothing
  if (!forcePaste &&
    !split.some(part => 'content' in part)) {
    return null as PastifyReturn<force>
  }

  const lines = await Promise.all(split.map(upload))

  await message.delete()
  return {
    embeds: [
      {
        ...createStandardEmbed(message.member ?? undefined),
        description: `${mention(
          message.member ?? message.author)} \n${lines.join('\n')}`,
        footer: {
          text: 'This message was converted automatically to keep the channels clean from large code blocks.'
        }
      }]
  }
}
