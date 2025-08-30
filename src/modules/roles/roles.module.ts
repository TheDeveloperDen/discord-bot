import type Module from "../module.js";
import { NoPingCommand } from "./role.command.js";
import { RoleColourCommand } from "./roleColour.command.js";
import { RoleColourListener } from "./roleColour.listener.js";

export const RolesModule: Module = {
  name: "roles",
  commands: [NoPingCommand, RoleColourCommand],
  listeners: [RoleColourListener],
};
