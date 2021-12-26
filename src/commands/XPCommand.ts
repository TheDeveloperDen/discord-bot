import {SlashCommandBuilder} from "@discordjs/builders";
import {CommandInteraction, GuildMember, MessageEmbedOptions, User} from "discord.js";
import {getUserById} from "../store/DDUser.js";
import {createImage} from "../util/imageUtils.js";
import {createStandardEmbed} from "../util/embeds.js";
import {xpForLevel} from "../xp/experienceCalculations.js";
import {Command} from "./Commands.js";


export class XPCommand implements Command {
    info = new SlashCommandBuilder()
        .setName("xp")
        .setDescription("Show a member's XP")
        .addUserOption(option => option
            .setName("member")
            .setDescription("The member to show XP for")
            .setRequired(false))


    async execute(interaction: CommandInteraction) {
        const user = interaction.options.getUser("member") || interaction.user as User;
        const member = interaction.options.getMember("member") as GuildMember ?? interaction.member as GuildMember
        const ddUser = await getUserById(BigInt(user.id))
        const xp = ddUser.xp

        await interaction.deferReply()
        const image = await createXPImage(xp, member);
        await interaction.followUp({
            embeds: [{
                ...createStandardEmbed(member),
                title: `Profile of ${user.username}#${user.discriminator}`,
                fields: [
                    {
                        name: "🔮 Level",
                        value: `${ddUser.level}`
                    },
                    {
                        name: "📝 Tier",
                        value: `${ddUser.level == 0 ? 0 : Math.floor(Math.log10(ddUser.level)) + 1}`
                    },
                    {
                        name: "❗ Disboard Bumps",
                        value: `${ddUser.bumps}`
                    },
                    {
                        name: "📈 XP Until Level Up",
                        value: `${ddUser.xp}/${xpForLevel(ddUser.level + 1)}`
                    }
                ],
                image: {url: "attachment://xp.png"}
            } as MessageEmbedOptions],
            files: [{attachment: image.toBuffer(), name: 'xp.png'}]
        });
    }

}

const createXPImage = async (xp: number, user: GuildMember) => {
    const [canvas, ctx] = createImage(1000, 500, '#2b2d2f')
    ctx.fillStyle = user.roles.highest.hexColor

    const message = `${xp} XP`;
    let size = 500;
    do {
        ctx.font = `${size}px Horta`
        size--
    } while (ctx.measureText(message).width >= canvas.width * 2 / 3)

    const metrics = ctx.measureText(message);
    const x = (canvas.width - metrics.width) / 2.0
    const y = (canvas.height + metrics.actualBoundingBoxAscent) / 2.0
    ctx.fillText(message, x, y);
    return canvas
}