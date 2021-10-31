import {config} from "./config";
import {Client, Collection, Intents, TextChannel} from "discord.js";
import {xpForMessage} from "./xp/experience-calculations";
import {shouldCountForStats} from "./xp/levelling";

import {MarkedClient} from "./MarkedClient";
import {readdirSync} from "fs";
import {Command} from "./commands/Command";
import {loadCommands} from "./deploy-commands";
import {DDUser, Users} from "./store/DDUser";

// @ts-ignore
const client: MarkedClient = new Client({
    intents: [Intents.FLAGS.GUILD_MEMBERS, Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES]
})
client.commands = new Collection();

const commandFiles = readdirSync('./src/commands')
    .filter(file => file.endsWith('.ts'))
    .filter(file => file != 'Command.ts')

for (const file of commandFiles) {
    const command: Command = require(`./commands/${file}`)
    client.commands.set(command.info.name, command)
}

client.once('ready', async () => {
    console.log(`Logged in as ${client.user?.tag}`)

    await Users.sync()
})

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;
    const command = client.commands.get(interaction.commandName)
    if (!command) return;
    await command.execute(interaction)
})


client.on('messageCreate', async msg => {
    if (!(msg.channel instanceof TextChannel)) {
        return
    }
    if (await shouldCountForStats(msg.author, msg.content, msg.channel, config)) {
        const xp = xpForMessage(msg.content);
        const [user] = await DDUser.findOrCreate({where: {id: msg.author.id}})
        if (!user) console.error(`Could not find or create user with id ${msg.author.id}`)
        await user.update({xp: user.xp + xp})
        console.log(`Gave ${xp} XP to user ${user.id}`)
    }
})


const token = process.env.BOT_TOKEN!!;

loadCommands(token, config)
    .then(() => client.login(token))