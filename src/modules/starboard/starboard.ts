import {
  AttachmentBuilder,
  ColorResolvable,
  EmbedBuilder,
  GuildMember,
  Message,
  Snowflake,
} from "discord.js";
import { StarboardMessage } from "../../store/models/StarboardMessage.js";
import { createStandardEmbed } from "../../util/embeds.js";
import { config } from "../../Config.js";
import ffmpeg from "fluent-ffmpeg";
import { Readable } from "node:stream";
import { execSync } from "node:child_process";
// Check if system FFmpeg is available, otherwise fall back to a common path
let ffmpegPath: string;
try {
  // Try to find FFmpeg in system PATH
  const command =
    process.platform === "win32" ? "where ffmpeg" : "which ffmpeg";
  ffmpegPath = execSync(command, { encoding: "utf8" }).trim();
  // On Windows, 'where' can return multiple paths, so take the first one
  if (process.platform === "win32" && ffmpegPath.includes("\n")) {
    ffmpegPath = ffmpegPath.split("\n")[0] as string;
  }
} catch {
  // Fallback paths where FFmpeg might be installed
  const possiblePaths =
    process.platform === "win32"
      ? [
          "C:\\ffmpeg\\bin\\ffmpeg.exe",
          "C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe",
          "C:\\Program Files (x86)\\ffmpeg\\bin\\ffmpeg.exe",
          "%USERPROFILE%\\ffmpeg\\bin\\ffmpeg.exe",
          "ffmpeg.exe",
        ]
      : [
          "/usr/bin/ffmpeg",
          "/usr/local/bin/ffmpeg",
          "/opt/homebrew/bin/ffmpeg",
        ];

  ffmpegPath =
    possiblePaths.find((path) => {
      try {
        const testPath =
          process.platform === "win32" && path.includes("%USERPROFILE%")
            ? path.replace("%USERPROFILE%", process.env.USERPROFILE || "")
            : path;
        execSync(`"${testPath}" -version`, { stdio: "ignore" });
        return true;
      } catch {
        return false;
      }
    }) || (process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"); // Last resort: hope it's in PATH
}
ffmpeg.setFfmpegPath(ffmpegPath);

export const createStarboardMessage: (
  originalMessageId: Snowflake,
  originalMessageChannelId: Snowflake,
  starboardMessageId: Snowflake,
) => Promise<StarboardMessage> = async (
  originalMessageId,
  originalMessageChannelId,
  starboardMessageId,
) => {
  return await StarboardMessage.create({
    originalMessageId: BigInt(originalMessageId),
    originalMessageChannelId: BigInt(originalMessageChannelId),
    starboardMessageId: BigInt(starboardMessageId),
  });
};

export const getStarboardMessageForOriginalMessageId: (
  originalMessageId: Snowflake,
) => Promise<StarboardMessage | null> = async (originalMessageId) => {
  return await StarboardMessage.findOne({
    where: {
      originalMessageId: BigInt(originalMessageId),
    },
  });
};

const getColorForStars: (stars: number) => ColorResolvable = (
  stars: number,
) => {
  const overthreshold = stars - config.starboard.threshold;
  switch (overthreshold) {
    case 2:
      return "Red";
    case 4:
      return "Orange";
    case 6:
      return "Gold";

    default:
      return "Blue";
  }
};

export const createStarboardMessageFromMessage: (
  message: Message,
  member: GuildMember,
  stars: number,
  starboardMessage?: Message,
) => Promise<{
  embeds: EmbedBuilder[];
  content: string;
  files?: AttachmentBuilder[];
}> = async (message, member, stars, starboardMessage) => {
  const embed = createStandardEmbed(member)
    .setColor(getColorForStars(stars))
    .setAuthor({
      name: member.displayName,
      iconURL: member.user.displayAvatarURL(),
      url: `https://discord.com/users/${member.id}`,
    })
    .setURL(message.url)
    .setDescription(message.content.length > 0 ? message.content : null);
  const files: AttachmentBuilder[] = [];
  if (!starboardMessage) {
    const imageOrGif = await getImageOrGifEmbed(message);
    console.log(imageOrGif);
    if (imageOrGif) {
      if ("gifBuffer" in imageOrGif) {
        files.push(
          new AttachmentBuilder(imageOrGif.gifBuffer, {
            name: imageOrGif.gifName,
          }),
        );
        embed.setImage(`attachment://${imageOrGif.gifName}`);
      } else if (imageOrGif.url) {
        // If we have a regular image URL, use it directly
        embed.setImage(imageOrGif.url);
      }
    }
  }

  return {
    embeds: [embed],
    content: `${config.starboard.emojiId}: ${stars} | ${message.url}`,
    files: files.length > 0 ? files : undefined,
  };
};

const convertVideoToGif: (url: string) => Promise<Buffer> = async (url) => {
  try {
    // Download the video into memory
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.statusText}`);
    }

    const videoBuffer = Buffer.from(await response.arrayBuffer());
    const inputStream = new Readable();
    inputStream.push(videoBuffer);
    inputStream.push(null); // End the stream

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      ffmpeg(inputStream)
        .inputFormat("mp4")
        .outputFormat("gif")
        .size("320x?")
        .fps(10)
        .on("error", (err) => {
          console.error("FFmpeg error:", err);
          reject(err);
        })
        .on("end", () => {
          console.log("Video conversion completed");
          const gifBuffer = Buffer.concat(chunks);
          resolve(gifBuffer);
        })
        .pipe()
        .on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        })
        .on("error", (err) => {
          console.error("Stream error:", err);
          reject(err);
        });
    });
  } catch (error) {
    console.error("Error converting video to GIF:", error);
    throw error;
  }
};

const isEmbedableContentType = (type: string) => {
  const imageFormats = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp", // Static WebP only, animated WebP not supported
  ];
  return imageFormats.includes(type.toLowerCase());
};

export const getImageOrGifEmbed: (message: Message) => Promise<
  | undefined
  | { gifBuffer: Buffer; gifName: string }
  | {
      url: string;
    }
> = async (message) => {
  const embeds = message.embeds.filter(
    (emb) => emb.data.type === "image" || emb.data.type === "gifv",
  );
  console.log(embeds);
  if (embeds.length > 0) {
    const embed = embeds[0]!;

    if (embed.video) {
      const gifBuffer = await convertVideoToGif(
        embed.video.proxyURL ?? embed.video.url,
      );
      return {
        gifBuffer,
        gifName: "starboard.gif",
      };
    } else if (embed.image) {
      return {
        url: embed.image.proxyURL ?? embed.image.url,
      };
    }
  }

  const attachments = message.attachments.filter(
    (x) => x.contentType && isEmbedableContentType(x.contentType),
  );

  if (attachments.size > 0) {
    const attachment = attachments.first()!;
    return {
      url: attachment.proxyURL ?? attachment.url,
    };
  }

  const stickers = message.stickers;
  if (stickers.size > 0) {
    const sticker = stickers.first()!;
    return {
      url: sticker.url,
    };
  }

  return undefined;
};
