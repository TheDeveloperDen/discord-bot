import { GuildMember } from 'discord.js'
import { getOrCreateUserById } from '../../store/models/DDUser.js'
import { createStandardEmbed } from '../../util/embeds.js'
import { xpForLevel } from './xpForMessage.util.js'
import { createImage, font, getCanvasContext } from '../../util/imageUtils.js'
import { branding } from '../../util/branding.js'
import { drawText } from '../../util/textRendering.js'
import { Command } from 'djs-slash-helper'
import { ApplicationCommandOptionType, ApplicationCommandType } from 'discord-api-types/v10'
import { formatDayCount, getActualDailyStreak } from './dailyReward.command.js'
import { wrapInTransaction } from '../../sentry.js'
import { format } from '../core/info.command.js'
import { pseudoMention } from '../../util/users.js'

export const XpCommand: Command<ApplicationCommandType.ChatInput> = {
  name: 'xp',
  type: ApplicationCommandType.ChatInput,
  description: 'Show a member\'s XP',
  options: [
    {
      type: ApplicationCommandOptionType.User,
      name: 'member',
      description: 'The member to show XP for',
      required: false
    }
  ],

  handle: wrapInTransaction('xp', async (span, interaction) => {
    await interaction.deferReply()
    const user = interaction.options.getUser('member') ?? interaction.user
    const member = (interaction.options.getMember('member') ?? interaction.member) as GuildMember
    const ddUser = await getOrCreateUserById(BigInt(user.id))
    const xp = ddUser.xp
    const image = createXpImage(xp, member)
    await interaction.followUp({
      embeds: [
        createStandardEmbed(member)
          .setTitle(`Profile of ${pseudoMention(user)}`)
          .setFields({
            name: '🔮 Level',
            value: `${ddUser.level}`,
            inline: true
          }, {
            name: '📝 Tier',
            value: `${
              ddUser.level === 0
                ? 0
                : Math.floor(ddUser.level / 10) +
                1
            }`,
            inline: true
          }, {
            name: '❗ Daily Streak (Current / Highest)',
            value: `${
              formatDayCount(
                await getActualDailyStreak(ddUser)
              )
            } / ${
              formatDayCount(
                ddUser.highestDailyStreak
              )
            }`,
            inline: true
          }, {
            name: '📈 XP Difference (Current Level / Next Level)',
            value: `${format(ddUser.xp)}/${format(xpForLevel(ddUser.level + 1))}`,
            inline: true
          }, {
            name: '⬆️ XP Needed Until Level Up',
            value: `${format(xpForLevel(ddUser.level + 1) - ddUser.xp)}`,
            inline: true
          })
          .setImage('attachment://xp.png')
      ],
      files: [
        {
          attachment: image.createPNGStream(),
          name: 'xp.png'
        }
      ]
    })
  })
}

const xpBackground = createImage(1000, 500, '#171834')

function createXpImage (xp: bigint, user: GuildMember) {
  const [canvas, ctx] = getCanvasContext(1000, 500)
  ctx.drawImage(xpBackground, 0, 0)

  ctx.fillStyle = user.roles?.color?.hexColor ?? branding.color

  const message = `${xp.toLocaleString()} XP`
  drawText(ctx, message, font, {
    x: 0,
    y: 0,
    width: canvas.width,
    height: canvas.height
  }, {
    hAlign: 'center',
    vAlign: 'center',
    maxSize: 450,
    minSize: 1,
    granularity: 3
  })
  return canvas
}
