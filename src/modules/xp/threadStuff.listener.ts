import { EventListener } from "../module.js";

export const ThreadListener: EventListener = {
  async threadCreate(_, thread) {
    await thread.join();
  },
};
