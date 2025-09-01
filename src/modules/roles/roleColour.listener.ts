import { ColourRoles } from "../../store/models/ColourRoles.js";
import type { EventListener } from "../module.js";

export const RoleColourListener: EventListener = {
	async guildMemberUpdate(_, oldMember, newMember) {
		if (
			oldMember.premiumSince === newMember.premiumSince ||
			newMember.premiumSinceTimestamp !== 0
		) {
			return;
		}

		const roleInfo = await ColourRoles.findOne({
			where: {
				id: newMember.id,
			},
		});
		if (roleInfo == null) return;

		const roleId = roleInfo.getDataValue("role");
		if (!roleId) {
			throw new Error("No colour role found, database call failed?");
		}
		await newMember.guild.roles.delete(roleId.toString());
		await roleInfo.destroy();
	},
};
