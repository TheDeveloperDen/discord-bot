import Module from "../module.js";
import { BanCommand } from "./ban.command.js";

export const AdministrationModule: Module = {
  name: "administration",
  commands: [BanCommand],
};
