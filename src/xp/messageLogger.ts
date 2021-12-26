import {Message, PartialMessage, User} from "discord.js";
import {EventHandler} from "../EventHandler.js";
import {logger} from "../logging.js";
import {SavedMessage} from "../store/models/SavedMessage.js";

const previousMessages: Map<User, string[]> = new Map<User, string[]>();

export const saveMessage = async (user: User, message: Message) => {
    const msg = new SavedMessage({
        user_id: user.id,
        channel_id: message.channel.id,
        message_id: message.id,
        timestamp: message.createdTimestamp,
        content: messageContent(message),
        type: "CREATE",
    });
    await msg.save();

    if (!previousMessages.has(user)) {
        previousMessages.set(user, []);
    }
    const messages = previousMessages.get(user)!!
    messages.push(message.content);
    while (messages.length > 10) {
        messages.shift();
    }
    previousMessages.set(user, messages);
}

export const getMessages = (user: User) => {
    return previousMessages.get(user) ?? []
}

const messageContent = (message: Message | PartialMessage) => message.content + message.attachments.map(a => a.url).join(",");

export const messageLoggerListener: EventHandler = (client) => {
    client.on("messageCreate", async (message) => {
        if (message.author.bot) {
            return;
        }
        logger.debug(`Saving message from ${message.author.id}: ${message.id}`);
        await saveMessage(message.author, message);
    });

    client.on('messageUpdate', async (oldMessage, message) => {
        const msg = new SavedMessage({
            user_id: message.author.id,
            channel_id: message.channel.id,
            message_id: message.id,
            timestamp: message.editedTimestamp ?? message.createdTimestamp,
            content: messageContent(message),
            type: "EDIT",
        });
        await msg.save();
    })

    client.on('messageDelete', async (message) => {
        const msg = new SavedMessage({
            user_id: message.author.id,
            channel_id: message.channel.id,
            message_id: message.id,
            timestamp: new Date(),
            content: messageContent(message),
            type: "DELETE",
        });
        await msg.save();
    })
}
