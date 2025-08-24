import Module from "../module.js";
import { BanCommand } from "./ban.command.js";
import { UnbanCommand } from "./unban.command.js";

export const AdministrationModule: Module = {
  name: "administration",
  commands: [BanCommand, UnbanCommand],
};
