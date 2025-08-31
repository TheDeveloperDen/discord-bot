import type Module from "../module.js";
import { InformationMessageCommand } from "./informationMessage.command.js";
import { InformationButtonListener } from "./informationMessage.listener.js";

export const InformationModule: Module = {
  name: "information",
  commands: [InformationMessageCommand],
  listeners: [InformationButtonListener],
};
