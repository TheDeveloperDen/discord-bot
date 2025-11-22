import type { Guild } from "discord.js";
import ExpiryMap from "expiry-map";
import { generateHotTake as generateHotTakeWith } from "hot-takes";
import { isSpecialUser } from "../../util/users.js";

async function lookupSpecialUsers(guild: Guild): Promise<string[]> {
	const users = await guild.members.fetch();
	return users.filter(isSpecialUser).map((user) => user.toString());
}

const specialUsersCache = new ExpiryMap(1000 * 60 * 30);

async function getSpecialUsers(guild: Guild) {
	if (specialUsersCache.has(guild.id)) {
		return specialUsersCache.get(guild.id);
	}
	const users = await lookupSpecialUsers(guild).catch(() => []);
	specialUsersCache.set(guild.id, users);
	return users;
}

export default async function generateHotTake(guild: Guild) {
	const members = await getSpecialUsers(guild);
	return (await generateHotTakeWith(members)).take; // we don't care about the images
}
