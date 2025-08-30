import type { Snowflake } from "discord.js";
import type { BrandingConfig } from "./util/branding.js";
import type { InformationMessage } from "./modules/information/information.js";

export interface Config {
  guildId: string;
  clientId: string;
  poll?: {
    emojiId: string;
    yesEmojiId: string;
    noEmojiId: string;
  };
  pastebin: { url: string; threshold: number };
  channels: {
    welcome: string;
    botCommands: string;
    hotTake: string;
    showcase: string;
    auditLog: string;
    introductions?: string;
    general: string;
  };
  starboard: {
    emojiId: string;
    channel: string;
    threshold: number;
  };
  commands: {
    daily: Snowflake;
  };
  roles: {
    tiers: Snowflake[];
    admin: Snowflake;
    notable?: Snowflake;
    staff: Snowflake;
    separators: { general: Snowflake; tags: Snowflake; langs: Snowflake };
    noPing: Snowflake;
    bumpNotifications?: Snowflake;
  };
  branding: BrandingConfig;
  informationMessage?: InformationMessage;
}
