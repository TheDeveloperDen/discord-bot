import {distance} from "fastest-levenshtein";
import {Message, TextChannel, User} from "discord.js";
import {Config} from "../config";
import {getMessages} from "./previous-messages";
import {logger} from "../logging";

const similarityProportion = (a: string, b: string) => distance(a, b) / b.length;
const minMessageLength = 6
const minDistance = 0.4;

export async function shouldCountForStats(author: User, message: Message, channel: TextChannel, config: Config) {
    if (author.bot) return false;
    if (channel.id == config.botCommandsChannelId) return false;
    const content = message.content
    if (content.length < minMessageLength) return false;
    const messages = getMessages(author);
    if (messages.filter(m => similarityProportion(m, content) < minDistance).length > 0) {
        logger.debug(`Discarded message ${message.id} from user ${author} because it was too similar to previous messages`)
        return false;
    }

    const asArray = content.split('');
    return asArray.some(it => it.match(/[a-z ]/i));
}

