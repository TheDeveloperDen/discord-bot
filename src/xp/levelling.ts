import {distance} from "fastest-levenshtein";
import {TextChannel, User} from "discord.js";
import {Config} from "../config";

const similarityProportion = (a: string, b: string) => distance(a, b) / b.length;
const minMessageLength = 6

async function shouldCountForStats(author: User, content: string, channel: TextChannel, config: Config) {
    if(author.bot) return false;
    if(channel.id == config.botCommandsChannelId) return false;
    if(content.length < minMessageLength) return false;
    const asArray = content.split('');
    if(!asArray.some(it => it.match(/[a-z ]/i))) return false;

}