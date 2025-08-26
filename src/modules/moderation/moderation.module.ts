import Module from "../module.js";
import { InviteListeners } from "./discordInvitesMonitor.module.js";
import { BanCommand } from "./ban.command.js";
import { UnbanCommand } from "./unban.command.js";
import { TempBanListener } from "./tempBan.module.js";

export const ModerationModule: Module = {
  name: "moderation",
  commands: [BanCommand, UnbanCommand],
  listeners: [...InviteListeners, TempBanListener],
};
