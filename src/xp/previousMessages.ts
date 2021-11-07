import {User} from "discord.js";
import {EventHandler} from "../EventHandler";
import {logger} from "../logging";

const previousMessages: Map<User, string[]> = new Map<User, string[]>();

export const saveMessage = (user: User, message: string) => {
    if (!previousMessages.has(user)) {
        previousMessages.set(user, []);
    }
    const messages = previousMessages.get(user)!!
    messages.push(message);
    while (messages.length > 10) {
        messages.shift();
    }
    previousMessages.set(user, messages);
}

export const getMessages = (user: User) => {
    if (!previousMessages.has(user)) {
        return [];
    }
    return previousMessages.get(user)!!;
}

export const previousMessageListener: EventHandler = (client) =>
    // save the user's message when they send a message
    client.on("messageCreate", (message) => {
        if (message.author.bot) {
            return;
        }
        logger.info(`Saving message from ${message.author.id}: ${message.id}`);
        saveMessage(message.author, message.content);
    });
