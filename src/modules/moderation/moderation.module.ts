import Module from "../module.js";
import { InviteListeners } from "./discordInvitesMonitor.listener.js";
import { BanCommand } from "./ban.command.js";
import { UnbanCommand } from "./unban.command.js";
import { TempBanListener } from "./tempBan.listener.js";
import { SoftBanCommand } from "./softBan.command.js";
import { TempBanCommand } from "./tempBan.command.js";
import { KickCommand } from "./kick.command.js";

export const ModerationModule: Module = {
  name: "moderation",
  commands: [
    BanCommand,
    UnbanCommand,
    SoftBanCommand,
    TempBanCommand,
    KickCommand,
  ],
  listeners: [...InviteListeners, TempBanListener],
};
