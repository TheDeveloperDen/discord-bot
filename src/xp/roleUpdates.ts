import {EventHandler} from "../EventHandler.js";
import {modifyRoles} from "../util/roles.js";

const editing = new Set<string>()

export const roleChangeListener: EventHandler = (client) =>
    // save the user's message when they send a message
    client.on("guildMemberUpdate", (event) => {
        if (editing.has(event.user.id)) {
            return
        }
        editing.add(event.user.id)
        setTimeout(async () => {
            await modifyRoles(client, event.guild.members.resolve(event.user), {toRemove: [], toAdd: []})
            editing.delete(event.user.id)
        }, 800)
    });
