import { actualMention } from "./util/users.js";
import type { Config } from "./config.type.js";
import { config as prodConfig } from "./Config.prod.js";

// Config file for the DevDen Testing server
export const config: Config = {
  channels: {
    welcome: "932633680634081301",
    botCommands: "906954540039938048",
    hotTake: "904478147351806015",
    showcase: "952536628533030942",
    auditLog: "994623474557538415",
    general: "904478147351806015",
  },
  commands: {
    daily: "1029850807794937949",
  },
  roles: {
    tiers: [
      "904478147351806012", // @everyone (tier 0)
      "932637161528909865", // tier 1
      "932637187030257694", // tier 2
    ],
    admin: "932644914066501652",
    staff: "932644914066501652",
    separators: {
      general: "932638046153744434",
      tags: "932638097311666218",
      langs: "932638149618835466",
    },
    noPing: "932637353263128577",
  },
  clientId: "932387188585398353",
  guildId: "904478147351806012",
  poll: {
    emojiId: "skull",
    yesEmojiId: "thumbsup",
    noEmojiId: "thumbsdown",
  },
  pastebin: prodConfig.pastebin,
  branding: {
    color: "#ffffff",
    font: "CascadiaCode.ttf",
    welcomeMessage: (member) =>
      `Welcome ${actualMention(
        member,
      )} to the Developer Den test server!\nCurrent Member Count: ${member.guild.memberCount}`,
    goodbyeMessage: (member) =>
      `Goodbye ${actualMention(
        member,
      )} from the Developer Den test server!\nCurrent Member Count: ${member.guild.memberCount}`,
  },

  informationMessage: prodConfig.informationMessage,
};
