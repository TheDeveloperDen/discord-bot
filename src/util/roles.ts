import { Client, Collection, GuildMember, Role } from "discord.js";
import { config } from "../Config.js";

export interface RoleChanges {
  toAdd: string[];
  toRemove: string[];
}

export async function modifyRoles(
  client: Client,
  user: GuildMember,
  roleChanges: RoleChanges,
) {
  const currentRoles = user.roles.cache.clone();
  const guild = user.guild;
  currentRoles.delete(guild.roles.everyone.id);
  const getRole = (roleId: string) => {
    const role = guild.roles.cache.get(roleId);
    if (role == null) {
      throw new Error(`Role ${roleId} not found`);
    }
    return role;
  };

  const roles = config.roles.separators;

  const addRole = (roleId: string) => currentRoles.set(roleId, getRole(roleId));
  roleChanges.toAdd.forEach(addRole);
  roleChanges.toRemove.forEach((role) => currentRoles.delete(role));

  const langsSeparator = hasRolesBetween(roles.langs, null)(currentRoles);
  if (langsSeparator) {
    addRole(roles.langs);
  } else {
    currentRoles.delete(roles.langs);
  }
  const tagsSeparator = hasRolesBetween(roles.tags, roles.langs)(currentRoles);
  if (tagsSeparator) {
    addRole(roles.tags);
  } else {
    currentRoles.delete(roles.tags);
  }

  const generalSeparator =
    hasRolesBetween(null, roles.general)(currentRoles) &&
    hasRolesBetween(roles.general, roles.tags)(currentRoles);
  if (generalSeparator) {
    addRole(roles.general);
  } else {
    currentRoles.delete(roles.general);
  }

  await user.roles.set(currentRoles);
}

const hasRolesBetween =
  (upperBound: string | null, lowerBound: string | null) =>
  (roles: Collection<string, Role>) => {
    let match = true;
    if (upperBound && lowerBound) {
      match &&= roles.some(
        (role) =>
          role.comparePositionTo(upperBound) < 0 &&
          role.comparePositionTo(lowerBound) > 0,
      );
    }
    if (upperBound) {
      match &&= roles.some((role) => role.comparePositionTo(upperBound) < 0);
    }
    if (lowerBound) {
      match &&= roles.some((role) => role.comparePositionTo(lowerBound) > 0);
    }
    return match;
  };
