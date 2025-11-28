import { getOrCreateUserById } from "../../store/models/DDUser.js";
import type { EventListener } from "../module.js";
import { applyTierRoles } from "./xpRoles.util.js";
export const RoleJoinListener: EventListener = {
	guildMemberAdd: async (client, member) => {
		const ddUser = await getOrCreateUserById(BigInt(member.id));

		await applyTierRoles(client, member, ddUser);
	},
};
