import Module from "./module.js";
import { createStandardEmbed } from "../util/embeds.js";

const tokenPattern = /[MN][A-Za-z\d]{23}\.[\w-]{6}\.[\w-]{27}/g;
const githubTokenPattern =
  /gh[pousr]_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{82}/g;

const invalidationGuides = {
  Discord:
    "**Discord**:\nGo to https://discord.com/developers/applications and find the application you used to create the token. Click the 'Bot' tab, and click 'Regenerate Token'.\n\n",
  GitHub:
    "**Github**:\nGo to https://github.com/settings/tokens and find the token you used to create the token. Click 'Regenerate Token' or 'Delete'.\n\n",
};

export const TokenScannerModule: Module = {
  name: "tokenScanner",
  listeners: [
    {
      async messageCreate(_, message) {
        const discordMatches = message.content.match(tokenPattern);
        const githubMatches = message.content.match(githubTokenPattern);

        const allMatches = [
          ...(discordMatches || []),
          ...(githubMatches || []),
        ];

        if (allMatches.length === 0) return;

        await message.delete();

        const tokenTypes = [];

        if (discordMatches?.length) tokenTypes.push(`Discord`);
        if (githubMatches?.length) {
          tokenTypes.push(`GitHub`);
        }

        await message.member?.send({
          embeds: [
            {
              ...createStandardEmbed(message.member),
              title: ":exclamation: TOKENS DETECTED :exclamation:",
              description: `We found ${tokenTypes.join(" and ")} tokens in a message you sent!\n\n${allMatches
                .map((x) => `\`${x}\``)
                .join("\n")}\n
We've deleted the message, but we can't reset the token for you - make sure to do this yourself.
Be careful when handling tokens in the future - **they're secrets, keep them that way!**`,
              fields: [
                {
                  name: "Invalidation Guides",
                  value: tokenTypes
                    .map((x: string) => {
                      return (
                        invalidationGuides[
                          x as keyof typeof invalidationGuides
                        ] || ""
                      );
                    })
                    .join(""),
                },
              ],
            },
          ],
        });
      },
    },
  ],
};
