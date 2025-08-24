import Module from "../module.js";
import { InviteListeners } from "./discordInvitesMonitor.module.js";

export const ModerationModule: Module = {
  name: "moderation",
  commands: [],
  listeners: [...InviteListeners],
};
