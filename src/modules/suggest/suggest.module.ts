import Module from "../module.js";
import { SuggestCommand } from "./suggest.command.js";

export const SuggestModule: Module = {
  name: "suggest",
  commands: [SuggestCommand],
  listeners: [],
};

export default SuggestModule;
